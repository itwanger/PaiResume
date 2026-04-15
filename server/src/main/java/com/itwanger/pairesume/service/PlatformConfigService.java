package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.PlatformConfigDTO;
import com.itwanger.pairesume.entity.PlatformConfig;

public interface PlatformConfigService {
    PlatformConfigDTO getConfig();

    PlatformConfigDTO updateConfig(Long adminUserId, PlatformConfigDTO dto);

    PlatformConfig getConfigEntity();
}
