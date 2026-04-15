package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.PlatformConfigDTO;
import com.itwanger.pairesume.entity.PlatformConfig;
import com.itwanger.pairesume.mapper.PlatformConfigMapper;
import com.itwanger.pairesume.service.PlatformConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class PlatformConfigServiceImpl implements PlatformConfigService {
    private static final long PLATFORM_CONFIG_ID = 1L;

    private final PlatformConfigMapper platformConfigMapper;

    @Override
    public PlatformConfigDTO getConfig() {
        return toDto(getConfigEntity());
    }

    @Override
    public PlatformConfigDTO updateConfig(Long adminUserId, PlatformConfigDTO dto) {
        PlatformConfig config = getConfigEntity();
        config.setMembershipPriceCents(dto.getMembershipPriceCents());
        config.setQuestionnaireCouponAmountCents(dto.getQuestionnaireCouponAmountCents());
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
        platformConfigMapper.insert(config);
        return config;
    }

    private PlatformConfigDTO toDto(PlatformConfig config) {
        PlatformConfigDTO dto = new PlatformConfigDTO();
        dto.setMembershipPriceCents(config.getMembershipPriceCents());
        dto.setQuestionnaireCouponAmountCents(config.getQuestionnaireCouponAmountCents());
        return dto;
    }
}
