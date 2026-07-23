package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.VipInviteClaimCreatedDTO;
import com.itwanger.pairesume.dto.VipInviteClaimResultDTO;

public interface VipInviteClaimService {

    VipInviteClaimCreatedDTO create(String code, String clientIp);

    Long attachToChallenge(String claimToken, String challengeId);

    void releaseChallenge(Long claimId, String challengeId);

    void bindUserAfterLogin(Long claimId, String challengeId, Long userId);

    VipInviteClaimResultDTO complete(Long userId, String claimToken);
}
