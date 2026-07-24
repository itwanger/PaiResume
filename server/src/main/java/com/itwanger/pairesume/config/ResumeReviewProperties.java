package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.resume-review")
public class ResumeReviewProperties {
    /** 总开关默认关闭；关闭时只保留历史查单、退款、回调和对账。 */
    private boolean enabled = false;
    /** 仅控制第二次及以后的付费新单，不影响旧单回调和首次免费额度。 */
    private boolean paidAcceptNewOrders = false;
    private int paymentOrderExpireMinutes = 30;
    private String recipientEmail;
    private String messageIdDomain = "resume.paicoding.com";
    private int mailOutboxMaxAttempts = 10;
}
