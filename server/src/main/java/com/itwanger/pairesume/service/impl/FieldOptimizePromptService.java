package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.FieldOptimizePromptConfigDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FieldOptimizePromptService {
    private final JdbcTemplate jdbc;

    public FieldOptimizePromptConfigDTO find(String presetId) {
        var rows = jdbc.query("SELECT * FROM field_optimize_prompt_config WHERE preset_id = ?", (rs, n) -> {
            var dto = new FieldOptimizePromptConfigDTO();
            dto.setPresetId(rs.getString("preset_id"));
            dto.setName(rs.getString("name"));
            dto.setDescription(rs.getString("description"));
            dto.setSystemPrompt(rs.getString("system_prompt"));
            dto.setDescriptionPrompt(rs.getString("description_prompt"));
            dto.setResponsibilityPrompt(rs.getString("responsibility_prompt"));
            dto.setSkillPrompt(rs.getString("skill_prompt"));
            return dto;
        }, FieldOptimizePresets.normalize(presetId));
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public FieldOptimizePromptConfigDTO save(String presetId, FieldOptimizePromptConfigDTO dto, Long adminId) {
        String id = FieldOptimizePresets.normalize(presetId);
        requireText(dto.getName(), 40, "方式名称");
        requireText(dto.getDescription(), 200, "特色说明");
        requireText(dto.getSystemPrompt(), 20000, "系统提示词");
        for (String template : new String[]{dto.getDescriptionPrompt(), dto.getResponsibilityPrompt(), dto.getSkillPrompt()}) {
            requireText(template, 20000, "字段提示词");
            if (!template.contains("{{original}}")) {
                throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "字段提示词必须保留 {{original}} 原文占位符");
            }
        }
        jdbc.update("""
                INSERT INTO field_optimize_prompt_config
                    (preset_id, name, description, system_prompt, description_prompt, responsibility_prompt, skill_prompt, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description),
                    system_prompt=VALUES(system_prompt), description_prompt=VALUES(description_prompt),
                    responsibility_prompt=VALUES(responsibility_prompt), skill_prompt=VALUES(skill_prompt),
                    updated_by=VALUES(updated_by), updated_at=CURRENT_TIMESTAMP
                """, id, dto.getName().strip(), dto.getDescription().strip(), dto.getSystemPrompt().strip(),
                dto.getDescriptionPrompt().strip(), dto.getResponsibilityPrompt().strip(), dto.getSkillPrompt().strip(), adminId);
        return find(id);
    }

    private void requireText(String value, int max, String label) {
        if (value == null || value.isBlank() || value.length() > max) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), label + "不能为空且不能超过 " + max + " 字");
        }
    }
}
