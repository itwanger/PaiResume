package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "resume_showcase", autoResultMap = true)
public class ResumeShowcase {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long resumeId;

    private String slug;

    private String scoreLabel;

    private String summary;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tags;

    private Integer displayOrder;

    private String publishStatus;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
