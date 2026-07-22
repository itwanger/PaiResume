package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.service.MailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import jakarta.mail.internet.MimeMessage;
import java.nio.charset.StandardCharsets;

@Slf4j
@Service
@RequiredArgsConstructor
public class MailServiceImpl implements MailService {
    private final JavaMailSender javaMailSender;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${app.mail.from:${spring.mail.username:}}")
    private String mailFrom;

    @Value("${app.public-url:https://resume.paicoding.com}")
    private String publicUrl;

    @Value("${app.verification-code.ttl-seconds:300}")
    private int verificationCodeTtlSeconds;

    @Override
    public void sendVerificationCode(String email, String code) {
        ensureMailConfigured();
        VerificationMailTemplate.RenderedMail renderedMail = VerificationMailTemplate.render(
                code,
                verificationCodeTtlSeconds,
                publicUrl
        );

        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    MimeMessageHelper.MULTIPART_MODE_MIXED_RELATED,
                    StandardCharsets.UTF_8.name()
            );
            helper.setFrom(mailFrom, "派简历");
            helper.setTo(email);
            helper.setSubject(renderedMail.subject());
            helper.setText(renderedMail.plainText(), renderedMail.htmlText());
            javaMailSender.send(message);
        } catch (Exception exception) {
            handleDeliveryFailure(email, exception);
        }
    }

    @Override
    public void sendCouponCode(String email, String couponCode, int amountCents) {
        String amountText = formatCents(amountCents);
        sendTextMail(
                email,
                "派简历优惠码",
                "感谢你提交派简历问卷。你的优惠码是 " + couponCode + "，可减免 " + amountText + "。支付功能上线前，如需开通会员，请联系管理员人工处理。"
        );
    }

    private void sendTextMail(String email, String subject, String text) {
        ensureMailConfigured();

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(email);
            message.setSubject(subject);
            message.setText(text);
            javaMailSender.send(message);
        } catch (Exception exception) {
            handleDeliveryFailure(email, exception);
        }
    }

    private void ensureMailConfigured() {
        if (!StringUtils.hasText(mailUsername)
                || !StringUtils.hasText(mailPassword)
                || !StringUtils.hasText(mailFrom)) {
            throw new BusinessException(ResultCode.MAIL_NOT_CONFIGURED);
        }
    }

    private void handleDeliveryFailure(String email, Exception exception) {
        log.warn("Mail delivery failed for recipient {}, type={}",
                maskEmail(email), exception.getClass().getSimpleName());
        throw new BusinessException(ResultCode.MAIL_SEND_FAILED);
    }

    private String formatCents(int amountCents) {
        return String.format("¥%.2f", amountCents / 100.0);
    }

    private String maskEmail(String email) {
        int atIndex = email.indexOf('@');
        if (atIndex <= 1) {
            return "***";
        }
        return email.charAt(0) + "***" + email.substring(atIndex);
    }
}
