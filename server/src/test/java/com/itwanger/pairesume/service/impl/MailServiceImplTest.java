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
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
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

    @ParameterizedTest
    @EnumSource(VerificationMailTemplate.Purpose.class)
    void everyCodeMailKeepsCodeIsolatedInBothAlternatives(VerificationMailTemplate.Purpose purpose) throws Exception {
        ReflectionTestUtils.setField(mailService, "verificationCodeTtlSeconds", 90);
        switch (purpose) {
            case REGISTER -> mailService.sendVerificationCode("recipient@example.com", "012345");
            case BIND_EMAIL -> mailService.sendEmailBindingCode("recipient@example.com", "012345");
            case REVIEW_CONTACT -> mailService.sendResumeReviewContactCode("recipient@example.com", "012345");
            case RESET_PASSWORD -> mailService.sendPasswordResetCode("recipient@example.com", "012345");
        }
        verify(mailSender).send(same(mimeMessage));
        mimeMessage.saveChanges();
        assertEquals(purpose.subject, mimeMessage.getSubject());
        assertEquals("recipient@example.com",
                ((InternetAddress) mimeMessage.getRecipients(Message.RecipientType.TO)[0]).getAddress());
        assertEquals("派简历", ((InternetAddress) mimeMessage.getFrom()[0]).getPersonal());
        List<String> plainParts = new ArrayList<>();
        List<String> htmlParts = new ArrayList<>();
        collectTextParts(mimeMessage, plainParts, htmlParts);
        assertEquals(1, plainParts.size());
        assertEquals(1, htmlParts.size());
        String plain = plainParts.get(0);
        String html = htmlParts.get(0);
        assertTrue(plain.contains("\n\n012345\n\n"));
        assertTrue(html.contains(">012345</div>"));
        assertEquals(1, countOccurrences(plain, "012345"));
        assertEquals(1, countOccurrences(html, "012345"));
        assertTrue(plain.contains("90 秒"));
        assertTrue(html.contains("90 秒"));
        assertTrue(plain.contains(purpose.description));
        assertTrue(html.contains(purpose.description));
        assertFalse(html.contains("{{"));
        if (purpose == VerificationMailTemplate.Purpose.RESET_PASSWORD) {
            assertTrue(plain.contains("已登录设备会全部退出"));
            assertTrue(html.contains("已登录设备会全部退出"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"recipient@example.com", "applicant+review@example.com"})
    void resumeReviewPreservesReplyTargetAndAttachmentAfterMimeSerialization(String contactEmail) throws Exception {
        byte[] pdf = "%PDF-1.4 test attachment".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        mailService.sendResumeReview("recipient@example.com", "<review-RR123@example.com>",
                "RR123", contactEmail, pdf, "简历.pdf");
        verify(mailSender).send(same(mimeMessage));
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
        mimeMessage.writeTo(bytes);
        MimeMessage received = new MimeMessage(Session.getInstance(new Properties()),
                new java.io.ByteArrayInputStream(bytes.toByteArray()));
        assertEquals("sender@example.com", ((InternetAddress) received.getFrom()[0]).getAddress());
        assertEquals(contactEmail, ((InternetAddress) received.getReplyTo()[0]).getAddress());
        assertEquals("recipient@example.com",
                ((InternetAddress) received.getRecipients(Message.RecipientType.TO)[0]).getAddress());
        List<String> plainParts = new ArrayList<>();
        List<String> htmlParts = new ArrayList<>();
        collectTextParts(received, plainParts, htmlParts);
        assertEquals(1, plainParts.size());
        assertTrue(plainParts.get(0).contains("用户联系邮箱：" + contactEmail));
        assertTrue(plainParts.get(0).contains("请求号：RR123"));
        Part attachment = findAttachment(received);
        assertNotNull(attachment);
        assertTrue(attachment.isMimeType("application/pdf"));
        assertEquals("简历.pdf", attachment.getFileName());
        assertArrayEquals(pdf, attachment.getInputStream().readAllBytes());
    }

    private Part findAttachment(Part part) throws Exception {
        if (Part.ATTACHMENT.equalsIgnoreCase(part.getDisposition())) return part;
        if (part.getContent() instanceof Multipart multipart) {
            for (int i = 0; i < multipart.getCount(); i++) {
                Part found = findAttachment(multipart.getBodyPart(i));
                if (found != null) return found;
            }
        }
        return null;
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
