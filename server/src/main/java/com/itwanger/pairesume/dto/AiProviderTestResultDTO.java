package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class AiProviderTestResultDTO {
    private boolean success;
    private int latencyMillis;
    private String message;
    private List<AiProviderModelOptionDTO> availableModels;
}
