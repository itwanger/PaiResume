package com.itwanger.pairesume.security;

import com.itwanger.pairesume.entity.User;

/** Versions retained for historical consent records; internal access does not require re-consent. */
public final class LegalConsentPolicy {

    public static final String CURRENT_VERSION = "2026-07-24";

    private LegalConsentPolicy() {
    }

    public static boolean isRequired(User user) {
        // Do not fabricate acceptance timestamps or block login/invite redemption on old records.
        return false;
    }
}
