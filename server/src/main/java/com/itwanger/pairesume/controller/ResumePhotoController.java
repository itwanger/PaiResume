package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.service.ResumePhotoUploadRateLimitService;
import com.itwanger.pairesume.service.impl.ResumePhotoService;
import com.itwanger.pairesume.util.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

@RestController
@RequestMapping("/resume-photos")
@RequiredArgsConstructor
public class ResumePhotoController {
    private final ResumePhotoService photoService;
    private final ResumePhotoUploadRateLimitService rateLimitService;

    @PostMapping("/uploads")
    public Result<ResumePhotoUploadAuthorizationDTO> authorize(
            @Valid @RequestBody CreateResumePhotoUploadDTO dto, HttpServletRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        rateLimitService.acquireAttempt("authorize", userId, request.getRemoteAddr());
        return Result.success(photoService.authorize(userId, dto));
    }

    @PostMapping("/uploads/{photoNo}/complete")
    public Result<ResumePhotoDTO> complete(@PathVariable String photoNo, HttpServletRequest request) {
        Long userId = SecurityUtils.getCurrentUserId();
        rateLimitService.acquireAttempt("complete", userId, request.getRemoteAddr());
        return Result.success(photoService.complete(userId, photoNo));
    }

    @GetMapping("/{photoId}/content")
    public ResponseEntity<byte[]> content(@PathVariable Long photoId) {
        var photo = photoService.readContent(SecurityUtils.getCurrentUserId(), photoId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(photo.contentType()))
                .cacheControl(CacheControl.noStore())
                .header("X-Content-Type-Options", "nosniff")
                .body(photo.bytes());
    }

    @GetMapping("/{photoId}/access")
    public Result<ResumePhotoDTO> access(@PathVariable Long photoId) {
        Long userId = SecurityUtils.getCurrentUserId();
        return Result.success(photoService.access(userId, photoId));
    }
}
