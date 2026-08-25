package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpgradeResumeReviewPriorityDTO {
    @NotNull
    @Min(1)
    @Max(100000)
    private Integer priorityFeeCents;
}
