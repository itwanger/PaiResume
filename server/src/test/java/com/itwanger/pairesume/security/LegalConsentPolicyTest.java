package com.itwanger.pairesume.security;

import com.itwanger.pairesume.entity.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LegalConsentPolicyTest {

    @Test
    void previousPolicyVersionRequiresRenewedConsent() {
        User user = acceptedUser("2026-07-23");

        assertTrue(LegalConsentPolicy.isRequired(user));
    }

    @Test
    void currentPolicyVersionSatisfiesConsentRequirement() {
        User user = acceptedUser(LegalConsentPolicy.CURRENT_VERSION);

        assertFalse(LegalConsentPolicy.isRequired(user));
    }

    private User acceptedUser(String version) {
        User user = new User();
        LocalDateTime acceptedAt = LocalDateTime.now();
        user.setTermsAcceptedAt(acceptedAt);
        user.setPrivacyAcceptedAt(acceptedAt);
        user.setTermsVersion(version);
        user.setPrivacyVersion(version);
        user.setAiProcessingDisclosureVersion(version);
        return user;
    }
}
