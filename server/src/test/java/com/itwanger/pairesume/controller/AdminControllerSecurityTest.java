package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.GlobalExceptionHandler;
import com.itwanger.pairesume.config.CorsConfig;
import com.itwanger.pairesume.config.SecurityConfig;
import com.itwanger.pairesume.dto.AdminMarketplaceActionDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.ResumeAnalysisPromptConfigDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.security.JwtAuthenticationFilter;
import com.itwanger.pairesume.security.JwtTokenProvider;
import com.itwanger.pairesume.security.LegalConsentPolicy;
import com.itwanger.pairesume.service.MarketplaceGovernanceService;
import com.itwanger.pairesume.service.MembershipPaymentAdminService;
import com.itwanger.pairesume.service.ResumeAnalysisPromptConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {
        MembershipPaymentAdminController.class,
        AdminMarketplaceGovernanceController.class,
        AdminResumeAnalysisPromptController.class
})
@ContextConfiguration(classes = {
        MembershipPaymentAdminController.class,
        AdminMarketplaceGovernanceController.class,
        AdminResumeAnalysisPromptController.class,
        SecurityConfig.class,
        CorsConfig.class,
        GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class,
        JwtTokenProvider.class
})
@TestPropertySource(properties = {
        "jwt.secret=admin-controller-security-test-secret-that-is-longer-than-32-bytes",
        "jwt.access-token-expiration=900000",
        "jwt.refresh-token-expiration=604800000"
})
class AdminControllerSecurityTest {

    private static final long ADMIN_USER_ID = 41L;
    private static final long REGULAR_USER_ID = 42L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private MembershipPaymentAdminService membershipPaymentAdminService;

    @MockBean
    private MarketplaceGovernanceService marketplaceGovernanceService;

    @MockBean
    private ResumeAnalysisPromptConfigService resumeAnalysisPromptConfigService;

    @MockBean
    private StringRedisTemplate redisTemplate;

    @MockBean
    private UserMapper userMapper;

    private String adminAccessToken;
    private String regularUserAccessToken;

    @BeforeEach
    void setUpAuthenticatedUsers() {
        when(userMapper.selectById(ADMIN_USER_ID)).thenReturn(activeUser(ADMIN_USER_ID));
        when(userMapper.selectById(REGULAR_USER_ID)).thenReturn(activeUser(REGULAR_USER_ID));
        adminAccessToken = jwtTokenProvider.generateAccessToken(
                ADMIN_USER_ID, "admin@example.com", "ADMIN", "admin-session"
        );
        regularUserAccessToken = jwtTokenProvider.generateAccessToken(
                REGULAR_USER_ID, "user@example.com", "USER", "user-session"
        );
    }

    @Test
    void unauthenticatedRequestCannotReachAdminController() throws Exception {
        mockMvc.perform(get("/admin/membership/payment-orders"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401))
                .andExpect(jsonPath("$.message").value("未授权"));

        verifyNoInteractions(membershipPaymentAdminService);
    }

