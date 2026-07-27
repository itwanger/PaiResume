package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.UpdateMembershipPlanDTO;
import com.itwanger.pairesume.entity.MembershipPlan;
import com.itwanger.pairesume.entity.PlatformConfig;
import com.itwanger.pairesume.mapper.MembershipPlanMapper;
import com.itwanger.pairesume.mapper.PlatformConfigMapper;
import com.itwanger.pairesume.service.MembershipAuditService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.isNull;

@ExtendWith(MockitoExtension.class)
class MembershipPlanServiceImplTest {
    @Mock
    private MembershipPlanMapper membershipPlanMapper;
    @Mock
    private PlatformConfigMapper platformConfigMapper;
    @Mock
    private MembershipAuditService membershipAuditService;

    @Test
    void publicCatalogReturnsFourFixedPlansWithoutInventingDisabledPrices() {
        when(membershipPlanMapper.selectList(any(Wrapper.class))).thenReturn(List.of(
                plan("LIFETIME", "终身会员", "PERMANENT", null, null, false, false),
                plan("ANNUAL", "年卡", "FIXED_DAYS", 365, 6600, true, true),
                plan("MONTHLY", "月卡", "FIXED_DAYS", 30, null, false, false),
                plan("QUARTERLY", "季卡", "FIXED_DAYS", 90, null, false, false)
        ));
        MembershipPlanServiceImpl service = new MembershipPlanServiceImpl(
                membershipPlanMapper, platformConfigMapper, membershipAuditService);

        var plans = service.listPlans();

        assertEquals(List.of("MONTHLY", "QUARTERLY", "ANNUAL", "LIFETIME"),
                plans.stream().map(value -> value.getCode()).toList());
        assertNull(plans.get(0).getPriceCents());
        assertFalse(plans.get(0).isEnabled());
        assertEquals(365, plans.get(2).getMembershipDays());
        assertTrue(plans.get(2).isEnabled());
        assertTrue(plans.get(2).isRecommended());
        assertNull(plans.get(3).getMembershipDays());
        assertEquals("PERMANENT", plans.get(3).getEntitlementType());
    }

    @Test
    void disabledPlanCannotBeQuotedOrPurchased() {
        when(membershipPlanMapper.selectById("MONTHLY")).thenReturn(
                plan("MONTHLY", "月卡", "FIXED_DAYS", 30, null, false, false));
        MembershipPlanServiceImpl service = new MembershipPlanServiceImpl(
                membershipPlanMapper, platformConfigMapper, membershipAuditService);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.requirePurchasable("monthly"));

        assertEquals(ResultCode.MEMBERSHIP_PLAN_NOT_AVAILABLE.getCode(), exception.getCode());
    }

    @Test
    void adminCannotEnablePlanWithoutPositivePrice() {
        MembershipPlan monthly = plan(
                "MONTHLY", "月卡", "FIXED_DAYS", 30, null, false, false);
        when(membershipPlanMapper.selectByCodeForUpdate("MONTHLY")).thenReturn(monthly);
        MembershipPlanServiceImpl service = new MembershipPlanServiceImpl(
                membershipPlanMapper, platformConfigMapper, membershipAuditService);
        UpdateMembershipPlanDTO request = new UpdateMembershipPlanDTO();
        request.setEnabled(true);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.updatePlan("MONTHLY", request, 99L));

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
    }

    @Test
    void adminCanPriceAndEnableOneFixedPlan() {
        MembershipPlan quarterly = plan(
                "QUARTERLY", "季卡", "FIXED_DAYS", 90, null, false, false);
        when(membershipPlanMapper.selectByCodeForUpdate("QUARTERLY"))
                .thenReturn(quarterly);
        MembershipPlanServiceImpl service = new MembershipPlanServiceImpl(
                membershipPlanMapper, platformConfigMapper, membershipAuditService);
        UpdateMembershipPlanDTO request = new UpdateMembershipPlanDTO();
        request.setPriceCents(9900);
        request.setEnabled(true);

        var updated = service.updatePlan("quarterly", request, 99L);

        assertEquals(9900, updated.getPriceCents());
        assertTrue(updated.isEnabled());
        assertEquals(99L, quarterly.getUpdatedBy());
        verify(membershipPlanMapper).updateById(quarterly);
        verify(membershipAuditService).record(
                eq(99L), eq("UPDATE_MEMBERSHIP_PLAN"),
                isNull(), isNull(), isNull(), isNull(),
                eq("后台修改会员方案"),
                eq("code=QUARTERLY, beforePriceCents=null, afterPriceCents=9900, "
                        + "beforeEnabled=false, afterEnabled=true")
        );
    }

    @Test
    void annualPriceUpdateSynchronizesReadOnlyLegacyMirror() {
        MembershipPlan annual = plan(
                "ANNUAL", "年卡", "FIXED_DAYS", 365, 6600, true, true);
        PlatformConfig legacyMirror = new PlatformConfig();
        legacyMirror.setId(1L);
        legacyMirror.setMembershipPriceCents(6600);
        when(membershipPlanMapper.selectByCodeForUpdate("ANNUAL")).thenReturn(annual);
        when(platformConfigMapper.selectById(1L)).thenReturn(legacyMirror);
        MembershipPlanServiceImpl service = new MembershipPlanServiceImpl(
                membershipPlanMapper, platformConfigMapper, membershipAuditService);
        UpdateMembershipPlanDTO request = new UpdateMembershipPlanDTO();
        request.setPriceCents(8800);
        request.setEnabled(true);

        service.updatePlan("ANNUAL", request, 99L);

        assertEquals(8800, legacyMirror.getMembershipPriceCents());
        assertEquals(99L, legacyMirror.getUpdatedBy());
        verify(platformConfigMapper).updateById(legacyMirror);
    }

    @Test
    void disablingAnnualAndClearingPriceMakesLegacyRollbackFailClosed() {
        MembershipPlan annual = plan(
                "ANNUAL", "年卡", "FIXED_DAYS", 365, 6600, true, true);
        PlatformConfig legacyMirror = new PlatformConfig();
        legacyMirror.setId(1L);
        legacyMirror.setMembershipPriceCents(6600);
        when(membershipPlanMapper.selectByCodeForUpdate("ANNUAL")).thenReturn(annual);
        when(platformConfigMapper.selectById(1L)).thenReturn(legacyMirror);
        MembershipPlanServiceImpl service = new MembershipPlanServiceImpl(
                membershipPlanMapper, platformConfigMapper, membershipAuditService);
        UpdateMembershipPlanDTO request = new UpdateMembershipPlanDTO();
        request.setPriceCents(null);
        request.setEnabled(false);

        var updated = service.updatePlan("ANNUAL", request, 99L);

        assertNull(updated.getPriceCents());
        assertFalse(updated.isEnabled());
        assertNull(annual.getPriceCents());
        assertEquals(0, legacyMirror.getMembershipPriceCents());
        verify(platformConfigMapper).updateById(legacyMirror);
    }

    private MembershipPlan plan(
            String code,
            String name,
            String entitlementType,
            Integer membershipDays,
            Integer priceCents,
            boolean enabled,
            boolean recommended
    ) {
        MembershipPlan plan = new MembershipPlan();
        plan.setPlanCode(code);
        plan.setDisplayName(name);
        plan.setEntitlementType(entitlementType);
        plan.setMembershipDays(membershipDays);
        plan.setPriceCents(priceCents);
        plan.setEnabled(enabled);
        plan.setRecommended(recommended);
        return plan;
    }
}
