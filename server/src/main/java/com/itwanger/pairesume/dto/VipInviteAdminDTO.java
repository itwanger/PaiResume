package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class VipInviteAdminDTO {
    private Long id;
    private String code;
    private String status;
    private String remark;
    private Long createdBy;
    private Integer maxRedemptions;
    private Integer redeemedCount;
    private Integer membershipDays;
    private String expiresAt;
    private Long invalidatedBy;
    private String invalidatedAt;
    private String invalidateReason;
    private String createdAt;
}