    @Test
    void regularUserCannotReachAdminController() throws Exception {
        mockMvc.perform(get("/admin/membership/payment-orders")
                        .header("Authorization", bearer(regularUserAccessToken)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value(403))
                .andExpect(jsonPath("$.message").value("无权限"));

        verifyNoInteractions(membershipPaymentAdminService);
    }

    @Test
    void administratorCanReachControllerAndListFiltersAreMapped() throws Exception {
        when(membershipPaymentAdminService.listOrders(3, 15, "PAID", "REFUND_PENDING"))
                .thenReturn(new MarketplacePageDTO<>(List.of(), 0, 3, 15, 0));

        mockMvc.perform(get("/admin/membership/payment-orders")
                        .header("Authorization", bearer(adminAccessToken))
                        .queryParam("page", "3")
                        .queryParam("size", "15")
                        .queryParam("orderStatus", "PAID")
                        .queryParam("reviewStatus", "REFUND_PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(membershipPaymentAdminService)
                .listOrders(3, 15, "PAID", "REFUND_PENDING");
    }

    @Test
    void regularUserCannotReadAnalysisPrompts() throws Exception {
        mockMvc.perform(get("/admin/resume-analysis-prompts")
                        .header("Authorization", bearer(regularUserAccessToken)))
                .andExpect(status().isForbidden());

        verifyNoInteractions(resumeAnalysisPromptConfigService);
    }

    @Test
    void administratorCanUpdateAnalysisPrompt() throws Exception {
        var result = new ResumeAnalysisPromptConfigDTO();
        result.setScenarioCode("WORKING_PROFESSIONAL");
        result.setDisplayName("工作党");
        result.setPrompt("只评估工作经历和专业技能");
        when(resumeAnalysisPromptConfigService.update(
                "WORKING_PROFESSIONAL",
                "只评估工作经历和专业技能",
                ADMIN_USER_ID
        )).thenReturn(result);

        mockMvc.perform(put("/admin/resume-analysis-prompts/WORKING_PROFESSIONAL")
                        .header("Authorization", bearer(adminAccessToken))
                        .contentType("application/json")
                        .content("{\"prompt\":\"只评估工作经历和专业技能\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.scenarioCode").value("WORKING_PROFESSIONAL"));

        verify(resumeAnalysisPromptConfigService).update(
                "WORKING_PROFESSIONAL",
                "只评估工作经历和专业技能",
                ADMIN_USER_ID
        );
    }

    @Test
    void refundConfirmationRejectsBlankReasonBeforeServiceCall() throws Exception {
        mockMvc.perform(post("/admin/membership/payment-orders/MEM-001/confirm-refunded")
                        .header("Authorization", bearer(adminAccessToken))
                        .contentType("application/json")
                        .content("{\"reason\":\"   \",\"refundReference\":\"WX-REF-001\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("reason: 请填写操作原因"));

        verify(membershipPaymentAdminService, never())
                .confirmRefunded(anyString(), anyLong(), anyString(), anyString());
    }

    @Test
    void refundConfirmationMapsOrderAdministratorReasonAndReference() throws Exception {
        mockMvc.perform(post("/admin/membership/payment-orders/MEM-001/confirm-refunded")
                        .header("Authorization", bearer(adminAccessToken))
                        .contentType("application/json")
                        .content("{\"reason\":\"已核对微信支付平台退款结果\","
                                + "\"refundReference\":\"WX-REF-001\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        verify(membershipPaymentAdminService).confirmRefunded(
                "MEM-001",
                ADMIN_USER_ID,
                "已核对微信支付平台退款结果",
                "WX-REF-001"
        );
    }

    @Test
    void governanceActionRejectsMissingReasonBeforeServiceCall() throws Exception {
        mockMvc.perform(patch("/admin/marketplace/reports/88")
                        .header("Authorization", bearer(adminAccessToken))
                        .contentType("application/json")
                        .content("{\"action\":\"TAKE_DOWN\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value(400))
                .andExpect(jsonPath("$.message").value("reason: 处理原因不能为空"));

        verify(marketplaceGovernanceService, never())
                .handleReport(anyLong(), anyLong(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void governanceActionMapsReportAdministratorAndPayload() throws Exception {
        mockMvc.perform(patch("/admin/marketplace/reports/88")
                        .header("Authorization", bearer(adminAccessToken))
                        .contentType("application/json")
                        .content("{\"action\":\"TAKE_DOWN\",\"reason\":\"侵权材料已核实\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(200));

        ArgumentCaptor<AdminMarketplaceActionDTO> actionCaptor =
                ArgumentCaptor.forClass(AdminMarketplaceActionDTO.class);
        verify(marketplaceGovernanceService)
                .handleReport(org.mockito.ArgumentMatchers.eq(88L),
                        org.mockito.ArgumentMatchers.eq(ADMIN_USER_ID), actionCaptor.capture());
        assertEquals("TAKE_DOWN", actionCaptor.getValue().getAction());
        assertEquals("侵权材料已核实", actionCaptor.getValue().getReason());
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

    private String bearer(String token) {
        return "Bearer " + token;
    }
}
