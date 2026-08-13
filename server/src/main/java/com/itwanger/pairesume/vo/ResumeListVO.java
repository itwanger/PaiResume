package com.itwanger.pairesume.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ResumeListVO {
    private Long id;
    private String title;
    private String pageMode;
    private String templateId;
    private String density;
    private String accentPreset;
    private String headingStyle;
    private ResumeCardPreviewVO preview;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
