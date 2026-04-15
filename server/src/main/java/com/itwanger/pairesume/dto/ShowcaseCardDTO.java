package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.List;

@Data
public class ShowcaseCardDTO {
    private Long id;
    private String slug;
    private String title;
    private String scoreLabel;
    private String summary;
    private List<String> tags;
    private String updatedAt;
}
