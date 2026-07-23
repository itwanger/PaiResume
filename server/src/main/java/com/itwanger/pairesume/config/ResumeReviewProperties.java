package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.resume-review")
public class ResumeReviewProperties {
    /** 仅控制第三次起的付费新单，不影响旧单回调和免费额度。 */
    private boolean paidAcceptNewOrders = false;
    private int paymentOrderExpireMinutes = 30;
    private String recipientEmail;
    private String messageIdDomain = "resume.paicoding.com";
    private String followOfficialAccountName = "沉默王二";
    private String followQrCodeUrl;
    private boolean followBridgeEnabled = false;
    private String followBridgeHmacSecret;
    private int followChallengeExpireMinutes = 30;
}
