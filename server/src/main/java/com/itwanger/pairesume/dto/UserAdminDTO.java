package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class UserAdminDTO {
    private Long id;
    private String email;
    private String nickname;
    private String role;
    private String membershipStatus;
    private String membershipGrantedAt;
    private String membershipSource;
    private String createdAt;
}
