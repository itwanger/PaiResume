package com.itwanger.pairesume.dto;

import lombok.Data;

@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"prompt", "systemPrompt"})
@Data
public class AiFieldOptimizeRequestDTO {
    private String fieldType;
    private Integer index;
    private String presetId;
}
