package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.common.ResumeAnalysisScenario;
import com.itwanger.pairesume.dto.ResumeAnalysisPromptConfigDTO;
import com.itwanger.pairesume.entity.ResumeAnalysisPromptConfig;
import com.itwanger.pairesume.mapper.ResumeAnalysisPromptConfigMapper;
import com.itwanger.pairesume.service.ResumeAnalysisPromptConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ResumeAnalysisPromptConfigServiceImpl implements ResumeAnalysisPromptConfigService {
    private final ResumeAnalysisPromptConfigMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public List<ResumeAnalysisPromptConfigDTO> listAdminConfigs() {
        Map<String, ResumeAnalysisPromptConfig> stored = mapper.selectList(
                new LambdaQueryWrapper<ResumeAnalysisPromptConfig>()
                        .orderByAsc(ResumeAnalysisPromptConfig::getSortOrder)
                        .orderByAsc(ResumeAnalysisPromptConfig::getScenarioCode)
        ).stream().collect(Collectors.toMap(
                ResumeAnalysisPromptConfig::getScenarioCode,
                Function.identity()
        ));
        return Arrays.stream(ResumeAnalysisScenario.values())
                .map(scenario -> toDto(requireStored(stored.get(scenario.name()), scenario)))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ResolvedPrompt resolve(String scenarioCode) {
        ResumeAnalysisScenario scenario = ResumeAnalysisScenario.fromCode(scenarioCode);
        ResumeAnalysisPromptConfig config = requireStored(
                mapper.selectById(scenario.name()), scenario);
        return new ResolvedPrompt(scenario.name(), scenario.getDisplayName(), config.getPrompt().strip());
    }

    @Override
    @Transactional
    public ResumeAnalysisPromptConfigDTO update(
            String scenarioCode,
            String prompt,
            Long adminUserId
    ) {
        ResumeAnalysisScenario scenario = ResumeAnalysisScenario.fromCode(scenarioCode);
        if (prompt == null || prompt.isBlank()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "分析提示词不能为空");
        }
        if (prompt.length() > ResumeAnalysisPromptConfigService.MAX_PROMPT_LENGTH) {
            throw new BusinessException(
                    ResultCode.BAD_REQUEST.getCode(),
                    "分析提示词不能超过 " + ResumeAnalysisPromptConfigService.MAX_PROMPT_LENGTH + " 个字符"
            );
        }
        ResumeAnalysisPromptConfig config = requireStored(
                mapper.selectById(scenario.name()), scenario);
        config.setPrompt(prompt.strip());
        config.setDisplayName(scenario.getDisplayName());
        config.setUpdatedBy(adminUserId);
        if (mapper.updateById(config) != 1) {
            throw new BusinessException(
                    ResultCode.INTERNAL_ERROR.getCode(),
                    "分析提示词保存失败：" + scenario.getDisplayName()
            );
        }
        return toDto(config);
    }

    private ResumeAnalysisPromptConfig requireStored(
            ResumeAnalysisPromptConfig config,
            ResumeAnalysisScenario scenario
    ) {
        if (config == null || config.getPrompt() == null || config.getPrompt().isBlank()) {
            throw new BusinessException(
                    ResultCode.INTERNAL_ERROR.getCode(),
                    "简历分析提示词配置缺失：" + scenario.getDisplayName()
            );
        }
        return config;
    }

    private ResumeAnalysisPromptConfigDTO toDto(ResumeAnalysisPromptConfig config) {
        var dto = new ResumeAnalysisPromptConfigDTO();
        dto.setScenarioCode(config.getScenarioCode());
        dto.setDisplayName(config.getDisplayName());
        dto.setPrompt(config.getPrompt());
        dto.setUpdatedAt(config.getUpdatedAt());
        return dto;
    }
}
