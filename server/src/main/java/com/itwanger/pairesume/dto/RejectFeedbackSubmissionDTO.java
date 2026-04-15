package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RejectFeedbackSubmissionDTO {
    @NotBlank(message = "请填写拒绝原因")
    private String reviewNote;
}
