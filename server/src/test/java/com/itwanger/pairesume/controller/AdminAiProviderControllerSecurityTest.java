package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.GlobalExceptionHandler;
import com.itwanger.pairesume.config.CorsConfig;
import com.itwanger.pairesume.config.SecurityConfig;
import com.itwanger.pairesume.dto.AiProviderConfigUpdateDTO;
import com.itwanger.pairesume.dto.AiProviderConfigViewDTO;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.security.JwtAuthenticationFilter;
import com.itwanger.pairesume.security.JwtTokenProvider;
import com.itwanger.pairesume.security.LegalConsentPolicy;
import com.itwanger.pairesume.service.AiProviderConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AdminAiProviderController.class)
@ContextConfiguration(classes = {
        AdminAiProviderController.class,
        SecurityConfig.class,
        CorsConfig.class,
        GlobalExceptionHandler.class,
        JwtAuthenticationFilter.class,
        JwtTokenProvider.class
})
@TestPropertySource(properties = {
        "jwt.secret=ai-provider-controller-security-test-secret-longer-than-32-bytes",
        "jwt.access-token-expiration=900000",
        "jwt.refresh-token-expiration=604800000"
})
class AdminAiProviderControllerSecurityTest {

    private static final long ADMIN_USER_ID = 20L;
    private static final long REGULAR_USER_ID = 19L;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @MockBean
    private AiProviderConfigService aiProviderConfigService;

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
                ADMIN_USER_ID, "admin@example.com", "ADMIN", "admin-session");
        regularUserAccessToken = jwtTokenProvider.generateAccessToken(
                REGULAR_USER_ID, "user@example.com", "USER", "user-session");
    }

    @Test
    void unauthenticatedRequestIsRejected() throws Exception {
        mockMvc.perform(get("/admin/ai-provider"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value(401));

        verifyNoInteractions(aiProviderConfigService);
    }

    @Test
    void regularUserIsRejected() throws Exception {
        mockMvc.perform(get("/admin/ai-provider")
                        .header("Authorization", "Bearer " + regularUserAccessToken))
                .andExpect(status().isForbidden());

        verifyNoInteractions(aiProviderConfigService);
    }

    @Test
    void adminViewReturnsMaskButNeverPlaintextOrCipher() throws Exception {
        var view = new AiProviderConfigViewDTO();
        view.setDisplayName("DeepSeek");
        view.setBaseUrl("https://api.deepseek.com/v1");
        view.setGeneralModel("deepseek-chat");
        view.setAnalysisModel("deepseek-chat");
        view.setApiKeyMask("sk-l••••1234");
        view.setApiKeyConfigured(true);
        view.setMasterKeyConfigured(true);
        view.setEnabled(false);
        view.setUpdatedAt(LocalDateTime.now());
        when(aiProviderConfigService.view()).thenReturn(view);

        String body = mockMvc.perform(get("/admin/ai-provider")
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.apiKeyMask").value("sk-l••••1234"))
                .andExpect(jsonPath("$.data.apiKeyConfigured").value(true))
                .andReturn().getResponse().getContentAsString();

        org.junit.jupiter.api.Assertions.assertFalse(body.contains("sk-live"));
        org.junit.jupiter.api.Assertions.assertFalse(body.toLowerCase().contains("cipher"));
    }

    @Test
    void adminUpdateMapsPayloadAndAdministrator() throws Exception {
        mockMvc.perform(put("/admin/ai-provider")
                        .header("Authorization", "Bearer " + adminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "displayName": "智谱 AI",
                                  "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
                                  "generalModel": "glm-4.6",
                                  "analysisModel": "glm-4.6",
                                  "apiKey": "",
                                  "privacyPolicyUrl": "https://example.com/privacy",
                                  "enabled": true
                                }
                                """))
                .andExpect(status().isOk());

        var captor = org.mockito.ArgumentCaptor.forClass(AiProviderConfigUpdateDTO.class);
        verify(aiProviderConfigService).update(eq(ADMIN_USER_ID), captor.capture());
        org.junit.jupiter.api.Assertions.assertEquals("智谱 AI", captor.getValue().getDisplayName());
        org.junit.jupiter.api.Assertions.assertTrue(captor.getValue().isEnabled());
        org.junit.jupiter.api.Assertions.assertEquals("", captor.getValue().getApiKey());
    }

    @Test
    void blankDisplayNameIsRejectedBeforeService() throws Exception {
        mockMvc.perform(put("/admin/ai-provider")
                        .header("Authorization", "Bearer " + adminAccessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "displayName": "  ",
                                  "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
                                  "generalModel": "glm-4.6",
                                  "analysisModel": "glm-4.6"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(aiProviderConfigService);
    }

    @Test
    void testConnectionEndpointRequiresAdmin() throws Exception {
        mockMvc.perform(post("/admin/ai-provider/test")
                        .header("Authorization", "Bearer " + regularUserAccessToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/admin/ai-provider/test")
                        .header("Authorization", "Bearer " + adminAccessToken))
                .andExpect(status().isOk());

        verify(aiProviderConfigService).testConnection(ADMIN_USER_ID);
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
}
