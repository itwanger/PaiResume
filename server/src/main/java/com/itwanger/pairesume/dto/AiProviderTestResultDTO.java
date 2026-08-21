package com.itwanger.pairesume.dto;

import lombok.Data;

@Data
public class AiProviderTestResultDTO {
    private boolean success;
    private int latencyMillis;
    private String message;
}
