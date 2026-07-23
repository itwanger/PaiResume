package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ResumeReviewFallbackCodeDTO {
    private Long id;
    private String code;
    private String codeHint;
    private String status;
    private String expiresAt;
    private String warning;
}
