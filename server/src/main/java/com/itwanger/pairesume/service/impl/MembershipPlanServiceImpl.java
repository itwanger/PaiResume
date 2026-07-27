package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.MembershipPlanDTO;
import com.itwanger.pairesume.dto.UpdateMembershipPlanDTO;
import com.itwanger.pairesume.entity.MembershipPlan;
import com.itwanger.pairesume.entity.PlatformConfig;
import com.itwanger.pairesume.mapper.MembershipPlanMapper;
import com.itwanger.pairesume.mapper.PlatformConfigMapper;
import com.itwanger.pairesume.payment.MembershipEntitlementType;
import com.itwanger.pairesume.payment.MembershipPlanCode;
import com.itwanger.pairesume.service.MembershipPlanService;
import com.itwanger.pairesume.service.MembershipAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MembershipPlanServiceImpl implements MembershipPlanService {
    private static final long PLATFORM_CONFIG_ID = 1L;

    private final MembershipPlanMapper membershipPlanMapper;
    private final PlatformConfigMapper platformConfigMapper;
    private final MembershipAuditService membershipAuditService;

    @Override
    @Transactional(readOnly = true)
    public List<MembershipPlanDTO> listPlans() {
        List<String> fixedCodes = java.util.Arrays.stream(MembershipPlanCode.values())
                .map(Enum::name)
                .toList();
        Map<String, MembershipPlan> plans = membershipPlanMapper.selectList(
                new LambdaQueryWrapper<MembershipPlan>()
                        .in(MembershipPlan::getPlanCode, fixedCodes)
        ).stream().collect(Collectors.toMap(
                MembershipPlan::getPlanCode,
                Function.identity()
        ));
        return java.util.Arrays.stream(MembershipPlanCode.values())
                .map(code -> {
                    MembershipPlan plan = plans.get(code.name());
                    validateStoredPlan(plan);
                    return toDto(plan);
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public MembershipPlan requirePurchasable(String planCode) {
        String normalizedCode = MembershipPlanCode.fromRequest(planCode).name();
        MembershipPlan plan = membershipPlanMapper.selectById(normalizedCode);
        validateStoredPlan(plan);
        if (!Boolean.TRUE.equals(plan.getEnabled())
                || plan.getPriceCents() == null || plan.getPriceCents() <= 0) {
            throw new BusinessException(ResultCode.MEMBERSHIP_PLAN_NOT_AVAILABLE);
        }
        return plan;
    }

    @Override
    @Transactional
    public MembershipPlanDTO updatePlan(
            String planCode,
            UpdateMembershipPlanDTO dto,
            Long adminUserId
    ) {
        String normalizedCode = MembershipPlanCode.fromRequest(planCode).name();
        if (dto == null || dto.getEnabled() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "会员方案启用状态不能为空");
        }
        MembershipPlan plan = membershipPlanMapper.selectByCodeForUpdate(normalizedCode);
        validateStoredPlan(plan);
        Integer beforePriceCents = plan.getPriceCents();
        boolean beforeEnabled = Boolean.TRUE.equals(plan.getEnabled());
        if (dto.getPriceCents() != null) {
            if (dto.getPriceCents() <= 0) {
                throw new BusinessException(
                        ResultCode.BAD_REQUEST.getCode(), "会员方案价格必须大于 0");
            }
        }
        plan.setPriceCents(dto.getPriceCents());
        plan.setEnabled(dto.getEnabled());
        if (Boolean.TRUE.equals(plan.getEnabled())
                && (plan.getPriceCents() == null || plan.getPriceCents() <= 0)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "启用会员方案前必须配置有效价格");
        }
        plan.setUpdatedBy(adminUserId);
        membershipPlanMapper.updateById(plan);
        syncLegacyAnnualPriceMirror(plan, adminUserId);
        membershipAuditService.record(
                adminUserId,
                "UPDATE_MEMBERSHIP_PLAN",
                null,
                null,
                null,
                null,
                "后台修改会员方案",
                "code=" + plan.getPlanCode()
                        + ", beforePriceCents=" + beforePriceCents
                        + ", afterPriceCents=" + plan.getPriceCents()
                        + ", beforeEnabled=" + beforeEnabled
                        + ", afterEnabled=" + Boolean.TRUE.equals(plan.getEnabled())
        );
        return toDto(plan);
    }

    private void syncLegacyAnnualPriceMirror(MembershipPlan plan, Long adminUserId) {
        if (MembershipPlanCode.ANNUAL.name().equals(plan.getPlanCode())) {
            PlatformConfig config = platformConfigMapper.selectById(PLATFORM_CONFIG_ID);
            if (config == null) {
                throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "平台配置不存在");
            }
            int effectiveLegacyPrice = Boolean.TRUE.equals(plan.getEnabled())
                    && plan.getPriceCents() != null
                    ? plan.getPriceCents() : 0;
            config.setMembershipPriceCents(effectiveLegacyPrice);
            config.setUpdatedBy(adminUserId);
            platformConfigMapper.updateById(config);
        }
    }

    private void validateStoredPlan(MembershipPlan plan) {
        if (plan == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_PLAN_NOT_FOUND);
        }
        MembershipPlanCode planCode;
        MembershipEntitlementType entitlementType;
        try {
            planCode = MembershipPlanCode.valueOf(plan.getPlanCode());
            entitlementType = MembershipEntitlementType.valueOf(plan.getEntitlementType());
        } catch (RuntimeException exception) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "会员方案权益配置错误");
        }
        if (planCode == MembershipPlanCode.LIFETIME) {
            if (entitlementType != MembershipEntitlementType.PERMANENT
                    || plan.getMembershipDays() != null) {
                throw new BusinessException(
                        ResultCode.INTERNAL_ERROR.getCode(), "终身会员方案期限配置错误");
            }
            return;
        }
        int expectedDays = switch (planCode) {
            case MONTHLY -> 30;
            case QUARTERLY -> 90;
            case ANNUAL -> 365;
            case LIFETIME -> throw new IllegalStateException("unreachable");
        };
        if (entitlementType != MembershipEntitlementType.FIXED_DAYS
                || !java.util.Objects.equals(plan.getMembershipDays(), expectedDays)) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "会员方案期限配置错误");
        }
    }

    private MembershipPlanDTO toDto(MembershipPlan plan) {
        MembershipPlanDTO dto = new MembershipPlanDTO();
        dto.setCode(plan.getPlanCode());
        dto.setName(plan.getDisplayName());
        dto.setEntitlementType(plan.getEntitlementType());
        dto.setMembershipDays(plan.getMembershipDays());
        dto.setPriceCents(plan.getPriceCents());
        dto.setEnabled(Boolean.TRUE.equals(plan.getEnabled())
                && plan.getPriceCents() != null
                && plan.getPriceCents() > 0);
        dto.setRecommended(Boolean.TRUE.equals(plan.getRecommended()));
        return dto;
    }
}
