package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class MembershipPlanDTO {
    private String code;
    private String name;
    private String entitlementType;
    private Integer membershipDays;
    private Integer priceCents;
    private boolean enabled;
    private boolean recommended;
}
