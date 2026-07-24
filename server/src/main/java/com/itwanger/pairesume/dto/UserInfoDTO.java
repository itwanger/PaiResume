package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class UserInfoDTO {
    private Long id;
    private String email;
    private String nickname;
    private String avatar;
    private String role;
    private String membershipStatus;
    private String membershipGrantedAt;
    private String membershipExpiresAt;
    private boolean admin;
    private boolean legalConsentRequired;
    private boolean marketplaceEnabled;
    private boolean resumeReviewEnabled;
    private boolean emailLoginEnabled;
    private boolean paicongmingLinked;
    private boolean paicongmingSubscribed;

    public UserInfoDTO(Long id, String email, String nickname, String avatar, String role,
                       String membershipStatus, String membershipGrantedAt,
                       String membershipExpiresAt, boolean admin) {
        this(id, email, nickname, avatar, role, membershipStatus, membershipGrantedAt,
                membershipExpiresAt, admin, false);
    }

    public UserInfoDTO(Long id, String email, String nickname, String avatar, String role,
                       String membershipStatus, String membershipGrantedAt,
                       String membershipExpiresAt, boolean admin, boolean legalConsentRequired) {
        this(id, email, nickname, avatar, role, membershipStatus, membershipGrantedAt,
                membershipExpiresAt, admin, legalConsentRequired, false);
    }

    public UserInfoDTO(Long id, String email, String nickname, String avatar, String role,
                       String membershipStatus, String membershipGrantedAt,
                       String membershipExpiresAt, boolean admin, boolean legalConsentRequired,
                       boolean marketplaceEnabled) {
        this(id, email, nickname, avatar, role, membershipStatus, membershipGrantedAt,
                membershipExpiresAt, admin, legalConsentRequired, marketplaceEnabled,
                email != null, false, false);
    }

    public UserInfoDTO(Long id, String email, String nickname, String avatar, String role,
                       String membershipStatus, String membershipGrantedAt,
                       String membershipExpiresAt, boolean admin, boolean legalConsentRequired,
                       boolean marketplaceEnabled, boolean emailLoginEnabled,
                       boolean paicongmingLinked, boolean paicongmingSubscribed) {
        this.id = id;
        this.email = email;
        this.nickname = nickname;
        this.avatar = avatar;
        this.role = role;
        this.membershipStatus = membershipStatus;
        this.membershipGrantedAt = membershipGrantedAt;
        this.membershipExpiresAt = membershipExpiresAt;
        this.admin = admin;
        this.legalConsentRequired = legalConsentRequired;
        this.marketplaceEnabled = marketplaceEnabled;
        this.emailLoginEnabled = emailLoginEnabled;
        this.paicongmingLinked = paicongmingLinked;
        this.paicongmingSubscribed = paicongmingSubscribed;
    }
}
