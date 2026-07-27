package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.config.MarketplaceFeatureProperties;
import com.itwanger.pairesume.dto.PlatformConfigDTO;
import com.itwanger.pairesume.dto.MembershipPlanDTO;
import com.itwanger.pairesume.service.FeedbackSubmissionService;
import com.itwanger.pairesume.service.PlatformConfigService;
import com.itwanger.pairesume.service.MembershipPlanService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PublicHomeServiceImplTest {
    @Mock private PlatformConfigService platformConfigService;
    @Mock private MembershipPlanService membershipPlanService;
    @Mock private ResumeShowcaseService resumeShowcaseService;
    @Mock private FeedbackSubmissionService feedbackSubmissionService;
    @Mock private MarketplaceFeatureProperties marketplaceFeatureProperties;

    @Test
    void exposesMarketplaceFeatureStateSoPublicCopyMatchesTheActiveLaunchStage() {
        PlatformConfigDTO config = new PlatformConfigDTO();
        config.setMembershipPriceCents(6900);
        config.setQuestionnaireCouponAmountCents(1300);
        when(platformConfigService.getConfig()).thenReturn(config);
        MembershipPlanDTO annual = new MembershipPlanDTO();
        annual.setCode("ANNUAL");
        annual.setName("年卡");
        annual.setPriceCents(6900);
        annual.setEnabled(true);
        when(membershipPlanService.listPlans()).thenReturn(List.of(annual));
        when(resumeShowcaseService.listPublishedShowcases()).thenReturn(List.of());
        when(feedbackSubmissionService.listPublishedTestimonials()).thenReturn(List.of());
        when(marketplaceFeatureProperties.isEnabled()).thenReturn(true);

        PublicHomeServiceImpl service = new PublicHomeServiceImpl(
                platformConfigService,
                membershipPlanService,
                resumeShowcaseService,
                feedbackSubmissionService,
                marketplaceFeatureProperties
        );

        var result = service.getHome();

        assertTrue(result.isMarketplaceEnabled());
        assertEquals(6900, result.getMembershipPriceCents());
        assertEquals(1300, result.getQuestionnaireCouponAmountCents());
    }
}
