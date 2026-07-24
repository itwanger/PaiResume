package com.itwanger.pairesume.security;

import com.itwanger.pairesume.entity.User;

/**
 * Single source of truth for the legal documents that must be accepted before
 * an authenticated account may use protected product APIs.
 */
public final class LegalConsentPolicy {

    public static final String CURRENT_VERSION = "2026-07-24";

    private LegalConsentPolicy() {
    }

    public static boolean isRequired(User user) {
        return user == null
                || user.getTermsAcceptedAt() == null
                || user.getPrivacyAcceptedAt() == null
                || !CURRENT_VERSION.equals(user.getTermsVersion())
                || !CURRENT_VERSION.equals(user.getPrivacyVersion())
                || !CURRENT_VERSION.equals(user.getAiProcessingDisclosureVersion());
    }
}
