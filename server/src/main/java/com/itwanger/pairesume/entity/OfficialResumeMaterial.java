package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "official_resume_material", autoResultMap = true)
public class OfficialResumeMaterial {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String moduleType;
    private String title;
    private String targetRole;
    private String careerStage;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> content;
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
