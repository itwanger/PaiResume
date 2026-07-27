package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.PlatformConfigDTO;
import com.itwanger.pairesume.entity.PlatformConfig;
import com.itwanger.pairesume.mapper.PlatformConfigMapper;
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
        PlatformConfigServiceImpl service = new PlatformConfigServiceImpl(platformConfigMapper);
        PlatformConfigDTO request = new PlatformConfigDTO();
        request.setMembershipPriceCents(1);
        request.setQuestionnaireCouponAmountCents(1200);
        request.setResumeReviewPriceCents(5000);

        PlatformConfigDTO result = service.updateConfig(99L, request);

        assertEquals(6600, result.getMembershipPriceCents());
        assertEquals(1200, result.getQuestionnaireCouponAmountCents());
        assertEquals(5000, result.getResumeReviewPriceCents());
        assertEquals(99L, config.getUpdatedBy());
        verify(platformConfigMapper).updateById(config);
    }
}
