package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "user_resume_material", autoResultMap = true)
public class UserResumeMaterial {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String moduleType;
    private String title;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Map<String, Object> content;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tags;
    private String status;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
