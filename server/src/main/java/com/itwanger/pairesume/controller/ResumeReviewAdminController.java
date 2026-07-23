package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.service.ResumeReviewService;
import com.itwanger.pairesume.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/admin/resume-reviews")
@RequiredArgsConstructor
public class ResumeReviewAdminController {
    private final ResumeReviewService service;

    @GetMapping
    public Result<List<ResumeReviewAdminRequestDTO>> list() {
        return Result.success(service.adminList());
    }

    @GetMapping("/{requestNo}")
    public Result<ResumeReviewAdminRequestDTO> get(@PathVariable String requestNo) {
        return Result.success(service.adminGet(requestNo));
    }

    @GetMapping("/{requestNo}/audits")
    public Result<List<ResumeReviewAuditDTO>> audits(@PathVariable String requestNo) {
        return Result.success(service.adminAudits(requestNo));
    }

    @PostMapping("/{requestNo}/accept")
    public Result<ResumeReviewRequestDTO> accept(@PathVariable String requestNo,
                                                 @Valid @RequestBody ResumeReviewAdminActionDTO dto) {
        return Result.success(service.adminAccept(requestNo, SecurityUtils.getCurrentUserId(), dto.getReason()));
    }

    @PostMapping("/{requestNo}/complete")
    public Result<ResumeReviewRequestDTO> complete(@PathVariable String requestNo,
                                                   @Valid @RequestBody ResumeReviewAdminActionDTO dto) {
        return Result.success(service.adminComplete(requestNo, SecurityUtils.getCurrentUserId(), dto.getReason()));
    }

    @PostMapping("/{requestNo}/return")
    public Result<ResumeReviewRequestDTO> returnRequest(@PathVariable String requestNo,
                                                        @Valid @RequestBody ResumeReviewAdminActionDTO dto) {
        return Result.success(service.adminReturn(requestNo, SecurityUtils.getCurrentUserId(), dto.getReason()));
    }

    @PostMapping("/{requestNo}/mail/retry")
    public Result<ResumeReviewRequestDTO> retryMail(@PathVariable String requestNo,
                                                    @Valid @RequestBody ResumeReviewAdminActionDTO dto) {
        return Result.success(service.adminRetryMail(requestNo, SecurityUtils.getCurrentUserId(), dto.getReason()));
    }

    @PostMapping("/{requestNo}/refund/confirm")
    public Result<ResumeReviewRequestDTO> confirmRefund(@PathVariable String requestNo,
                                                        @Valid @RequestBody ResumeReviewRefundConfirmDTO dto) {
        return Result.success(service.adminConfirmRefund(requestNo, SecurityUtils.getCurrentUserId(),
                dto.getRefundReference(), dto.getReason()));
    }

    @PostMapping("/follow-fallback-codes")
    public Result<ResumeReviewFallbackCodeDTO> createFallbackCode(
            @RequestParam(defaultValue = "24") int validHours) {
        return Result.success(service.adminCreateFallbackCode(SecurityUtils.getCurrentUserId(), validHours));
    }

    @GetMapping("/follow-fallback-codes")
    public Result<List<ResumeReviewFallbackCodeDTO>> listFallbackCodes() {
        return Result.success(service.adminListFallbackCodes());
    }
}
