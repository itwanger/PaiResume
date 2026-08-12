package com.itwanger.pairesume.vo;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
public class ResumeHistoryMaterialVO {
    private String key;
    private String moduleType;
    private String title;
    private Map<String, Object> content;
    /** HISTORY_RESUME / LEGACY_LIBRARY / LEGACY_PROFILE */
    private String sourceType;
    private Long sourceResumeId;
    private String sourceResumeTitle;
    private Long legacyMaterialId;
    private LocalDateTime updatedAt;
}
