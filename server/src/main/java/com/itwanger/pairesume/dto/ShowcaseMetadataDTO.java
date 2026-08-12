package com.itwanger.pairesume.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class ShowcaseMetadataDTO {
    private String displayLabel;
    private String summary;
    private List<String> tags = new ArrayList<>();
}
