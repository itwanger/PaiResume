package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ResumePhotoOssTestResultDTO {
    private boolean success;
    private int latencyMillis;
    private String message;
}
