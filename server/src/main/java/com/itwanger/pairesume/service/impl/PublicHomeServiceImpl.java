package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.HomeDTO;
import com.itwanger.pairesume.service.FeedbackSubmissionService;
import com.itwanger.pairesume.service.PlatformConfigService;
import com.itwanger.pairesume.service.PublicHomeService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PublicHomeServiceImpl implements PublicHomeService {
    private final PlatformConfigService platformConfigService;
    private final ResumeShowcaseService resumeShowcaseService;
    private final FeedbackSubmissionService feedbackSubmissionService;

    @Override
    public HomeDTO getHome() {
        HomeDTO dto = new HomeDTO();
        var config = platformConfigService.getConfig();
        dto.setMembershipPriceCents(config.getMembershipPriceCents());
        dto.setQuestionnaireCouponAmountCents(config.getQuestionnaireCouponAmountCents());
        dto.setShowcases(resumeShowcaseService.listPublishedShowcases());
        dto.setTestimonials(feedbackSubmissionService.listPublishedTestimonials());
        return dto;
    }
}
