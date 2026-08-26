package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumePhotoOssProperties;
import com.itwanger.pairesume.dto.ResumePhotoOssConfigUpdateDTO;
import com.itwanger.pairesume.entity.ResumePhotoOssConfig;
import com.itwanger.pairesume.entity.ResumePhotoOssConfigAudit;
import com.itwanger.pairesume.mapper.ResumePhotoOssConfigAuditMapper;
import com.itwanger.pairesume.mapper.ResumePhotoOssConfigMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumePhotoOssConfigServiceImplTest {
    @Mock
    private ResumePhotoOssConfigMapper configMapper;
    @Mock
    private ResumePhotoOssConfigAuditMapper auditMapper;

    private AiProviderCryptoService crypto;
    private ResumePhotoOssConfigServiceImpl service;

    @BeforeEach
    void setUp() {
        crypto = new AiProviderCryptoService(Base64.getEncoder().encodeToString(new byte[32]));
        service = new ResumePhotoOssConfigServiceImpl(
                configMapper, auditMapper, crypto, new ResumePhotoOssProperties());
    }

    @Test
    void disabledOrMissingConfigurationDoesNotBlockStartupAndFailsFeatureClosed() {
        when(configMapper.selectById(ResumePhotoOssConfig.SINGLE_ROW_ID)).thenReturn(disabledConfig());

        BusinessException error = assertThrows(BusinessException.class, service::resolveActive);

        assertEquals(ResultCode.RESUME_PHOTO_STORAGE_UNAVAILABLE.getCode(), error.getCode());
    }

    @Test
    void viewReturnsOnlyMasks() {
        ResumePhotoOssConfig config = disabledConfig();
        config.setAccessKeyIdCipher(crypto.encrypt("LTAI-test-access-id"));
        config.setAccessKeySecretCipher(crypto.encrypt("test-access-secret-value"));
        config.setAccessKeyIdMask("LTAI••••s-id");
        config.setAccessKeySecretMask("test••••alue");
        when(configMapper.selectById(ResumePhotoOssConfig.SINGLE_ROW_ID)).thenReturn(config);

        var view = service.view();

        assertTrue(view.isCredentialsConfigured());
        assertEquals("LTAI••••s-id", view.getAccessKeyIdMask());
        assertEquals("test••••alue", view.getAccessKeySecretMask());
        assertTrue(view.isMasterKeyConfigured());
    }

    @Test
    void endpointHostIsNormalizedAndSavingMakesConfigurationActive() {
        ResumePhotoOssConfig config = disabledConfig();
        when(configMapper.selectById(ResumePhotoOssConfig.SINGLE_ROW_ID)).thenReturn(config);
        ResumePhotoOssConfigUpdateDTO dto = completeUpdate();
        dto.setEndpoint("oss-cn-beijing.aliyuncs.com");

        var view = service.update(7L, dto);
        var active = service.resolveActive();

        assertEquals("oss-cn-beijing.aliyuncs.com", view.getEndpoint());
        assertEquals("https://oss-cn-beijing.aliyuncs.com", active.endpoint());
        verify(configMapper).updateById(config);
    }

    @Test
    void adminCanEncryptEnableAndResolveCurrentConfiguration() {
        ResumePhotoOssConfig config = disabledConfig();
        when(configMapper.selectById(ResumePhotoOssConfig.SINGLE_ROW_ID)).thenReturn(config);

        var view = service.update(7L, completeUpdate());
        var active = service.resolveActive();

        assertTrue(view.isCredentialsConfigured());
        assertEquals("https://oss-cn-hangzhou.aliyuncs.com", active.endpoint());
        assertEquals("private-resume-bucket", active.bucket());
        assertEquals("LTAI-test-access-id", active.accessKeyId());
        assertEquals("test-access-secret-value", active.accessKeySecret());
        verify(configMapper).updateById(config);
        verify(auditMapper).insert(any(ResumePhotoOssConfigAudit.class));
    }

    private ResumePhotoOssConfig disabledConfig() {
        ResumePhotoOssConfig config = new ResumePhotoOssConfig();
        config.setId(ResumePhotoOssConfig.SINGLE_ROW_ID);
        config.setEndpoint("");
        config.setBucket("");
        config.setPrivateBucketConfirmed(false);
        config.setCorsConfirmed(false);
        config.setStagingLifecycleConfirmed(false);
        config.setRamPolicyConfirmed(false);
        config.setEnabled(false);
        return config;
    }

    private ResumePhotoOssConfigUpdateDTO completeUpdate() {
        ResumePhotoOssConfigUpdateDTO dto = new ResumePhotoOssConfigUpdateDTO();
        dto.setEndpoint("https://oss-cn-hangzhou.aliyuncs.com");
        dto.setBucket("private-resume-bucket");
        dto.setAccessKeyId("LTAI-test-access-id");
        dto.setAccessKeySecret("test-access-secret-value");
        return dto;
    }
}
