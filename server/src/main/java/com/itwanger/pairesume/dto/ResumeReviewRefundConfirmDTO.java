package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResumeReviewRefundConfirmDTO {
    @NotBlank @Size(max = 128)
    private String refundReference;
    @NotBlank @Size(max = 500)
    private String reason;
}
