package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.UserAdminDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.MembershipPlan;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.CouponService;
import com.itwanger.pairesume.service.MembershipService;
import com.itwanger.pairesume.service.MembershipAuditService;
import com.itwanger.pairesume.service.MembershipPlanService;
import com.itwanger.pairesume.payment.MembershipPlanCode;
import com.itwanger.pairesume.payment.MarketplacePaymentGateway;
import com.itwanger.pairesume.payment.MarketplacePaymentProperties;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MembershipServiceImpl implements MembershipService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final Set<String> MEMBERSHIP_STATUS_FILTERS = Set.of("ACTIVE", "FREE");
    private final CouponService couponService;
    private final UserMapper userMapper;
    private final MembershipAuditService membershipAuditService;
    private final MembershipPlanService membershipPlanService;
    private final MarketplacePaymentProperties paymentProperties;
    private final MarketplacePaymentGateway paymentGateway;

    @Override
    public CouponQuoteDTO quote(Long userId, String planCode, String couponCode) {
        User user = getUser(userId);
        MembershipPlan plan = membershipPlanService.requirePurchasable(planCode);
        if (StringUtils.hasText(couponCode)
                && !MembershipPlanCode.ANNUAL.name().equals(plan.getPlanCode())) {
            throw new BusinessException(
                    ResultCode.COUPON_INVALID.getCode(), "优惠码当前仅适用于年卡");
        }
        CouponQuoteDTO quote = couponService.quoteForUser(
                couponCode, user.getEmail(), plan.getPriceCents());
        quote.setPlanCode(plan.getPlanCode());
        quote.setPlanName(plan.getDisplayName());
        quote.setEntitlementType(plan.getEntitlementType());
        quote.setMembershipDays(plan.getMembershipDays());
        quote.setPriceCents(plan.getPriceCents());
        quote.setEnabled(Boolean.TRUE.equals(plan.getEnabled()));
        quote.setRecommended(Boolean.TRUE.equals(plan.getRecommended()));
        quote.setPaymentEnabled(paymentProperties.isMembershipAcceptNewOrders()
                && !"disabled".equals(paymentGateway.provider()));
        return quote;
    }

    @Override
    public boolean isActiveMember(Long userId) {
        User user = getUser(userId);
        return hasActiveMembership(user);
    }

    @Override
    public void requireAiAccess(Long userId) {
        if (!isActiveMember(userId)) {
            throw new BusinessException(ResultCode.AI_MEMBERSHIP_REQUIRED);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public MarketplacePageDTO<UserAdminDTO> listUsers(int page, int size, String keyword, String membershipStatus) {
        int safePage = Math.max(1, page);
        int safeSize = Math.min(MAX_PAGE_SIZE, Math.max(1, size));
        String normalizedKeyword = StringUtils.hasText(keyword) ? keyword.trim() : null;
        String normalizedStatus = normalizeFilter(
                membershipStatus, MEMBERSHIP_STATUS_FILTERS, "会员状态筛选值无效");
        // 与 hasActiveMembership 的生效状态语义保持一致：DB 为 ACTIVE 但已过期的账号按 FREE 处理；
        // membership_status 可能为 NULL（老数据），FREE 条件显式展开而不是裸 NOT，避免三值逻辑漏行。
        LocalDateTime now = LocalDateTime.now();
        LambdaQueryWrapper<User> query = new LambdaQueryWrapper<User>()
                .and(StringUtils.hasText(normalizedKeyword), wrapper -> wrapper
                        .like(User::getEmail, normalizedKeyword)
                        .or()
                        .like(User::getNickname, normalizedKeyword))
                .and("ACTIVE".equals(normalizedStatus), wrapper -> wrapper
                        .eq(User::getMembershipStatus, "ACTIVE")
                        .and(active -> active
                                .isNull(User::getMembershipExpiresAt)
                                .or()
                                .gt(User::getMembershipExpiresAt, now)))
                .and("FREE".equals(normalizedStatus), wrapper -> wrapper
                        .isNull(User::getMembershipStatus)
                        .or()
                        .ne(User::getMembershipStatus, "ACTIVE")
                        .or(free -> free
                                .isNotNull(User::getMembershipExpiresAt)
                                .le(User::getMembershipExpiresAt, now)))
                .orderByDesc(User::getCreatedAt)
                .orderByDesc(User::getId);
        Page<User> result = userMapper.selectPage(new Page<>(safePage, safeSize, true), query);
        int totalPages = result.getTotal() == 0
                ? 0 : (int) Math.ceil((double) result.getTotal() / safeSize);
        return new MarketplacePageDTO<>(
                result.getRecords().stream().map(this::toAdminDto).toList(),
                result.getTotal(), safePage, safeSize, totalPages);
    }

    @Override
    @Transactional
    public UserAdminDTO grantMembership(Long userId, Long adminUserId, String reason) {
        User user = getUserForUpdate(userId);
        User before = membershipSnapshot(user);
        user.setMembershipStatus("ACTIVE");
        user.setMembershipGrantedAt(LocalDateTime.now());
        user.setMembershipSource("ADMIN_GRANTED");
        user.setMembershipOriginType("ADMIN_GRANTED");
        user.setMembershipOriginId(null);
        user.setMembershipExpiresAt(null);
        userMapper.updateMembership(user);
        membershipAuditService.record(
                adminUserId, "GRANT_MEMBERSHIP", before, user,
                null, null, reason, "手工开通永久 VIP"
        );
        return toAdminDto(user);
    }

    @Override
    @Transactional
    public UserAdminDTO extendMembership(Long userId, int days, Long adminUserId, String reason) {
        User user = getUserForUpdate(userId);
        User before = membershipSnapshot(user);
        if ("ACTIVE".equals(user.getMembershipStatus()) && user.getMembershipExpiresAt() == null) {
            throw new BusinessException(ResultCode.MEMBERSHIP_PERMANENT);
        }
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime extensionBase = user.getMembershipExpiresAt() != null
                && user.getMembershipExpiresAt().isAfter(now)
                ? user.getMembershipExpiresAt()
                : now;
        user.setMembershipStatus("ACTIVE");
        if (user.getMembershipGrantedAt() == null) {
            user.setMembershipGrantedAt(now);
        }
        if (!hasActiveMembership(before)) {
            user.setMembershipOriginType("ADMIN_EXTENDED");
            user.setMembershipOriginId(null);
        }
        user.setMembershipSource("ADMIN_EXTENDED");
        user.setMembershipExpiresAt(extensionBase.plusDays(days));
        userMapper.updateMembership(user);
        membershipAuditService.record(
                adminUserId, "EXTEND_MEMBERSHIP", before, user,
                null, null, reason, "延期 " + days + " 天"
        );
        return toAdminDto(user);
    }

    @Override
    @Transactional
    public UserAdminDTO revokeMembership(Long userId, Long adminUserId, String reason) {
        User user = getUserForUpdate(userId);
        User before = membershipSnapshot(user);
        user.setMembershipStatus("FREE");
        user.setMembershipGrantedAt(null);
        user.setMembershipSource("ADMIN_REVOKED");
        user.setMembershipOriginType(null);
        user.setMembershipOriginId(null);
        user.setMembershipExpiresAt(null);
        userMapper.updateMembership(user);
        membershipAuditService.record(
                adminUserId, "REVOKE_MEMBERSHIP", before, user,
                null, null, reason, "手工撤销 VIP"
        );
        return toAdminDto(user);
    }

    private User getUserForUpdate(Long userId) {
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        return user;
    }

    private User getUser(Long userId) {
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        return user;
    }

    private String normalizeFilter(String value, Set<String> allowed, String message) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String normalized = value.trim().toUpperCase(Locale.ROOT);
        if (!allowed.contains(normalized)) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), message);
        }
        return normalized;
    }

    private UserAdminDTO toAdminDto(User user) {
        UserAdminDTO dto = new UserAdminDTO();
        dto.setId(user.getId());
        dto.setEmail(user.getEmail());
        dto.setNickname(user.getNickname());
        dto.setRole(user.getRole() != null && user.getRole() == 1 ? "ADMIN" : "USER");
        dto.setMembershipStatus(hasActiveMembership(user) ? "ACTIVE" : "FREE");
        dto.setMembershipGrantedAt(DateTimeUtils.format(user.getMembershipGrantedAt()));
        dto.setMembershipExpiresAt(DateTimeUtils.format(user.getMembershipExpiresAt()));
        dto.setMembershipSource(user.getMembershipSource());
        dto.setCreatedAt(DateTimeUtils.format(user.getCreatedAt()));
        return dto;
    }

    private boolean hasActiveMembership(User user) {
        return "ACTIVE".equals(user.getMembershipStatus())
                && (user.getMembershipExpiresAt() == null
                || user.getMembershipExpiresAt().isAfter(LocalDateTime.now()));
    }

    private User membershipSnapshot(User user) {
        User snapshot = new User();
        snapshot.setId(user.getId());
        snapshot.setMembershipStatus(user.getMembershipStatus());
        snapshot.setMembershipGrantedAt(user.getMembershipGrantedAt());
        snapshot.setMembershipSource(user.getMembershipSource());
        snapshot.setMembershipOriginType(user.getMembershipOriginType());
        snapshot.setMembershipOriginId(user.getMembershipOriginId());
        snapshot.setMembershipExpiresAt(user.getMembershipExpiresAt());
        return snapshot;
    }
}
