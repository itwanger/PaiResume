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
import org.springframework.core.io.ByteArrayResource;

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
    public void sendPasswordResetCode(String email, String code) {
        ensureMailConfigured();
        PasswordResetMailTemplate.RenderedMail renderedMail = PasswordResetMailTemplate.render(
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

    @Override
    public void sendResumeReviewContactCode(String email, String code) {
        sendTextMail(email, "派简历人工精修联系邮箱验证码",
                "你正在验证人工精修联系邮箱，验证码为 " + code
                        + "，" + Math.max(1, verificationCodeTtlSeconds / 60) + " 分钟内有效。如非本人操作请忽略。");
    }

    @Override
    public void sendResumeReview(String recipientEmail, String messageId, String requestNo,
                                 String contactEmail, byte[] pdfContent, String fileName) {
        ensureMailConfigured();
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(mailFrom, "派简历");
            helper.setTo(recipientEmail);
            helper.setReplyTo(contactEmail);
            helper.setSubject("人工精修请求 " + requestNo);
            helper.setText("请查收用户确认上传并由派简历私有对象存储校验固化的 PDF。\n"
                    + "请求号：" + requestNo + "\n用户联系邮箱：" + contactEmail);
            helper.addAttachment(fileName, new ByteArrayResource(pdfContent), "application/pdf");
            message.setHeader("Message-ID", messageId);
            javaMailSender.send(message);
        } catch (Exception exception) {
            handleDeliveryFailure(recipientEmail, exception);
        }
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
