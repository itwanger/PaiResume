package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class FieldOptimizePromptConfigDTO {
    private String systemPrompt;
    private String descriptionPrompt;
    private String responsibilityPrompt;
    private String skillPrompt;
}
