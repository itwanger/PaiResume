package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ResumeAnalysisResultDTO {
    private int score;
    private List<ResumeAnalysisIssueDTO> issues = new ArrayList<>();
    private List<String> suggestions = new ArrayList<>();
}
