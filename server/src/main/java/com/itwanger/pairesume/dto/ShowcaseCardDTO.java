package com.itwanger.pairesume.dto;

import com.itwanger.pairesume.vo.ResumeCardPreviewVO;
import lombok.Data;

@Data
public class ShowcaseCardDTO {
    private Long id;
    private String slug;
    private String title;
    private String scoreLabel;
    private String summary;
    private String accessType;
    private Integer priceCents;
    private String pageMode;
    private String templateId;
    private String density;
    private String accentPreset;
    private String headingStyle;
    private ResumeCardPreviewVO preview;
    private String updatedAt;
}
