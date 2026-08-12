package com.itwanger.pairesume.vo;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ResumeListVO {
    private Long id;
    private String title;
    private String templateId;
    private ResumeCardPreviewVO preview;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
