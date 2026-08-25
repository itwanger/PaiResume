package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.service.ResumeReviewService;
import com.itwanger.pairesume.service.ResumeReviewUploadRateLimitService;
import com.itwanger.pairesume.util.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.MediaType;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/resume-reviews")
@RequiredArgsConstructor
public class ResumeReviewController {
    private final ResumeReviewService service;
    private final ResumeReviewUploadRateLimitService rateLimitService;

    @GetMapping("/eligibility")
    public Result<ResumeReviewEligibilityDTO> eligibility() {
        return Result.success(service.eligibility(SecurityUtils.getCurrentUserId()));
    }

    @GetMapping("/current")
    public Result<ResumeReviewRequestDTO> current() {
        return Result.success(service.current(SecurityUtils.getCurrentUserId()));
    }

    @PostMapping("/contact-email/code")
    public Result<Void> sendContactCode(@Valid @RequestBody ContactEmailDTO dto,
                                        HttpServletRequest request) {
        service.sendContactVerificationCode(SecurityUtils.getCurrentUserId(),
                dto.getContactEmail(), request.getRemoteAddr());
        return Result.success();
    }

    @PostMapping
    public Result<ResumeReviewRequestDTO> create(@Valid @RequestBody CreateResumeReviewRequestDTO dto,
                                                 HttpServletRequest request) {
        return Result.success(service.create(SecurityUtils.getCurrentUserId(), dto,
                request.getRemoteAddr()));
    }

    @GetMapping("/{requestNo}")
    public Result<ResumeReviewRequestDTO> get(@PathVariable String requestNo) {
        return Result.success(service.get(SecurityUtils.getCurrentUserId(), requestNo));
    }

    @PatchMapping("/{requestNo}/contact-email")
    public Result<ResumeReviewRequestDTO> updateContactEmail(
            @PathVariable String requestNo,
            @Valid @RequestBody ContactEmailDTO dto) {
        return Result.success(service.updateContactEmail(SecurityUtils.getCurrentUserId(),
                requestNo, dto.getContactEmail(), dto.getVerificationCode()));
    }

    @PostMapping("/{requestNo}/priority")
    public Result<ResumeReviewRequestDTO> upgradePriority(
            @PathVariable String requestNo,
            @Valid @RequestBody UpgradeResumeReviewPriorityDTO dto,
            HttpServletRequest request) {
        return Result.success(service.upgradePriority(SecurityUtils.getCurrentUserId(), requestNo,
                dto.getPriorityFeeCents(), request.getRemoteAddr()));
    }

    @PostMapping("/{requestNo}/payment/refresh")
    public Result<ResumeReviewRequestDTO> refresh(@PathVariable String requestNo) {
        return Result.success(service.refreshPayment(SecurityUtils.getCurrentUserId(), requestNo));
    }

    @PostMapping(value = "/{requestNo}/dispatch", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Result<ResumeReviewRequestDTO> dispatch(@PathVariable String requestNo,
                                                    @RequestPart("file") MultipartFile file,
                                                    HttpServletRequest request) {
        rateLimitService.acquireAttempt("dispatch", SecurityUtils.getCurrentUserId(),
                request.getRemoteAddr());
        return Result.success(service.dispatch(SecurityUtils.getCurrentUserId(), requestNo, file));
    }

    @Data
    public static class ContactEmailDTO {
        @NotBlank @Email @Size(max = 128)
        private String contactEmail;

        @Size(max = 12)
        private String verificationCode;
    }
}
