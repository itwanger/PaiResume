package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.ResumePhotoOssConfigUpdateDTO;
import com.itwanger.pairesume.dto.ResumePhotoOssConfigViewDTO;
import com.itwanger.pairesume.dto.ResumePhotoOssTestResultDTO;
import com.itwanger.pairesume.service.ResumePhotoOssConfigService;
import com.itwanger.pairesume.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/resume-photo-oss")
@RequiredArgsConstructor
public class AdminResumePhotoOssController {
    private final ResumePhotoOssConfigService service;

    @GetMapping
    public Result<ResumePhotoOssConfigViewDTO> view() {
        return Result.success(service.view());
    }

    @PutMapping
    public Result<ResumePhotoOssConfigViewDTO> update(
            @Valid @RequestBody ResumePhotoOssConfigUpdateDTO request) {
        return Result.success(service.update(SecurityUtils.getCurrentUserId(), request));
    }

    @PostMapping("/test")
    public Result<ResumePhotoOssTestResultDTO> testConnection() {
        return Result.success(service.testConnection(SecurityUtils.getCurrentUserId()));
    }
}
