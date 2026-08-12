package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "resume_content_template", autoResultMap = true)
public class ResumeContentTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String title;
    private String summary;
    private String targetRole;
    private String careerStage;
    private String layoutTemplateId;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> modules;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tags;
    private String status;
    private String sourceType;
    private Integer version;
    private Long useCount;
    private Long createdBy;
    private Long updatedBy;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
