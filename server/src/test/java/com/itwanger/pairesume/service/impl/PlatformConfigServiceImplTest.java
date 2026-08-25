package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.PlatformConfigDTO;
import com.itwanger.pairesume.entity.PlatformConfig;
import com.itwanger.pairesume.mapper.PlatformConfigMapper;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PlatformConfigServiceImplTest {
    @Mock
    private PlatformConfigMapper platformConfigMapper;

    @Test
    void legacyPlatformUpdateCannotChangeAnnualMembershipPriceMirror() {
        PlatformConfig config = new PlatformConfig();
        config.setId(1L);
        config.setMembershipPriceCents(6600);
        config.setQuestionnaireCouponAmountCents(1000);
        config.setResumeReviewPriceCents(0);
        when(platformConfigMapper.selectById(1L)).thenReturn(config);
        ResumeReviewProperties properties = new ResumeReviewProperties();
        properties.setRecipientEmail("fallback@paicoding.com");
        PlatformConfigServiceImpl service = new PlatformConfigServiceImpl(platformConfigMapper, properties);
        PlatformConfigDTO request = new PlatformConfigDTO();
        request.setMembershipPriceCents(1);
        request.setQuestionnaireCouponAmountCents(1200);
        request.setResumeReviewPriceCents(5000);
        request.setResumeReviewRecipientEmail("Review@Paicoding.com");

        PlatformConfigDTO result = service.updateConfig(99L, request);

        assertEquals(6600, result.getMembershipPriceCents());
        assertEquals(1200, result.getQuestionnaireCouponAmountCents());
        assertEquals(5000, result.getResumeReviewPriceCents());
        assertEquals("review@paicoding.com", result.getResumeReviewRecipientEmail());
        assertEquals(99L, config.getUpdatedBy());
        verify(platformConfigMapper).updateById(config);
    }

    @Test
    void blankReviewRecipientFallsBackToExistingMailFromConfiguration() {
        PlatformConfig config = new PlatformConfig();
        config.setId(1L);
        config.setResumeReviewRecipientEmail(null);
        when(platformConfigMapper.selectById(1L)).thenReturn(config);
        ResumeReviewProperties properties = new ResumeReviewProperties();
        properties.setRecipientEmail("existing-163@example.com");
        PlatformConfigServiceImpl service = new PlatformConfigServiceImpl(platformConfigMapper, properties);

        assertEquals("existing-163@example.com", service.getResumeReviewRecipientEmail());
        assertEquals("existing-163@example.com", service.getConfig().getResumeReviewRecipientEmail());
    }
}
