package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.CouponService;
import com.itwanger.pairesume.service.MembershipAuditService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.same;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MembershipServiceImplTest {

    @Mock
    private CouponService couponService;
    @Mock
    private UserMapper userMapper;
    @Mock
    private MembershipAuditService membershipAuditService;

    private MembershipServiceImpl membershipService;

    @BeforeEach
    void setUp() {
        membershipService = new MembershipServiceImpl(
                couponService, userMapper, membershipAuditService, null, null, null);
    }

    @Test
    void activeMembershipWithoutExpirationIsValid() {
        when(userMapper.selectById(1L)).thenReturn(user("ACTIVE", null));

        assertTrue(membershipService.isActiveMember(1L));
    }

    @Test
    void activeMembershipWithFutureExpirationIsValid() {
        when(userMapper.selectById(1L)).thenReturn(user("ACTIVE", LocalDateTime.now().plusDays(1)));

        assertTrue(membershipService.isActiveMember(1L));
    }

    @Test
    void expiredActiveMembershipIsInvalid() {
        when(userMapper.selectById(1L)).thenReturn(user("ACTIVE", LocalDateTime.now().minusSeconds(1)));

        assertFalse(membershipService.isActiveMember(1L));
    }

    @Test
    void freeMembershipIsInvalidEvenWithFutureExpiration() {
        when(userMapper.selectById(1L)).thenReturn(user("FREE", LocalDateTime.now().plusDays(1)));

        assertFalse(membershipService.isActiveMember(1L));
    }

    @Test
    void missingUserThrowsUserNotFound() {
        when(userMapper.selectById(1L)).thenReturn(null);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> membershipService.isActiveMember(1L)
        );

        assertEquals(ResultCode.USER_NOT_FOUND.getCode(), exception.getCode());
    }

    @Test
    void activeMemberCanUseAi() {
        when(userMapper.selectById(1L)).thenReturn(user("ACTIVE", LocalDateTime.now().plusDays(1)));

        assertDoesNotThrow(() -> membershipService.requireAiAccess(1L));
    }

    @Test
    void freeUserCannotUseAi() {
        when(userMapper.selectById(1L)).thenReturn(user("FREE", null));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> membershipService.requireAiAccess(1L)
        );

        assertEquals(ResultCode.AI_MEMBERSHIP_REQUIRED.getCode(), exception.getCode());
    }

    @Test
    void extendMembershipAddsDaysAfterCurrentExpiration() {
        User user = user("ACTIVE", LocalDateTime.now().plusDays(10));
        user.setId(1L);
        user.setMembershipOriginType("VIP_INVITE");
        user.setMembershipOriginId(88L);
        LocalDateTime previousExpiration = user.getMembershipExpiresAt();
        when(userMapper.selectByIdForUpdate(1L)).thenReturn(user);

        var result = membershipService.extendMembership(1L, 30, 99L, "星球用户续期");

        assertEquals(previousExpiration.plusDays(30), user.getMembershipExpiresAt());
        assertEquals("ADMIN_EXTENDED", user.getMembershipSource());
        assertEquals("VIP_INVITE", user.getMembershipOriginType());
        assertEquals(88L, user.getMembershipOriginId());
        assertEquals("ACTIVE", result.getMembershipStatus());
        verify(userMapper).updateMembership(user);
        verify(membershipAuditService).record(
                eq(99L), eq("EXTEND_MEMBERSHIP"), any(User.class), same(user),
                isNull(), isNull(), eq("星球用户续期"), eq("延期 30 天")
        );
    }

    @Test
    void extendingInactiveUserStartsAnAdminExtensionOrigin() {
        User user = user("FREE", LocalDateTime.now().minusDays(1));
        user.setMembershipOriginType("VIP_INVITE");
        user.setMembershipOriginId(88L);
        when(userMapper.selectByIdForUpdate(1L)).thenReturn(user);

        membershipService.extendMembership(1L, 7, 99L, "人工补偿");

        assertEquals("ACTIVE", user.getMembershipStatus());
        assertEquals("ADMIN_EXTENDED", user.getMembershipSource());
        assertEquals("ADMIN_EXTENDED", user.getMembershipOriginType());
        assertNull(user.getMembershipOriginId());
        assertTrue(user.getMembershipExpiresAt().isAfter(LocalDateTime.now().plusDays(6)));
        verify(userMapper).updateMembership(user);
    }

    @Test
    void permanentMembershipCannotBeExtended() {
        when(userMapper.selectByIdForUpdate(1L)).thenReturn(user("ACTIVE", null));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> membershipService.extendMembership(1L, 30, 99L, "无需延期")
        );

        assertEquals(ResultCode.MEMBERSHIP_PERMANENT.getCode(), exception.getCode());
        verify(userMapper, never()).updateMembership(any(User.class));
    }

    @Test
    void grantMembershipUsesRowLockAndRecordsReasonedAudit() {
        User user = user("FREE", LocalDateTime.now().minusDays(1));
        user.setMembershipOriginType("VIP_INVITE");
        user.setMembershipOriginId(88L);
        when(userMapper.selectByIdForUpdate(1L)).thenReturn(user);

        var result = membershipService.grantMembership(1L, 99L, "合作伙伴永久权益");

        assertEquals("ACTIVE", user.getMembershipStatus());
        assertEquals("ADMIN_GRANTED", user.getMembershipSource());
        assertEquals("ADMIN_GRANTED", user.getMembershipOriginType());
        assertNull(user.getMembershipOriginId());
        assertNull(user.getMembershipExpiresAt());
        assertEquals("ACTIVE", result.getMembershipStatus());
        verify(userMapper).updateMembership(user);
        verify(membershipAuditService).record(
                eq(99L), eq("GRANT_MEMBERSHIP"), any(User.class), same(user),
                isNull(), isNull(), eq("合作伙伴永久权益"), eq("手工开通永久 VIP")
        );
    }

    @Test
    void revokeMembershipClearsOriginAndRecordsAudit() {
        User user = user("ACTIVE", LocalDateTime.now().plusDays(10));
        user.setMembershipGrantedAt(LocalDateTime.now().minusDays(2));
        user.setMembershipSource("VIP_INVITE");
        user.setMembershipOriginType("VIP_INVITE");
        user.setMembershipOriginId(88L);
        when(userMapper.selectByIdForUpdate(1L)).thenReturn(user);

        var result = membershipService.revokeMembership(1L, 99L, "异常账号");

        assertEquals("FREE", user.getMembershipStatus());
        assertEquals("ADMIN_REVOKED", user.getMembershipSource());
        assertNull(user.getMembershipGrantedAt());
        assertNull(user.getMembershipOriginType());
        assertNull(user.getMembershipOriginId());
        assertNull(user.getMembershipExpiresAt());
        assertEquals("FREE", result.getMembershipStatus());
        verify(userMapper).updateMembership(user);
        verify(membershipAuditService).record(
                eq(99L), eq("REVOKE_MEMBERSHIP"), any(User.class), same(user),
                isNull(), isNull(), eq("异常账号"), eq("手工撤销 VIP")
        );
    }

    private User user(String membershipStatus, LocalDateTime expiresAt) {
        User user = new User();
        user.setId(1L);
        user.setMembershipStatus(membershipStatus);
        user.setMembershipExpiresAt(expiresAt);
        return user;
    }
}
