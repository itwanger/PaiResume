package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.service.MailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Slf4j
@Service
@RequiredArgsConstructor
public class MailServiceImpl implements MailService {
    private final JavaMailSender javaMailSender;

    @Value("${app.environment:development}")
    private String appEnvironment;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Override
    public void sendVerificationCode(String email, String code) {
        sendMail(
                email,
                "派简历注册验证码",
                "你的派简历验证码是 " + code + "，5 分钟内有效。如非本人操作，请忽略这封邮件。",
                "verification code " + code + " for " + email
        );
    }

    @Override
    public void sendCouponCode(String email, String couponCode, int amountCents) {
        String amountText = formatCents(amountCents);
        sendMail(
                email,
                "派简历优惠码",
                "感谢你提交派简历问卷。你的优惠码是 " + couponCode + "，可减免 " + amountText + "。支付功能上线前，如需开通会员，请联系管理员人工处理。",
                "coupon " + couponCode + " (" + amountText + ") for " + email
        );
    }

    private void sendMail(String email, String subject, String text, String fallbackLogText) {
        if (!StringUtils.hasText(mailUsername) || !StringUtils.hasText(mailPassword)) {
            fallbackOrThrow(fallbackLogText, null);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailUsername);
            message.setTo(email);
            message.setSubject(subject);
            message.setText(text);
            javaMailSender.send(message);
        } catch (Exception e) {
            fallbackOrThrow(fallbackLogText, e);
        }
    }

    private void fallbackOrThrow(String fallbackLogText, Exception error) {
        if ("development".equalsIgnoreCase(appEnvironment)) {
            if (error == null) {
                log.info("Mail fallback in development: {}", fallbackLogText);
            } else {
                log.warn("Mail send failed in development, fallback to log: {}", fallbackLogText, error);
            }
            return;
        }

        if (error == null) {
            throw new BusinessException(ResultCode.MAIL_NOT_CONFIGURED);
        }
        throw new BusinessException(ResultCode.MAIL_SEND_FAILED);
    }

    private String formatCents(int amountCents) {
        return String.format("¥%.2f", amountCents / 100.0);
    }
}
