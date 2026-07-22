package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.CreateVipInviteDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.VipInviteCode;
import com.itwanger.pairesume.entity.VipInviteRedemption;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.mapper.VipInviteCodeMapper;
import com.itwanger.pairesume.mapper.VipInviteRedemptionMapper;
import com.itwanger.pairesume.service.MembershipAuditService;
import com.itwanger.pairesume.service.VipInviteRateLimitService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class VipInviteServiceImplTest {
    @Mock private VipInviteCodeMapper inviteMapper;
    @Mock private VipInviteRedemptionMapper redemptionMapper;
    @Mock private UserMapper userMapper;
    @Mock private MembershipAuditService membershipAuditService;
    @Mock private VipInviteRateLimitService vipInviteRateLimitService;

    private VipInviteServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new VipInviteServiceImpl(
                inviteMapper,
                redemptionMapper,
                userMapper,
                membershipAuditService,
                vipInviteRateLimitService
        );
    }

    @Test
    void createsReusableThirtyDayPlanetInviteWithLimits() {
        CreateVipInviteDTO request = new CreateVipInviteDTO();
        request.setRemark("  七月星球福利  ");
        request.setExpiresInDays(7);
        request.setMaxRedemptions(300);
        when(inviteMapper.insert(any(VipInviteCode.class))).thenAnswer(invocation -> {
            VipInviteCode invite = invocation.getArgument(0);
            invite.setId(9L);
            invite.setCreatedAt(LocalDateTime.now());
            return 1;
        });

        var result = service.create(1L, request);

        ArgumentCaptor<VipInviteCode> captor = ArgumentCaptor.forClass(VipInviteCode.class);
        verify(inviteMapper).insert(captor.capture());
        VipInviteCode invite = captor.getValue();
        assertTrue(invite.getCode().matches("VIP[A-HJ-NP-Z2-9]{10}"));
        assertEquals("ACTIVE", invite.getInviteStatus());
        assertEquals("七月星球福利", invite.getRemark());
        assertEquals(300, invite.getMaxRedemptions());
        assertEquals(0, invite.getRedeemedCount());
        assertEquals(30, invite.getMembershipDays());
        assertTrue(invite.getExpiresAt().isAfter(LocalDateTime.now().plusDays(6)));
        assertEquals(invite.getCode(), result.getCode());
    }

    @Test
    void redeemGrantsThirtyDayVipAndRecordsAuditEntry() {
        User user = freeUser();
        VipInviteCode invite = activeInvite(2, 0);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(redemptionMapper.selectCount(any(Wrapper.class))).thenReturn(0L);
        when(inviteMapper.selectByCodeForUpdate("VIPABC2345678")).thenReturn(invite);
        when(redemptionMapper.insert(any(VipInviteRedemption.class))).thenAnswer(invocation -> {
            VipInviteRedemption redemption = invocation.getArgument(0);
            redemption.setId(88L);
            return 1;
        });

        var result = service.redeem(7L, " vipabc2345678 ", "127.0.0.1");

        assertEquals("ACTIVE", user.getMembershipStatus());
        assertEquals("VIP_INVITE", user.getMembershipSource());
        assertEquals("VIP_INVITE", user.getMembershipOriginType());
        assertEquals(88L, user.getMembershipOriginId());
        assertNotNull(user.getMembershipExpiresAt());
        assertTrue(user.getMembershipExpiresAt().isAfter(LocalDateTime.now().plusDays(29)));
        verify(vipInviteRateLimitService).acquireAttempt("user@example.com", "127.0.0.1");
        verify(userMapper).updateMembership(user);

        ArgumentCaptor<VipInviteRedemption> redemptionCaptor = ArgumentCaptor.forClass(VipInviteRedemption.class);
        verify(redemptionMapper).insert(redemptionCaptor.capture());
        assertEquals(55L, redemptionCaptor.getValue().getInviteCodeId());
        assertEquals(7L, redemptionCaptor.getValue().getUserId());
        assertEquals("ACTIVE", redemptionCaptor.getValue().getRedemptionStatus());
        assertEquals(1, invite.getRedeemedCount());
        assertEquals("ACTIVE", invite.getInviteStatus());
        assertEquals("ACTIVE", result.getMembershipStatus());
        assertEquals("VIP_INVITE", result.getMembershipSource());
    }

    @Test
    void finalAvailablePlaceMarksCampaignExhausted() {
        User user = freeUser();
        VipInviteCode invite = activeInvite(1, 0);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(redemptionMapper.selectCount(any(Wrapper.class))).thenReturn(0L);
        when(inviteMapper.selectByCodeForUpdate("VIPABC2345678")).thenReturn(invite);

        service.redeem(7L, "VIPABC2345678", "127.0.0.1");

        assertEquals(1, invite.getRedeemedCount());
        assertEquals("EXHAUSTED", invite.getInviteStatus());
    }

    @Test
    void sameAccountCannotClaimInviteBenefitTwice() {
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(freeUser());
        when(redemptionMapper.selectCount(any(Wrapper.class))).thenReturn(1L);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.redeem(7L, "VIPABC2345678", "127.0.0.1")
        );

        assertEquals(ResultCode.VIP_INVITE_USER_ALREADY_REDEEMED.getCode(), exception.getCode());
        verify(vipInviteRateLimitService).acquireAttempt("user@example.com", "127.0.0.1");
        verifyNoInteractions(inviteMapper);
    }

    @Test
    void activeMemberCannotOverwriteExistingMembershipWithInvite() {
        User user = freeUser();
        user.setMembershipStatus("ACTIVE");
        user.setMembershipExpiresAt(LocalDateTime.now().plusDays(5));
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.redeem(7L, "VIPABC2345678", "127.0.0.1")
        );

        assertEquals(ResultCode.MEMBERSHIP_ALREADY_ACTIVE.getCode(), exception.getCode());
        verifyNoInteractions(inviteMapper, redemptionMapper);
    }

    @Test
    void expiredCampaignIsRejectedWithoutChangingUser() {
        User user = freeUser();
        VipInviteCode invite = activeInvite(100, 0);
        invite.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(redemptionMapper.selectCount(any(Wrapper.class))).thenReturn(0L);
        when(inviteMapper.selectByCodeForUpdate("VIPABC2345678")).thenReturn(invite);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.redeem(7L, "VIPABC2345678", "127.0.0.1")
        );

        assertEquals(ResultCode.VIP_INVITE_EXPIRED.getCode(), exception.getCode());
        verify(userMapper, never()).updateMembership(any(User.class));
        verify(redemptionMapper, never()).insert(any(VipInviteRedemption.class));
    }

    @Test
    void activeCampaignCanBeInvalidated() {
        VipInviteCode invite = activeInvite(100, 2);
        when(inviteMapper.selectByIdForUpdate(55L)).thenReturn(invite);

        var result = service.invalidate(55L, 1L, "邀请码已泄露");

        assertEquals("INVALID", invite.getInviteStatus());
        assertEquals(1L, invite.getInvalidatedBy());
        assertNotNull(invite.getInvalidatedAt());
        assertEquals("邀请码已泄露", invite.getInvalidateReason());
        assertEquals("INVALID", result.getStatus());
        verify(inviteMapper).updateById(invite);
        verify(membershipAuditService).record(
                eq(1L), eq("INVALIDATE_VIP_INVITE"), isNull(), isNull(),
                eq(55L), isNull(), eq("邀请码已泄露"), contains("不影响已兑换权益")
        );
        verifyNoInteractions(userMapper, redemptionMapper);
    }

    @Test
    void invalidatingCampaignDoesNotRevokeAnExistingInviteMembership() {
        VipInviteCode invite = activeInvite(100, 1);
        User existingMember = freeUser();
        existingMember.setMembershipStatus("ACTIVE");
        existingMember.setMembershipSource("VIP_INVITE");
        existingMember.setMembershipOriginType("VIP_INVITE");
        existingMember.setMembershipOriginId(88L);
        existingMember.setMembershipExpiresAt(LocalDateTime.now().plusDays(20));
        when(inviteMapper.selectByIdForUpdate(55L)).thenReturn(invite);

        service.invalidate(55L, 1L, "停止后续领取");

        assertEquals("ACTIVE", existingMember.getMembershipStatus());
        assertEquals("VIP_INVITE", existingMember.getMembershipOriginType());
        verifyNoInteractions(userMapper, redemptionMapper);
    }

    @Test
    void expiredActiveCampaignIsDisplayedAsExpired() {
        VipInviteCode invite = activeInvite(100, 1);
        invite.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        when(inviteMapper.selectList(any(Wrapper.class))).thenReturn(List.of(invite));

        var result = service.listInvites();

        assertEquals(1, result.size());
        assertEquals("EXPIRED", result.get(0).getStatus());
        assertEquals("ACTIVE", invite.getInviteStatus());
    }

    @Test
    void revokeRedemptionRevokesOnlyItsCurrentInviteMembership() {
        VipInviteRedemption redemption = activeRedemption();
        User user = freeUser();
        user.setMembershipStatus("ACTIVE");
        user.setMembershipSource("ADMIN_EXTENDED");
        user.setMembershipOriginType("VIP_INVITE");
        user.setMembershipOriginId(88L);
        user.setMembershipGrantedAt(LocalDateTime.now().minusDays(2));
        user.setMembershipExpiresAt(LocalDateTime.now().plusDays(28));
        when(redemptionMapper.selectByIdForUpdate(55L, 88L)).thenReturn(redemption);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(userMapper.selectById(7L)).thenReturn(user);

        var result = service.revokeRedemption(55L, 88L, 1L, "发现邀请码外泄领取");

        assertEquals("REVOKED", redemption.getRedemptionStatus());
        assertEquals(1L, redemption.getRevokedBy());
        assertNotNull(redemption.getRevokedAt());
        assertEquals("发现邀请码外泄领取", redemption.getRevokeReason());
        assertEquals("REVOKED", result.getRedemptionStatus());
        assertEquals("FREE", user.getMembershipStatus());
        assertEquals("ADMIN_REVOKED", user.getMembershipSource());
        assertNull(user.getMembershipGrantedAt());
        assertNull(user.getMembershipOriginType());
        assertNull(user.getMembershipOriginId());
        assertNull(user.getMembershipExpiresAt());
        verify(userMapper).updateMembership(user);
        verify(redemptionMapper).updateById(redemption);
        verifyNoInteractions(inviteMapper);
        verify(membershipAuditService).record(
                eq(1L), eq("REVOKE_VIP_INVITE_REDEMPTION"), any(User.class), same(user),
                eq(55L), eq(88L), eq("发现邀请码外泄领取"), contains("已撤销")
        );
    }

    @Test
    void revokeOldInviteRedemptionPreservesMembershipFromAnotherSource() {
        VipInviteRedemption redemption = activeRedemption();
        User user = freeUser();
        user.setMembershipStatus("ACTIVE");
        user.setMembershipSource("PAYMENT");
        user.setMembershipOriginType("PAYMENT");
        user.setMembershipOriginId(900L);
        user.setMembershipGrantedAt(LocalDateTime.now().minusDays(1));
        user.setMembershipExpiresAt(LocalDateTime.now().plusDays(365));
        LocalDateTime originalExpiration = user.getMembershipExpiresAt();
        when(redemptionMapper.selectByIdForUpdate(55L, 88L)).thenReturn(redemption);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        when(userMapper.selectById(7L)).thenReturn(user);

        service.revokeRedemption(55L, 88L, 1L, "旧邀请码记录异常");

        assertEquals("REVOKED", redemption.getRedemptionStatus());
        assertEquals("ACTIVE", user.getMembershipStatus());
        assertEquals("PAYMENT", user.getMembershipOriginType());
        assertEquals(900L, user.getMembershipOriginId());
        assertEquals(originalExpiration, user.getMembershipExpiresAt());
        verify(userMapper, never()).updateMembership(any(User.class));
        verify(redemptionMapper).updateById(redemption);
        verify(membershipAuditService).record(
                eq(1L), eq("REVOKE_VIP_INVITE_REDEMPTION"), any(User.class), same(user),
                eq(55L), eq(88L), eq("旧邀请码记录异常"), contains("未撤销当前权益")
        );
    }

    @Test
    void alreadyRevokedRedemptionCannotBeRevokedAgain() {
        VipInviteRedemption redemption = activeRedemption();
        redemption.setRedemptionStatus("REVOKED");
        when(redemptionMapper.selectByIdForUpdate(55L, 88L)).thenReturn(redemption);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.revokeRedemption(55L, 88L, 1L, "重复撤销")
        );

        assertEquals(ResultCode.VIP_INVITE_REDEMPTION_ALREADY_REVOKED.getCode(), exception.getCode());
        verifyNoInteractions(userMapper, membershipAuditService);
        verify(redemptionMapper, never()).updateById(any(VipInviteRedemption.class));
    }

    private User freeUser() {
        User user = new User();
        user.setId(7L);
        user.setEmail("user@example.com");
        user.setMembershipStatus("FREE");
        return user;
    }

    private VipInviteCode activeInvite(int maxRedemptions, int redeemedCount) {
        VipInviteCode invite = new VipInviteCode();
        invite.setId(55L);
        invite.setCode("VIPABC2345678");
        invite.setInviteStatus("ACTIVE");
        invite.setRemark("知识星球");
        invite.setCreatedBy(1L);
        invite.setMaxRedemptions(maxRedemptions);
        invite.setRedeemedCount(redeemedCount);
        invite.setMembershipDays(30);
        invite.setExpiresAt(LocalDateTime.now().plusDays(7));
        invite.setCreatedAt(LocalDateTime.now());
        return invite;
    }

    private VipInviteRedemption activeRedemption() {
        VipInviteRedemption redemption = new VipInviteRedemption();
        redemption.setId(88L);
        redemption.setInviteCodeId(55L);
        redemption.setUserId(7L);
        redemption.setMembershipStartedAt(LocalDateTime.now().minusDays(2));
        redemption.setMembershipExpiresAt(LocalDateTime.now().plusDays(28));
        redemption.setRedemptionStatus("ACTIVE");
        redemption.setRedeemedAt(LocalDateTime.now().minusDays(2));
        return redemption;
    }
}
