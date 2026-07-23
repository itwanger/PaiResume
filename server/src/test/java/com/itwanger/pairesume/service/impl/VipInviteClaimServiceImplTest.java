package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.Wrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.VipInviteClaimProperties;
import com.itwanger.pairesume.dto.VipInviteRedemptionDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.VipInviteClaim;
import com.itwanger.pairesume.entity.VipInviteCode;
import com.itwanger.pairesume.entity.VipInviteRedemption;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.mapper.VipInviteClaimMapper;
import com.itwanger.pairesume.mapper.VipInviteCodeMapper;
import com.itwanger.pairesume.mapper.VipInviteRedemptionMapper;
import com.itwanger.pairesume.security.LegalConsentPolicy;
import com.itwanger.pairesume.service.VipInviteRateLimitService;
import com.itwanger.pairesume.service.VipInviteService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VipInviteClaimServiceImplTest {

    @Mock private VipInviteClaimMapper claimMapper;
    @Mock private VipInviteCodeMapper inviteCodeMapper;
    @Mock private VipInviteRedemptionMapper redemptionMapper;
    @Mock private UserMapper userMapper;
    @Mock private VipInviteService vipInviteService;
    @Mock private VipInviteRateLimitService rateLimitService;

    private VipInviteClaimServiceImpl service;

    @BeforeEach
    void setUp() {
        VipInviteClaimProperties properties = new VipInviteClaimProperties();
        properties.setTtlSeconds(600);
        org.mockito.Mockito.lenient().when(
                claimMapper.updateById(any(VipInviteClaim.class))
        ).thenReturn(1);
        service = new VipInviteClaimServiceImpl(
                claimMapper,
                inviteCodeMapper,
                redemptionMapper,
                userMapper,
                vipInviteService,
                rateLimitService,
                properties
        );
    }

    @Test
    void createValidatesWithoutReservingQuotaAndStoresOnlyHashesAndInviteId() {
        VipInviteCode invite = activeInvite();
        when(inviteCodeMapper.selectByCode("VIPPLANET123")).thenReturn(invite);
        when(claimMapper.insert(any(VipInviteClaim.class))).thenReturn(1);

        var result = service.create(" vipplanet123 ", "203.0.113.8");

        assertTrue(result.getClaimToken().matches("[A-Za-z0-9_-]{43}"));
        assertEquals(VipInviteClaimServiceImpl.AWAITING_IDENTITY, result.getStatus());
        assertEquals(600, result.getExpiresIn());
        verify(rateLimitService).acquireIpAttempt("203.0.113.8");
        verify(rateLimitService, never()).acquireAttempt(any(), any());

        ArgumentCaptor<VipInviteClaim> captor = ArgumentCaptor.forClass(VipInviteClaim.class);
        verify(claimMapper).insert(captor.capture());
        VipInviteClaim persisted = captor.getValue();
        assertEquals(55L, persisted.getInviteCodeId());
        assertEquals(64, persisted.getTokenHash().length());
        assertNotEquals(result.getClaimToken(), persisted.getTokenHash());
        assertFalse(persisted.getTokenHash().contains("VIPPLANET123"));
        assertNull(persisted.getUserId());
        assertEquals(0, invite.getRedeemedCount());
        verify(inviteCodeMapper, never()).updateById(any(VipInviteCode.class));
    }

    @Test
    void createUsesOneGenericErrorForUnavailableCampaign() {
        VipInviteCode exhausted = activeInvite();
        exhausted.setRedeemedCount(exhausted.getMaxRedemptions());
        when(inviteCodeMapper.selectByCode("VIPPLANET123")).thenReturn(exhausted);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.create("VIPPLANET123", "203.0.113.8")
        );

        assertEquals(ResultCode.VIP_INVITE_CLAIM_INVALID.getCode(), exception.getCode());
        verify(claimMapper, never()).insert(any(VipInviteClaim.class));
    }

    @Test
    void attachBindsOneChallengeByHashAndNeverPersistsRawTokens() {
        String claimToken = "A".repeat(43);
        String challengeId = "B".repeat(43);
        VipInviteClaim claim = awaitingClaim();
        when(claimMapper.selectByTokenHashForUpdate(any())).thenReturn(claim);

        Long claimId = service.attachToChallenge(claimToken, challengeId);

        assertEquals(91L, claimId);
        assertNotNull(claim.getChallengeIdHash());
        assertEquals(64, claim.getChallengeIdHash().length());
        assertNotEquals(challengeId, claim.getChallengeIdHash());
        assertNotEquals(claimToken, claim.getTokenHash());
        verify(claimMapper).updateById(claim);
    }

    @Test
    void refreshingQrRebindsAnUnclaimedClaimAndOnlyTheNewestChallengeCanBindUser() {
        String firstChallenge = "B".repeat(43);
        String freshChallenge = "C".repeat(43);
        VipInviteClaim claim = awaitingClaim();
        when(claimMapper.selectByTokenHashForUpdate(any())).thenReturn(claim);

        service.attachToChallenge("A".repeat(43), firstChallenge);
        String firstHash = claim.getChallengeIdHash();
        service.attachToChallenge("A".repeat(43), freshChallenge);
        String freshHash = claim.getChallengeIdHash();

        assertNotEquals(firstHash, freshHash);
        when(claimMapper.selectByIdForUpdate(91L)).thenReturn(claim);
        service.bindUserAfterLogin(91L, firstChallenge, 7L);
        assertNull(claim.getUserId());

        when(userMapper.selectById(7L)).thenReturn(activeUser(true));
        service.bindUserAfterLogin(91L, freshChallenge, 7L);

        assertEquals(7L, claim.getUserId());
        assertEquals(VipInviteClaimServiceImpl.PENDING_REDEMPTION, claim.getClaimStatus());
        verify(claimMapper, times(3)).updateById(claim);
    }

    @Test
    void aBoundClaimCannotMoveToAnotherUser() {
        VipInviteClaim claim = awaitingClaim();
        claim.setChallengeIdHash(sha256ForTest("B".repeat(43)));
        claim.setUserId(7L);
        claim.setClaimStatus(VipInviteClaimServiceImpl.PENDING_REDEMPTION);
        when(claimMapper.selectByIdForUpdate(91L)).thenReturn(claim);

        service.bindUserAfterLogin(91L, "B".repeat(43), 8L);

        assertEquals(7L, claim.getUserId());
        verify(userMapper, never()).selectById(any());
        verify(claimMapper, never()).updateById(any(VipInviteClaim.class));
    }

    @Test
    void loginBindingWaitsForCurrentLegalConsent() {
        VipInviteClaim claim = awaitingClaim();
        claim.setChallengeIdHash(sha256ForTest("B".repeat(43)));
        when(claimMapper.selectByIdForUpdate(91L)).thenReturn(claim);
        User user = activeUser(false);
        when(userMapper.selectById(7L)).thenReturn(user);

        service.bindUserAfterLogin(91L, "B".repeat(43), 7L);

        assertEquals(7L, claim.getUserId());
        assertEquals(VipInviteClaimServiceImpl.PENDING_CONSENT, claim.getClaimStatus());
        assertNotNull(claim.getBoundAt());
        verify(claimMapper).updateById(claim);
    }

    @Test
    @SuppressWarnings("unchecked")
    void completeIsAtomicAndRetryReturnsTheSameRedemptionWithoutConsumingTwice() {
        String token = "A".repeat(43);
        VipInviteClaim claim = awaitingClaim();
        claim.setUserId(7L);
        claim.setClaimStatus(VipInviteClaimServiceImpl.PENDING_CONSENT);
        when(claimMapper.selectByTokenHashForUpdate(any())).thenReturn(claim);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(activeUser(true));
        VipInviteRedemptionDTO granted = new VipInviteRedemptionDTO(
                "ACTIVE", "2026-07-23 10:00:00", "2026-08-22 10:00:00", "VIP_INVITE"
        );
        when(vipInviteService.redeemClaim(7L, 55L)).thenReturn(granted);
        VipInviteRedemption record = redemption();
        when(redemptionMapper.selectOne(any(Wrapper.class))).thenReturn(record);
        when(redemptionMapper.selectById(88L)).thenReturn(record);

        var first = service.complete(7L, token);
        var retry = service.complete(7L, token);

        assertEquals(VipInviteClaimServiceImpl.REDEEMED, first.getStatus());
        assertEquals(VipInviteClaimServiceImpl.REDEEMED, retry.getStatus());
        assertEquals(first.getRedemption().getMembershipExpiresAt(),
                retry.getRedemption().getMembershipExpiresAt());
        assertEquals(88L, claim.getRedemptionId());
        verify(vipInviteService, times(1)).redeemClaim(7L, 55L);
        verify(claimMapper, times(1)).updateById(claim);
    }

    @Test
    void completePersistsGenericFailureWithoutConsumingInviteWhenCampaignChanged() {
        VipInviteClaim claim = awaitingClaim();
        claim.setUserId(7L);
        claim.setClaimStatus(VipInviteClaimServiceImpl.PENDING_REDEMPTION);
        when(claimMapper.selectByTokenHashForUpdate(any())).thenReturn(claim);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(activeUser(true));
        when(vipInviteService.redeemClaim(7L, 55L))
                .thenThrow(new BusinessException(ResultCode.VIP_INVITE_EXHAUSTED));

        var result = service.complete(7L, "A".repeat(43));

        assertEquals(VipInviteClaimServiceImpl.FAILED, result.getStatus());
        assertNull(result.getRedemption());
        assertFalse(result.getMessage().contains("名额"));
        assertEquals("REDEMPTION_REJECTED_7014", claim.getFailureCode());
        verify(claimMapper).updateById(claim);
    }

    @Test
    void completeRejectsAUserDifferentFromTheImmutableBinding() {
        VipInviteClaim claim = awaitingClaim();
        claim.setUserId(7L);
        claim.setClaimStatus(VipInviteClaimServiceImpl.PENDING_REDEMPTION);
        when(claimMapper.selectByTokenHashForUpdate(any())).thenReturn(claim);

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> service.complete(8L, "A".repeat(43))
        );

        assertEquals(ResultCode.VIP_INVITE_CLAIM_FORBIDDEN.getCode(), exception.getCode());
        verify(userMapper, never()).selectByIdForUpdate(any());
        verify(vipInviteService, never()).redeemClaim(any(), any());
    }

    private VipInviteCode activeInvite() {
        VipInviteCode invite = new VipInviteCode();
        invite.setId(55L);
        invite.setCode("VIPPLANET123");
        invite.setInviteStatus("ACTIVE");
        invite.setMaxRedemptions(100);
        invite.setRedeemedCount(0);
        invite.setMembershipDays(30);
        invite.setExpiresAt(LocalDateTime.now().plusDays(7));
        return invite;
    }

    private VipInviteClaim awaitingClaim() {
        VipInviteClaim claim = new VipInviteClaim();
        claim.setId(91L);
        claim.setTokenHash("f".repeat(64));
        claim.setInviteCodeId(55L);
        claim.setClaimStatus(VipInviteClaimServiceImpl.AWAITING_IDENTITY);
        claim.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        return claim;
    }

    private User activeUser(boolean consentAccepted) {
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        if (consentAccepted) {
            LocalDateTime acceptedAt = LocalDateTime.now();
            user.setTermsAcceptedAt(acceptedAt);
            user.setPrivacyAcceptedAt(acceptedAt);
            user.setTermsVersion(LegalConsentPolicy.CURRENT_VERSION);
            user.setPrivacyVersion(LegalConsentPolicy.CURRENT_VERSION);
            user.setAiProcessingDisclosureVersion(LegalConsentPolicy.CURRENT_VERSION);
        }
        return user;
    }

    private VipInviteRedemption redemption() {
        VipInviteRedemption record = new VipInviteRedemption();
        record.setId(88L);
        record.setInviteCodeId(55L);
        record.setUserId(7L);
        record.setMembershipStartedAt(LocalDateTime.of(2026, 7, 23, 10, 0));
        record.setMembershipExpiresAt(LocalDateTime.of(2026, 8, 22, 10, 0));
        record.setRedemptionStatus("ACTIVE");
        return record;
    }

    private String sha256ForTest(String value) {
        try {
            byte[] digest = java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new AssertionError(exception);
        }
    }
}
