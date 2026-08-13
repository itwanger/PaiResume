package com.itwanger.pairesume.vo;

import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class ResumeCardPreviewVO {
    private String name;
    private String targetRole;
    private String basicInfo;
    private String education;
    private String experience;
    private String project;
    private List<String> educations = List.of();
    private List<String> experiences = List.of();
    private List<ResumeCardProjectPreviewVO> projects = List.of();
    private List<String> skills = List.of();
    private Map<String, Integer> moduleCounts = Map.of();
    private Integer filledModuleCount = 0;
}
