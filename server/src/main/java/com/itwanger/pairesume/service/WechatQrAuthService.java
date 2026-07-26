package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.TokenDTO;
import com.itwanger.pairesume.dto.UserInfoDTO;
import com.itwanger.pairesume.dto.WechatChallengeCreateDTO;
import com.itwanger.pairesume.dto.LegalConsentDTO;
import com.itwanger.pairesume.dto.WechatChallengeStatusDTO;
import com.itwanger.pairesume.dto.WechatReauthProofDTO;

public interface WechatQrAuthService {
    String POLL_TOKEN_HEADER = "X-Wechat-Poll-Token";

    WechatChallengeCreateDTO createLoginChallenge(String clientIp);

    WechatChallengeCreateDTO createLoginChallenge(String clientIp, String claimToken);

    WechatChallengeStatusDTO pollLoginChallenge(String challengeId, String pollToken);

    TokenDTO exchangeLoginChallenge(String challengeId, String pollToken);

    TokenDTO exchangeLoginChallenge(
            String challengeId,
            String pollToken,
            LegalConsentDTO dto
    );

    WechatChallengeCreateDTO createBindChallenge(Long userId, String clientIp);

    WechatChallengeStatusDTO pollBindChallenge(Long userId, String challengeId, String pollToken);

    UserInfoDTO exchangeBindChallenge(Long userId, String challengeId, String pollToken);

    WechatChallengeCreateDTO createReauthChallenge(Long userId, String clientIp);

    WechatChallengeStatusDTO pollReauthChallenge(Long userId, String challengeId, String pollToken);

    WechatReauthProofDTO exchangeReauthChallenge(Long userId, String challengeId, String pollToken);

    void handleBridgeEvent(String timestamp, String nonce, String signature, byte[] rawBody);
}
