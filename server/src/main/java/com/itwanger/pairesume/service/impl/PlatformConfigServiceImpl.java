package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.PlatformConfigDTO;
import com.itwanger.pairesume.entity.PlatformConfig;
import com.itwanger.pairesume.mapper.PlatformConfigMapper;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.service.PlatformConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PlatformConfigServiceImpl implements PlatformConfigService {
    private static final long PLATFORM_CONFIG_ID = 1L;

    private final PlatformConfigMapper platformConfigMapper;
    private final ResumeReviewProperties resumeReviewProperties;

    @Override
    public PlatformConfigDTO getConfig() {
        return toDto(getConfigEntity());
    }

    @Override
    public PlatformConfigDTO updateConfig(Long adminUserId, PlatformConfigDTO dto) {
        PlatformConfig config = getConfigEntity();
        // membership_price_cents is now a read-only compatibility mirror of
        // membership_plan.ANNUAL. It is synchronized only by
        // MembershipPlanServiceImpl so this legacy endpoint cannot create a
        // second purchase-price source.
        config.setQuestionnaireCouponAmountCents(dto.getQuestionnaireCouponAmountCents());
        config.setResumeReviewPriceCents(dto.getResumeReviewPriceCents());
        config.setResumeReviewRecipientEmail(normalizeEmail(dto.getResumeReviewRecipientEmail()));
        config.setUpdatedBy(adminUserId);
        platformConfigMapper.updateById(config);
        return toDto(config);
    }

    @Override
    public PlatformConfig getConfigEntity() {
        PlatformConfig config = platformConfigMapper.selectById(PLATFORM_CONFIG_ID);
        if (config != null) {
            return config;
        }

        config = new PlatformConfig();
        config.setId(PLATFORM_CONFIG_ID);
        config.setMembershipPriceCents(6600);
        config.setQuestionnaireCouponAmountCents(1000);
        config.setResumeReviewPriceCents(0);
        config.setResumeReviewRecipientEmail(normalizeEmail(resumeReviewProperties.getRecipientEmail()));
        platformConfigMapper.insert(config);
        return config;
    }

    @Override
    public String getResumeReviewRecipientEmail() {
        PlatformConfig config = getConfigEntity();
        String configured = normalizeEmail(config.getResumeReviewRecipientEmail());
        if (configured != null) return configured;
        return normalizeEmail(resumeReviewProperties.getRecipientEmail());
    }

    private PlatformConfigDTO toDto(PlatformConfig config) {
        PlatformConfigDTO dto = new PlatformConfigDTO();
        dto.setMembershipPriceCents(config.getMembershipPriceCents());
        dto.setQuestionnaireCouponAmountCents(config.getQuestionnaireCouponAmountCents());
        dto.setResumeReviewPriceCents(config.getResumeReviewPriceCents());
        String recipientEmail = normalizeEmail(config.getResumeReviewRecipientEmail());
        dto.setResumeReviewRecipientEmail(recipientEmail != null
                ? recipientEmail : java.util.Objects.requireNonNullElse(
                        normalizeEmail(resumeReviewProperties.getRecipientEmail()), ""));
        return dto;
    }

    private String normalizeEmail(String value) {
        if (value == null || value.isBlank()) return null;
        return value.trim().toLowerCase(java.util.Locale.ROOT);
    }
}
