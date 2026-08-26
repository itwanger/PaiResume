package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class UserAdminDTO {
    private Long id;
    private String email;
    private String nickname;
    private String avatar;
    private String accountType;
    private String wechatIdentifier;
    private Boolean wechatSubscribed;
    private String lastLoginAt;
    private String membershipStatus;
    private String membershipGrantedAt;
    private String membershipExpiresAt;
    private String membershipSource;
    private String createdAt;
}
