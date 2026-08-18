package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.GlobalExceptionHandler;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.CorsConfig;
import com.itwanger.pairesume.config.SecurityConfig;
import com.itwanger.pairesume.dto.ResumeAnalysisIssueDTO;
import com.itwanger.pairesume.dto.ResumeAnalysisResultDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeAnalysisRecord;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.security.JwtAuthenticationFilter;
import com.itwanger.pairesume.security.JwtTokenProvider;
import com.itwanger.pairesume.security.LegalConsentPolicy;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.MembershipService;
import com.itwanger.pairesume.service.ResumeAnalysisPromptConfigService;
import com.itwanger.pairesume.service.ResumeAnalysisRecordService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ResumeAnalysisController.class)
@ContextConfiguration(classes = {
        ResumeAnalysisController.class,
        SecurityConfig.class,
        CorsConfig.class,
        GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class,
        JwtTokenProvider.class
})
@TestPropertySource(properties = {
        "jwt.secret=resume-analysis-contract-test-secret-that-is-longer-than-32-bytes",
        "jwt.access-token-expiration=900000",
        "jwt.refresh-token-expiration=604800000"
})
class ResumeAnalysisControllerContractTest {

    private static final long OWNER_ID = 51L;
    private static final long OTHER_USER_ID = 52L;
    private static final long RESUME_ID = 7L;
    private static final String SCENARIO_CODE = "WORKING_PROFESSIONAL";
    private static final String CONFIGURED_PROMPT = "后台配置的工作党分析提示词";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private AiService aiService;

    @MockBean
    private ResumeAnalysisRecordService resumeAnalysisRecordService;

    @MockBean
    private ResumeMapper resumeMapper;

    @MockBean
    private ResumeModuleMapper moduleMapper;

    @MockBean
    private MembershipService membershipService;

    @MockBean
    private ResumeAnalysisPromptConfigService promptConfigService;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @MockBean
    private UserMapper userMapper;

    private String ownerAccessToken;

    @BeforeEach
    void setUpAuthenticatedOwner() {
        when(userMapper.selectById(OWNER_ID)).thenReturn(activeUser(OWNER_ID));
        ownerAccessToken = jwtTokenProvider.generateAccessToken(
                OWNER_ID, "owner@example.com", "USER", "owner-session"
        );
    }

