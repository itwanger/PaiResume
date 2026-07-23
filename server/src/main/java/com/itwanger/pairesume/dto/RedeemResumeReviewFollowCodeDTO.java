package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RedeemResumeReviewFollowCodeDTO {
    @NotBlank @Size(max = 64)
    private String code;
}
