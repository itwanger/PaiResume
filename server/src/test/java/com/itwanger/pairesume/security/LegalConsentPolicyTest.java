package com.itwanger.pairesume.security;

import com.itwanger.pairesume.entity.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

class LegalConsentPolicyTest {

    @Test
    void previousPolicyVersionDoesNotBlockInternalAccess() {
        User user = acceptedUser("2026-07-23");

        assertFalse(LegalConsentPolicy.isRequired(user));
    }

    @Test
    void currentPolicyVersionSatisfiesConsentRequirement() {
        User user = acceptedUser(LegalConsentPolicy.CURRENT_VERSION);

        assertFalse(LegalConsentPolicy.isRequired(user));
    }

    @Test
    void missingConsentDoesNotBlockOrCreateAcceptanceRecords() {
        User user = new User();
        assertFalse(LegalConsentPolicy.isRequired(user));
        assertNull(user.getTermsAcceptedAt());
        assertNull(user.getPrivacyAcceptedAt());
        assertNull(user.getAiProcessingDisclosureVersion());
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
