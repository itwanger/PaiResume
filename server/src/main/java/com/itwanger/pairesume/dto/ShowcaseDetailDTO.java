package com.itwanger.pairesume.dto;

import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.vo.ResumeCardPreviewVO;
import lombok.Data;

import java.util.List;

@Data
public class ShowcaseDetailDTO {
    private Long id;
    private String slug;
    private String title;
    private String pageMode;
    private String templateId;
    private String density;
    private String accentPreset;
    private String headingStyle;
    private String scoreLabel;
    private String summary;
    private String accessType;
    private Integer priceCents;
    private boolean paymentEnabled;
    private boolean locked;
    private ResumeCardPreviewVO preview;
    private List<ResumeModule> modules;
    private String updatedAt;
}
