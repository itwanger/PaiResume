package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ResumePhotoOssConfigUpdateDTO;
import com.itwanger.pairesume.dto.ResumePhotoOssConfigViewDTO;
import com.itwanger.pairesume.dto.ResumePhotoOssTestResultDTO;

public interface ResumePhotoOssConfigService {
    ResumePhotoOssConfigViewDTO view();

    ResumePhotoOssConfigViewDTO update(Long adminUserId, ResumePhotoOssConfigUpdateDTO dto);

    ResumePhotoOssTestResultDTO testConnection(Long adminUserId, ResumePhotoOssConfigUpdateDTO dto);

    ActiveResumePhotoOssConfig resolveActive();

    record ActiveResumePhotoOssConfig(
            String endpoint,
            String bucket,
            String accessKeyId,
            String accessKeySecret
    ) {
    }
}
