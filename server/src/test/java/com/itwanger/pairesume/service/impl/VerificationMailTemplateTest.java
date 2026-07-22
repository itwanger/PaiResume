package com.itwanger.pairesume.service.impl;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VerificationMailTemplateTest {

    @Test
    void validityTextComesFromConfiguredTtl() {
        VerificationMailTemplate.RenderedMail renderedMail = VerificationMailTemplate.render(
                "123456",
                600,
                "https://resume.paicoding.com/"
        );

        assertTrue(renderedMail.plainText().contains("10 分钟"));
        assertTrue(renderedMail.htmlText().contains("10 分钟"));
        assertTrue(renderedMail.htmlText().contains("href=\"https://resume.paicoding.com\""));
        assertFalse(renderedMail.htmlText().contains("https://resume.paicoding.com/\""));
    }

    @Test
    void invalidCodeAndUnsafePublicUrlAreRejected() {
        assertThrows(
                IllegalArgumentException.class,
                () -> VerificationMailTemplate.render(
                        "12345",
                        300,
                        "https://resume.paicoding.com"
                )
        );
        assertThrows(
                IllegalArgumentException.class,
                () -> VerificationMailTemplate.render(
                        "123456",
                        300,
                        "javascript:alert(1)"
                )
        );
    }
}
