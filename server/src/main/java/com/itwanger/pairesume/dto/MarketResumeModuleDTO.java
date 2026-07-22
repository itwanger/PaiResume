package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MarketResumeModuleDTO {
    private String moduleType;
    private Map<String, Object> content;
    private Integer sortOrder;
}