    @Test
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));

        verifyNoInteractions(aiService, resumeAnalysisRecordService, promptConfigService, resumeMapper);
    }

    @Test
    void nonVipUserIsRejectedBeforeResumeOrPromptAccess() throws Exception {
        doThrow(new BusinessException(ResultCode.AI_MEMBERSHIP_REQUIRED))
                .when(membershipService).requireAiAccess(OWNER_ID);

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(4006))
                .andExpect(jsonPath("$.message").value("开通 VIP 后才可使用 AI 功能"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService, promptConfigService,
                resumeMapper, moduleMapper);
    }

    @Test
    void missingResumeIsRejectedWithoutSavingRecord() throws Exception {
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(null);

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(3001))
                .andExpect(jsonPath("$.message").value("简历不存在"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService, promptConfigService);
    }

    @Test
    void resumeOwnedByAnotherUserIsRejected() throws Exception {
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(activeResume(OTHER_USER_ID));

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(jsonPath("$.code").value(3001));

        verifyNoInteractions(aiService, resumeAnalysisRecordService, promptConfigService);
    }

    @Test
    void deletedResumeIsRejected() throws Exception {
        Resume resume = activeResume(OWNER_ID);
        resume.setStatus(0);
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(resume);

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(jsonPath("$.code").value(3001));

        verifyNoInteractions(aiService, resumeAnalysisRecordService);
    }

    @Test
    void blankScenarioCodeIsRejectedBeforePromptResolution() throws Exception {
        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("scenarioCode: 请选择求职场景"));

        verifyNoInteractions(promptConfigService, aiService, resumeAnalysisRecordService);
    }

    @Test
    void unknownScenarioCodeIsRejectedWithoutAiCallOrRecord() throws Exception {
        givenOwnedResumeWithModules();
        when(promptConfigService.resolve("NOT_A_SCENARIO"))
                .thenThrow(new BusinessException(ResultCode.BAD_REQUEST.getCode(), "求职场景不存在"));

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"NOT_A_SCENARIO\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("求职场景不存在"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService);
    }

    @Test
    void emptyResumeIsRejected() throws Exception {
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(activeResume(OWNER_ID));
        when(moduleMapper.selectList(any())).thenReturn(List.of());
        givenResolvedPrompt();

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("请先完善简历内容后再进行分析"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService);
    }

    @Test
    void analysisUsesBackendPromptAndPersistsCompletedRecord() throws Exception {
        givenOwnedResumeWithModules();
        givenResolvedPrompt();
        when(aiService.analyzeResume(eq("后端工程师简历"), anyList(), anyString()))
                .thenReturn(analysisResult("MODEL_RETURNED_CODE", 86));

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.score").value(86))
                .andExpect(jsonPath("$.data.scenarioCode").value(SCENARIO_CODE))
                .andExpect(jsonPath("$.data.scenarioName").value("工作党"));

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(aiService).analyzeResume(eq("后端工程师简历"), anyList(), promptCaptor.capture());
        assertEquals(CONFIGURED_PROMPT, promptCaptor.getValue());

        ArgumentCaptor<ResumeAnalysisRecord> recordCaptor =
                ArgumentCaptor.forClass(ResumeAnalysisRecord.class);
        verify(resumeAnalysisRecordService).save(recordCaptor.capture());
        ResumeAnalysisRecord record = recordCaptor.getValue();
        assertEquals(OWNER_ID, record.getUserId());
        assertEquals(RESUME_ID, record.getResumeId());
        assertEquals(SCENARIO_CODE, record.getScenarioCode());
        assertEquals(CONFIGURED_PROMPT, record.getPrompt());
        assertEquals("completed", record.getRecordStatus());
        assertEquals(Integer.valueOf(86), record.getScore());
        assertEquals(2, record.getIssues().size());
        assertEquals(1, record.getSuggestions().size());
    }

    @Test
    void businessFailureFromAiSavesErrorRecord() throws Exception {
        givenOwnedResumeWithModules();
        givenResolvedPrompt();
        when(aiService.analyzeResume(anyString(), anyList(), anyString()))
                .thenThrow(new BusinessException(ResultCode.AI_SERVICE_BUSY));

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(4001))
                .andExpect(jsonPath("$.message").value("AI 服务繁忙，请稍后重试"));

        ArgumentCaptor<ResumeAnalysisRecord> recordCaptor =
                ArgumentCaptor.forClass(ResumeAnalysisRecord.class);
        verify(resumeAnalysisRecordService).save(recordCaptor.capture());
        ResumeAnalysisRecord record = recordCaptor.getValue();
        assertEquals("error", record.getRecordStatus());
        assertEquals("AI 服务繁忙，请稍后重试", record.getErrorMessage());
        assertEquals(SCENARIO_CODE, record.getScenarioCode());
        assertEquals(CONFIGURED_PROMPT, record.getPrompt());
    }

    @Test
    void unexpectedFailureFromAiSavesErrorRecord() throws Exception {
        givenOwnedResumeWithModules();
        givenResolvedPrompt();
        when(aiService.analyzeResume(anyString(), anyList(), anyString()))
                .thenThrow(new RuntimeException("upstream connection reset"));

        mockMvc.perform(post("/resumes/{resumeId}/analysis", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.message").value("服务器内部错误"));

        ArgumentCaptor<ResumeAnalysisRecord> recordCaptor =
                ArgumentCaptor.forClass(ResumeAnalysisRecord.class);
        verify(resumeAnalysisRecordService).save(recordCaptor.capture());
        assertEquals("error", recordCaptor.getValue().getRecordStatus());
        assertEquals(SCENARIO_CODE, recordCaptor.getValue().getScenarioCode());
    }

    @Test
    void streamSuccessEmitsStatusReasoningResultDoneAndPersistsRecord() throws Exception {
        givenOwnedResumeWithModules();
        givenResolvedPrompt();
        when(aiService.streamAnalyzeResume(eq("后端工程师简历"), anyList(), anyString(), any()))
                .thenAnswer(invocation -> {
                    Consumer<Map<String, Object>> consumer = invocation.getArgument(3);
                    consumer.accept(Map.of("type", "status", "message", "AI 已连接，正在审阅整份简历。"));
                    consumer.accept(Map.of("type", "reasoning_delta", "text", "正在核对工作经历的职责边界"));
                    consumer.accept(Map.of("type", "content_delta", "text", "{\"score\""));
                    return analysisResult("MODEL_RETURNED_CODE", 72);
                });

        MvcResult mvcResult = mockMvc.perform(post("/resumes/{resumeId}/analysis/stream", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String body = mvcResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertEventOrder(body,
                "event:connected",
                "event:status",
                "event:reasoning_delta",
                "event:content_delta",
                "event:result",
                "event:done");
        assertTrue(body.contains("简历分析已开始"));
        assertTrue(body.contains("AI 已连接，正在审阅整份简历。"));
        assertTrue(body.contains("正在核对工作经历的职责边界"));
        assertTrue(body.contains("\"scenarioCode\":\"WORKING_PROFESSIONAL\""));
        assertTrue(body.contains("\"scenarioName\":\"工作党\""));
        assertTrue(body.contains("\"score\":72"));
        assertTrue(body.contains("\"status\":\"completed\""));
        assertFalse(body.contains("event:error"));
        assertEquals("no", mvcResult.getResponse().getHeader("X-Accel-Buffering"));

        ArgumentCaptor<String> promptCaptor = ArgumentCaptor.forClass(String.class);
        verify(aiService).streamAnalyzeResume(eq("后端工程师简历"), anyList(), promptCaptor.capture(), any());
        assertEquals(CONFIGURED_PROMPT, promptCaptor.getValue());

        ArgumentCaptor<ResumeAnalysisRecord> recordCaptor =
                ArgumentCaptor.forClass(ResumeAnalysisRecord.class);
        verify(resumeAnalysisRecordService).save(recordCaptor.capture());
        assertEquals("completed", recordCaptor.getValue().getRecordStatus());
        assertEquals(SCENARIO_CODE, recordCaptor.getValue().getScenarioCode());
        assertEquals(CONFIGURED_PROMPT, recordCaptor.getValue().getPrompt());
        assertEquals(Integer.valueOf(72), recordCaptor.getValue().getScore());
    }

    @Test
    void streamBusinessFailureEmitsErrorEventAndSavesErrorRecord() throws Exception {
        givenOwnedResumeWithModules();
        givenResolvedPrompt();
        when(aiService.streamAnalyzeResume(anyString(), anyList(), anyString(), any()))
                .thenThrow(new BusinessException(
                        ResultCode.AI_RESPONSE_INVALID.getCode(), "AI 思考已结束，但未返回最终分析结果，请重试"));

        MvcResult mvcResult = mockMvc.perform(post("/resumes/{resumeId}/analysis/stream", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andReturn();

        String body = mvcResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(body.contains("event:error"));
        assertTrue(body.contains("\"code\":4003"));
        assertTrue(body.contains("AI 思考已结束，但未返回最终分析结果，请重试"));
        assertFalse(body.contains("event:done"));
        assertFalse(body.contains("event:result"));

        ArgumentCaptor<ResumeAnalysisRecord> recordCaptor =
                ArgumentCaptor.forClass(ResumeAnalysisRecord.class);
        verify(resumeAnalysisRecordService).save(recordCaptor.capture());
        assertEquals("error", recordCaptor.getValue().getRecordStatus());
        assertEquals("AI 思考已结束，但未返回最终分析结果，请重试", recordCaptor.getValue().getErrorMessage());
        assertEquals(CONFIGURED_PROMPT, recordCaptor.getValue().getPrompt());
    }

    @Test
    void streamUnexpectedFailureMasksUpstreamDetailInSseBody() throws Exception {
        givenOwnedResumeWithModules();
        givenResolvedPrompt();
        when(aiService.streamAnalyzeResume(anyString(), anyList(), anyString(), any()))
                .thenThrow(new RuntimeException("upstream secret detail"));

        MvcResult mvcResult = mockMvc.perform(post("/resumes/{resumeId}/analysis/stream", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andReturn();

        String body = mvcResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(body.contains("event:error"));
        assertTrue(body.contains("\"code\":500"));
        assertTrue(body.contains("流式简历分析失败，请稍后重试"));
        assertFalse(body.contains("upstream secret detail"));
        assertFalse(body.contains("event:done"));

        ArgumentCaptor<ResumeAnalysisRecord> recordCaptor =
                ArgumentCaptor.forClass(ResumeAnalysisRecord.class);
        verify(resumeAnalysisRecordService).save(recordCaptor.capture());
        assertEquals("error", recordCaptor.getValue().getRecordStatus());
        assertEquals("流式简历分析失败，请稍后重试", recordCaptor.getValue().getErrorMessage());
    }

    @Test
    void streamBlankScenarioEmitsSseErrorEventWithoutAiCallOrRecord() throws Exception {
        givenOwnedResumeWithModules();
        when(promptConfigService.resolve("   "))
                .thenThrow(new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请选择求职场景"));

        MvcResult mvcResult = mockMvc.perform(post("/resumes/{resumeId}/analysis/stream", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"   \"}"))
                .andExpect(status().isOk())
                .andReturn();

        String body = mvcResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(body.contains("event:error"));
        assertTrue(body.contains("请选择求职场景"));
        assertFalse(body.contains("event:connected"));
        assertFalse(body.contains("event:done"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService);
    }

    @Test
    void streamUnknownScenarioEmitsSseErrorEventWithoutAiCallOrRecord() throws Exception {
        givenOwnedResumeWithModules();
        when(promptConfigService.resolve("NOT_A_SCENARIO"))
                .thenThrow(new BusinessException(ResultCode.BAD_REQUEST.getCode(), "求职场景不存在"));

        MvcResult mvcResult = mockMvc.perform(post("/resumes/{resumeId}/analysis/stream", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"NOT_A_SCENARIO\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String body = mvcResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(body.contains("event:error"));
        assertTrue(body.contains("求职场景不存在"));
        assertFalse(body.contains("event:done"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService);
    }

    @Test
    void streamNonVipUserGetsSseErrorEventWithMembershipMessage() throws Exception {
        doThrow(new BusinessException(ResultCode.AI_MEMBERSHIP_REQUIRED))
                .when(membershipService).requireAiAccess(OWNER_ID);

        MvcResult mvcResult = mockMvc.perform(post("/resumes/{resumeId}/analysis/stream", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String body = mvcResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(body.contains("event:error"));
        assertTrue(body.contains("\"code\":4006"));
        assertTrue(body.contains("开通 VIP 后才可使用 AI 功能"));
        assertFalse(body.contains("event:done"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService, promptConfigService, resumeMapper, moduleMapper);
    }

    @Test
    void streamForeignResumeEmitsSseErrorEventWithoutRecord() throws Exception {
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(activeResume(OTHER_USER_ID));

        MvcResult mvcResult = mockMvc.perform(post("/resumes/{resumeId}/analysis/stream", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String body = mvcResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(body.contains("event:error"));
        assertTrue(body.contains("\"code\":3001"));
        assertTrue(body.contains("简历不存在"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService, promptConfigService);
    }

    @Test
    void streamEmptyResumeEmitsSseErrorEventWithoutRecord() throws Exception {
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(activeResume(OWNER_ID));
        when(moduleMapper.selectList(any())).thenReturn(List.of());

        MvcResult mvcResult = mockMvc.perform(post("/resumes/{resumeId}/analysis/stream", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken))
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"scenarioCode\":\"WORKING_PROFESSIONAL\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String body = mvcResult.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertTrue(body.contains("event:error"));
        assertTrue(body.contains("请先完善简历内容后再进行分析"));

        verifyNoInteractions(aiService, resumeAnalysisRecordService, promptConfigService);
    }

    @Test
    void latestAnalysisReturnsScenarioForRestoreAndChecksOwnership() throws Exception {
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(activeResume(OWNER_ID));
        ResumeAnalysisResultDTO latest = analysisResult(SCENARIO_CODE, 90);
        latest.setScenarioName("工作党");
        when(resumeAnalysisRecordService.getLatestCompletedRecord(OWNER_ID, RESUME_ID))
                .thenReturn(latest);

        mockMvc.perform(get("/resumes/{resumeId}/analysis/latest", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scenarioCode").value(SCENARIO_CODE))
                .andExpect(jsonPath("$.data.scenarioName").value("工作党"));

        when(resumeMapper.selectById(RESUME_ID)).thenReturn(activeResume(OTHER_USER_ID));
        mockMvc.perform(get("/resumes/{resumeId}/analysis/latest", RESUME_ID)
                        .header("Authorization", bearer(ownerAccessToken)))
                .andExpect(jsonPath("$.code").value(3001));
    }

    private void givenResolvedPrompt() {
        when(promptConfigService.resolve(SCENARIO_CODE)).thenReturn(
                new ResumeAnalysisPromptConfigService.ResolvedPrompt(
                        SCENARIO_CODE, "工作党", CONFIGURED_PROMPT));
    }

    private void givenOwnedResumeWithModules() {
        when(resumeMapper.selectById(RESUME_ID)).thenReturn(activeResume(OWNER_ID));
        ResumeModule module = new ResumeModule();
        module.setId(11L);
        module.setResumeId(RESUME_ID);
        module.setModuleType("work_experience");
        module.setSortOrder(1);
        module.setContent(Map.of("company", "示例公司"));
        when(moduleMapper.selectList(any())).thenReturn(List.of(module));
    }

    private ResumeAnalysisResultDTO analysisResult(String scenarioCode, int score) {
        ResumeAnalysisResultDTO result = new ResumeAnalysisResultDTO();
        result.setScenarioCode(scenarioCode);
        result.setScenarioName("模型自述场景");
        result.setScore(score);

        ResumeAnalysisIssueDTO issue = new ResumeAnalysisIssueDTO();
        issue.setType("work_experience");
        issue.setMessage("工作经历缺少量化结果");
        issue.setSuggestion("补充可验证的成果数据");
        result.setIssues(List.of(issue, issue));
        result.setSuggestions(List.of("把最新一段经历的职责改成三条成果句"));
        return result;
    }

    private Resume activeResume(Long userId) {
        Resume resume = new Resume();
        resume.setId(RESUME_ID);
        resume.setUserId(userId);
        resume.setTitle("后端工程师简历");
        resume.setStatus(1);
        return resume;
    }

    private User activeUser(long userId) {
        User user = new User();
        user.setId(userId);
        user.setStatus(1);
        user.setTermsAcceptedAt(LocalDateTime.now());
        user.setPrivacyAcceptedAt(LocalDateTime.now());
        user.setTermsVersion(LegalConsentPolicy.CURRENT_VERSION);
        user.setPrivacyVersion(LegalConsentPolicy.CURRENT_VERSION);
        user.setAiProcessingDisclosureVersion(LegalConsentPolicy.CURRENT_VERSION);
        return user;
    }

    private void assertEventOrder(String body, String... events) {
        int previous = -1;
        for (String event : events) {
            int index = body.indexOf(event);
            assertTrue(index >= 0, "SSE 输出缺少事件: " + event);
            assertTrue(index > previous, "SSE 事件顺序错误: " + event);
            previous = index;
        }
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
