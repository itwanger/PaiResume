package com.itwanger.pairesume.dto;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class AiFieldOptimizeRecordDTO {
    private Long id;
    private String status;
    private String original;
    private String reasoning;
    private String streamedContent;
    private String optimized;
    private List<String> candidates;
    private List<List<String>> candidateTags;
    private String error;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
