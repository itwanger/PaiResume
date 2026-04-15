package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.service.*;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "管理后台接口")
@RestController
@RequestMapping("/admin")
@RequiredArgsConstructor
public class AdminController {
    private final PlatformConfigService platformConfigService;
    private final FeedbackSubmissionService feedbackSubmissionService;
    private final CouponService couponService;
    private final MembershipService membershipService;
    private final ResumeShowcaseService resumeShowcaseService;

    @Operation(summary = "获取平台配置")
    @GetMapping("/platform-config")
    public Result<PlatformConfigDTO> getPlatformConfig() {
        return Result.success(platformConfigService.getConfig());
    }

    @Operation(summary = "更新平台配置")
    @PutMapping("/platform-config")
    public Result<PlatformConfigDTO> updatePlatformConfig(@Valid @RequestBody PlatformConfigDTO dto) {
        return Result.success(platformConfigService.updateConfig(SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "获取问卷列表")
    @GetMapping("/feedback-submissions")
    public Result<List<FeedbackSubmissionAdminDTO>> listFeedbackSubmissions() {
        return Result.success(feedbackSubmissionService.listAdminSubmissions());
    }

    @Operation(summary = "通过问卷并发放优惠码")
    @PostMapping("/feedback-submissions/{id}/approve")
    public Result<FeedbackSubmissionAdminDTO> approveFeedback(@PathVariable Long id,
                                                              @RequestBody(required = false) ApproveFeedbackSubmissionDTO dto) {
        return Result.success(feedbackSubmissionService.approve(id, SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "拒绝问卷")
    @PostMapping("/feedback-submissions/{id}/reject")
    public Result<FeedbackSubmissionAdminDTO> rejectFeedback(@PathVariable Long id,
                                                             @Valid @RequestBody RejectFeedbackSubmissionDTO dto) {
        return Result.success(feedbackSubmissionService.reject(id, SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "发布评价")
    @PostMapping("/feedback-submissions/{id}/publish")
    public Result<FeedbackSubmissionAdminDTO> publishFeedback(@PathVariable Long id) {
        return Result.success(feedbackSubmissionService.publish(id, SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "下线评价")
    @PostMapping("/feedback-submissions/{id}/unpublish")
    public Result<FeedbackSubmissionAdminDTO> unpublishFeedback(@PathVariable Long id) {
        return Result.success(feedbackSubmissionService.unpublish(id, SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "重发优惠码")
    @PostMapping("/feedback-submissions/{id}/resend-coupon")
    public Result<FeedbackSubmissionAdminDTO> resendCoupon(@PathVariable Long id) {
        return Result.success(feedbackSubmissionService.resendCoupon(id, SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "获取优惠码列表")
    @GetMapping("/coupons")
    public Result<List<CouponAdminDTO>> listCoupons() {
        return Result.success(couponService.listCoupons());
    }

    @Operation(summary = "获取用户列表")
    @GetMapping("/users")
    public Result<List<UserAdminDTO>> listUsers() {
        return Result.success(membershipService.listUsers());
    }

    @Operation(summary = "手工开通会员")
    @PostMapping("/users/{id}/membership/grant")
    public Result<UserAdminDTO> grantMembership(@PathVariable Long id) {
        return Result.success(membershipService.grantMembership(id, SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "撤销会员")
    @PostMapping("/users/{id}/membership/revoke")
    public Result<UserAdminDTO> revokeMembership(@PathVariable Long id) {
        return Result.success(membershipService.revokeMembership(id, SecurityUtils.getCurrentUserId()));
    }

    @Operation(summary = "获取样例列表")
    @GetMapping("/showcases")
    public Result<List<ResumeShowcase>> listShowcases() {
        return Result.success(resumeShowcaseService.listAdminShowcases());
    }

    @Operation(summary = "创建样例")
    @PostMapping("/showcases")
    public Result<ResumeShowcase> createShowcase(@Valid @RequestBody ResumeShowcaseUpsertDTO dto) {
        return Result.success(resumeShowcaseService.create(SecurityUtils.getCurrentUserId(), dto));
    }

    @Operation(summary = "更新样例")
    @PutMapping("/showcases/{id}")
    public Result<ResumeShowcase> updateShowcase(@PathVariable Long id,
                                                 @Valid @RequestBody ResumeShowcaseUpsertDTO dto) {
        return Result.success(resumeShowcaseService.update(id, SecurityUtils.getCurrentUserId(), dto));
    }
}
