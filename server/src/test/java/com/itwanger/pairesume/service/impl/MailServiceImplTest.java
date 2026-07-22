package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import jakarta.mail.Message;
import jakarta.mail.Multipart;
import jakarta.mail.Part;
import jakarta.mail.Session;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MailServiceImplTest {

    @Mock
    private JavaMailSender mailSender;
    private MailServiceImpl mailService;
    private MimeMessage mimeMessage;

    @BeforeEach
    void setUp() {
        mailService = new MailServiceImpl(mailSender);
        mimeMessage = new MimeMessage(Session.getInstance(new Properties()));
        lenient().when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
        ReflectionTestUtils.setField(mailService, "mailUsername", "sender@example.com");
        ReflectionTestUtils.setField(mailService, "mailPassword", "smtp-secret");
        ReflectionTestUtils.setField(mailService, "mailFrom", "sender@example.com");
        ReflectionTestUtils.setField(mailService, "publicUrl", "https://resume.paicoding.com");
        ReflectionTestUtils.setField(mailService, "verificationCodeTtlSeconds", 300);
    }

    @Test
    void verificationMailContainsPlainTextAndHtmlAlternatives() throws Exception {
        mailService.sendVerificationCode("recipient@example.com", "123456");

        verify(mailSender).send(same(mimeMessage));
        mimeMessage.saveChanges();

        assertEquals("recipient@example.com",
                ((InternetAddress) mimeMessage.getRecipients(Message.RecipientType.TO)[0]).getAddress());
        InternetAddress from = (InternetAddress) mimeMessage.getFrom()[0];
        assertEquals("sender@example.com", from.getAddress());
        assertEquals("派简历", from.getPersonal());
        assertEquals(VerificationMailTemplate.SUBJECT, mimeMessage.getSubject());
        assertFalse(mimeMessage.getSubject().contains("123456"));

        List<String> plainParts = new ArrayList<>();
        List<String> htmlParts = new ArrayList<>();
        collectTextParts(mimeMessage, plainParts, htmlParts);

        assertEquals(1, plainParts.size());
        assertEquals(1, htmlParts.size());
        String plainText = plainParts.get(0);
        String htmlText = htmlParts.get(0);
        assertTrue(plainText.contains("123456"));
        assertTrue(plainText.contains("5 分钟"));
        assertTrue(plainText.contains("https://resume.paicoding.com"));
        assertFalse(plainText.contains("<html"));

        assertTrue(htmlText.contains("123456"));
        assertTrue(htmlText.contains("5 分钟"));
        assertTrue(htmlText.contains("安全提醒"));
        assertTrue(htmlText.contains("href=\"https://resume.paicoding.com\""));
        assertTrue(htmlText.contains("<table"));
        assertEquals(1, countOccurrences(htmlText, "123456"));

        String lowercaseHtml = htmlText.toLowerCase(Locale.ROOT);
        for (String unsafeMarkup : List.of(
                "<script", "<form", "<iframe", "<object", "javascript:", "data:", "http://"
        )) {
            assertFalse(lowercaseHtml.contains(unsafeMarkup), unsafeMarkup);
        }
    }

    @Test
    void missingCredentialsFailClosed() {
        ReflectionTestUtils.setField(mailService, "mailPassword", "");

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> mailService.sendVerificationCode("recipient@example.com", "123456")
        );

        assertEquals(ResultCode.MAIL_NOT_CONFIGURED.getCode(), exception.getCode());
        verifyNoInteractions(mailSender);
    }

    @Test
    void invalidVerificationCodeIsRejectedBeforeSending() {
        assertThrows(
                IllegalArgumentException.class,
                () -> mailService.sendVerificationCode("recipient@example.com", "12A456")
        );

        verifyNoInteractions(mailSender);
    }

    @Test
    void smtpFailureIsReported() {
        doThrow(new MailSendException("rejected"))
                .when(mailSender).send(any(MimeMessage.class));

        BusinessException exception = assertThrows(
                BusinessException.class,
                () -> mailService.sendVerificationCode("recipient@example.com", "123456")
        );

        assertEquals(ResultCode.MAIL_SEND_FAILED.getCode(), exception.getCode());
    }

    private void collectTextParts(
            Part part,
            List<String> plainParts,
            List<String> htmlParts
    ) throws Exception {
        if (part.isMimeType("text/plain")) {
            plainParts.add(part.getContent().toString());
            return;
        }
        if (part.isMimeType("text/html")) {
            htmlParts.add(part.getContent().toString());
            return;
        }
        Object content = part.getContent();
        if (content instanceof Multipart multipart) {
            for (int index = 0; index < multipart.getCount(); index++) {
                collectTextParts(multipart.getBodyPart(index), plainParts, htmlParts);
            }
        }
    }

    private int countOccurrences(String text, String value) {
        int count = 0;
        int index = 0;
        while ((index = text.indexOf(value, index)) >= 0) {
            count++;
            index += value.length();
        }
        return count;
    }
}
