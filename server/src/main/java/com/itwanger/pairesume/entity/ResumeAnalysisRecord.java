package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.itwanger.pairesume.dto.ResumeAnalysisIssueDTO;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName(value = "resume_analysis_record", autoResultMap = true)
public class ResumeAnalysisRecord {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private Long resumeId;

    private String scenarioCode;

    private String recordStatus;

    private Integer score;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<ResumeAnalysisIssueDTO> issues;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> suggestions;

    private String prompt;

    private String errorMessage;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
