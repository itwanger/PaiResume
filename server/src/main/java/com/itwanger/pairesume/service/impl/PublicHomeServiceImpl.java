package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.config.MarketplaceFeatureProperties;
import com.itwanger.pairesume.dto.HomeDTO;
import com.itwanger.pairesume.service.FeedbackSubmissionService;
import com.itwanger.pairesume.service.PlatformConfigService;
import com.itwanger.pairesume.service.PublicHomeService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import com.itwanger.pairesume.service.MembershipPlanService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PublicHomeServiceImpl implements PublicHomeService {
    private final PlatformConfigService platformConfigService;
    private final MembershipPlanService membershipPlanService;
    private final ResumeShowcaseService resumeShowcaseService;
    private final FeedbackSubmissionService feedbackSubmissionService;
    private final MarketplaceFeatureProperties marketplaceFeatureProperties;

    @Override
    public HomeDTO getHome() {
        HomeDTO dto = new HomeDTO();
        var config = platformConfigService.getConfig();
        var annualPlan = membershipPlanService.listPlans().stream()
                .filter(plan -> "ANNUAL".equals(plan.getCode()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("ANNUAL membership plan is missing"));
        dto.setMembershipPriceCents(
                annualPlan.isEnabled() ? annualPlan.getPriceCents() : null);
        dto.setQuestionnaireCouponAmountCents(config.getQuestionnaireCouponAmountCents());
        dto.setMarketplaceEnabled(marketplaceFeatureProperties.isEnabled());
        dto.setShowcases(resumeShowcaseService.listPublishedShowcases());
        dto.setTestimonials(feedbackSubmissionService.listPublishedTestimonials());
        return dto;
    }
}
