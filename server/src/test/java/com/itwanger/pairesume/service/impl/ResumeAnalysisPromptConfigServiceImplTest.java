package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.entity.ResumeAnalysisPromptConfig;
import com.itwanger.pairesume.mapper.ResumeAnalysisPromptConfigMapper;
import com.itwanger.pairesume.service.ResumeAnalysisPromptConfigService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeAnalysisPromptConfigServiceImplTest {
    @Mock
    private ResumeAnalysisPromptConfigMapper mapper;

    @Test
    void listAdminConfigsKeepsFixedScenarioOrderRegardlessOfStoredSortOrder() {
        List<ResumeAnalysisPromptConfig> stored = List.of(
                config("STUDENT_AUTUMN_RECRUITMENT", "学生党冲秋招", "秋招提示词", 40),
                config("WORKING_PROFESSIONAL", "工作党", "工作党提示词", 10),
                config("STUDENT_SUMMER_INTERNSHIP", "学生党找暑期实习", "暑期实习提示词", 30),
                config("STUDENT_DAILY_INTERNSHIP", "学生党找日常实习", "日常实习提示词", 20)
        );
        when(mapper.selectList(any())).thenReturn(stored);

        var result = new ResumeAnalysisPromptConfigServiceImpl(mapper).listAdminConfigs();

        assertEquals(
                List.of(
                        "WORKING_PROFESSIONAL",
                        "STUDENT_DAILY_INTERNSHIP",
                        "STUDENT_SUMMER_INTERNSHIP",
                        "STUDENT_AUTUMN_RECRUITMENT"
                ),
                result.stream().map(dto -> dto.getScenarioCode()).toList()
        );
        assertEquals(List.of("工作党", "学生党找日常实习", "学生党找暑期实习", "学生党冲秋招"),
                result.stream().map(dto -> dto.getDisplayName()).toList());
        assertEquals("秋招提示词", result.get(3).getPrompt());
    }

    @Test
    void listAdminConfigsFailsClosedWhenScenarioRowMissing() {
        when(mapper.selectList(any())).thenReturn(List.of(
                config("WORKING_PROFESSIONAL", "工作党", "工作党提示词", 10),
                config("STUDENT_DAILY_INTERNSHIP", "学生党找日常实习", "日常实习提示词", 20),
                config("STUDENT_SUMMER_INTERNSHIP", "学生党找暑期实习", "暑期实习提示词", 30)
        ));

        BusinessException error = assertThrows(BusinessException.class,
                () -> new ResumeAnalysisPromptConfigServiceImpl(mapper).listAdminConfigs());

        assertEquals(500, error.getCode());
        assertEquals("简历分析提示词配置缺失：学生党冲秋招", error.getMessage());
    }

    @Test
    void listAdminConfigsFailsClosedWhenStoredPromptBlank() {
        when(mapper.selectList(any())).thenReturn(List.of(
                config("WORKING_PROFESSIONAL", "工作党", "工作党提示词", 10),
                config("STUDENT_DAILY_INTERNSHIP", "学生党找日常实习", "   ", 20),
                config("STUDENT_SUMMER_INTERNSHIP", "学生党找暑期实习", "暑期实习提示词", 30),
                config("STUDENT_AUTUMN_RECRUITMENT", "学生党冲秋招", "秋招提示词", 40)
        ));

        BusinessException error = assertThrows(BusinessException.class,
                () -> new ResumeAnalysisPromptConfigServiceImpl(mapper).listAdminConfigs());

        assertEquals(500, error.getCode());
        assertEquals("简历分析提示词配置缺失：学生党找日常实习", error.getMessage());
    }

    @Test
    void resolveNormalizesScenarioCodeCaseAndSurroundingWhitespace() {
        ResumeAnalysisPromptConfig stored =
                config("WORKING_PROFESSIONAL", "工作党", "  工作党提示词\n", 10);
        when(mapper.selectById("WORKING_PROFESSIONAL")).thenReturn(stored);

        var resolved = new ResumeAnalysisPromptConfigServiceImpl(mapper)
                .resolve("  working_professional  ");

        assertEquals("WORKING_PROFESSIONAL", resolved.scenarioCode());
        assertEquals("工作党", resolved.displayName());
        assertEquals("工作党提示词", resolved.prompt());
        verify(mapper).selectById("WORKING_PROFESSIONAL");
    }

    @Test
    void resolveRejectsUnknownScenarioCode() {
        ResumeAnalysisPromptConfigServiceImpl service = new ResumeAnalysisPromptConfigServiceImpl(mapper);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.resolve("FULLTIME_JOB"));

        assertEquals(400, error.getCode());
        assertEquals("求职场景不存在", error.getMessage());
        verifyNoInteractions(mapper);
    }

    @Test
    void resolveRejectsBlankScenarioCode() {
        ResumeAnalysisPromptConfigServiceImpl service = new ResumeAnalysisPromptConfigServiceImpl(mapper);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.resolve("   "));

        assertEquals(400, error.getCode());
        assertEquals("请选择求职场景", error.getMessage());
        verifyNoInteractions(mapper);
    }

    @Test
    void resolveFailsClosedWhenStoredPromptMissing() {
        when(mapper.selectById(anyString())).thenReturn(null);

        BusinessException error = assertThrows(BusinessException.class,
                () -> new ResumeAnalysisPromptConfigServiceImpl(mapper).resolve("WORKING_PROFESSIONAL"));

        assertEquals(500, error.getCode());
        assertEquals("简历分析提示词配置缺失：工作党", error.getMessage());
    }

    @Test
    void updateStripsPromptAndRecordsAdminOnCanonicalScenario() {
        ResumeAnalysisPromptConfig stored =
                config("WORKING_PROFESSIONAL", "工作党", "旧提示词", 10);
        when(mapper.selectById("WORKING_PROFESSIONAL")).thenReturn(stored);
        when(mapper.updateById(any(ResumeAnalysisPromptConfig.class))).thenReturn(1);

        var result = new ResumeAnalysisPromptConfigServiceImpl(mapper)
                .update(" Working_professional ", "  新提示词  ", 9L);

        ArgumentCaptor<ResumeAnalysisPromptConfig> saved =
                ArgumentCaptor.forClass(ResumeAnalysisPromptConfig.class);
        verify(mapper).updateById(saved.capture());
        assertEquals("新提示词", saved.getValue().getPrompt());
        assertEquals("工作党", saved.getValue().getDisplayName());
        assertEquals(9L, saved.getValue().getUpdatedBy());
        assertEquals("新提示词", result.getPrompt());
    }

    @Test
    void updateRejectsBlankPromptWithoutTouchingDatabase() {
        ResumeAnalysisPromptConfigServiceImpl service = new ResumeAnalysisPromptConfigServiceImpl(mapper);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.update("WORKING_PROFESSIONAL", "   ", 9L));

        assertEquals(400, error.getCode());
        assertEquals("分析提示词不能为空", error.getMessage());
        verifyNoInteractions(mapper);
    }

    @Test
    void updateRejectsPromptExceedingServiceBoundaryLimit() {
        ResumeAnalysisPromptConfigServiceImpl service = new ResumeAnalysisPromptConfigServiceImpl(mapper);

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.update(
                        "WORKING_PROFESSIONAL",
                        "字".repeat(ResumeAnalysisPromptConfigService.MAX_PROMPT_LENGTH + 1),
                        9L
                ));

        assertEquals(400, error.getCode());
        assertEquals("分析提示词不能超过 12000 个字符", error.getMessage());
        verifyNoInteractions(mapper);
    }

    @Test
    void updatePropagatesDatabaseFailure() {
        when(mapper.selectById("WORKING_PROFESSIONAL"))
                .thenReturn(config("WORKING_PROFESSIONAL", "工作党", "旧提示词", 10));
        when(mapper.updateById(any(ResumeAnalysisPromptConfig.class)))
                .thenThrow(new RuntimeException("database down"));

        assertThrows(RuntimeException.class, () -> new ResumeAnalysisPromptConfigServiceImpl(mapper)
                .update("WORKING_PROFESSIONAL", "新提示词", 9L));
    }

    @Test
    void updateFailsClosedWhenNoRowUpdated() {
        when(mapper.selectById("WORKING_PROFESSIONAL"))
                .thenReturn(config("WORKING_PROFESSIONAL", "工作党", "旧提示词", 10));
        when(mapper.updateById(any(ResumeAnalysisPromptConfig.class))).thenReturn(0);

        BusinessException error = assertThrows(BusinessException.class,
                () -> new ResumeAnalysisPromptConfigServiceImpl(mapper)
                        .update("WORKING_PROFESSIONAL", "新提示词", 9L));

        assertEquals(500, error.getCode());
        assertTrue(error.getMessage().contains("分析提示词保存失败"));
    }

    @Test
    void updateFailsClosedWhenStoredConfigMissing() {
        when(mapper.selectById("WORKING_PROFESSIONAL")).thenReturn(null);

        BusinessException error = assertThrows(BusinessException.class,
                () -> new ResumeAnalysisPromptConfigServiceImpl(mapper)
                        .update("WORKING_PROFESSIONAL", "新提示词", 9L));

        assertEquals(500, error.getCode());
        assertEquals("简历分析提示词配置缺失：工作党", error.getMessage());
    }

    private ResumeAnalysisPromptConfig config(String code, String displayName, String prompt, int sortOrder) {
        ResumeAnalysisPromptConfig config = new ResumeAnalysisPromptConfig();
        config.setScenarioCode(code);
        config.setDisplayName(displayName);
        config.setPrompt(prompt);
        config.setSortOrder(sortOrder);
        return config;
    }
}
