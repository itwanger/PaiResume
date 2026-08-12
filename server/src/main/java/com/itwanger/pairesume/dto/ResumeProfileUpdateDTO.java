package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class ResumeProfileUpdateDTO {
    @NotNull(message = "个人资料不能为空")
    private Map<String, Object> content;
}
