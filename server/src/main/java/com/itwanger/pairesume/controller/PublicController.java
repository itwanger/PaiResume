package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.FeedbackSubmissionCreateDTO;
import com.itwanger.pairesume.dto.HomeDTO;
import com.itwanger.pairesume.dto.ShowcaseDetailDTO;
import com.itwanger.pairesume.service.FeedbackSubmissionService;
import com.itwanger.pairesume.service.PublicHomeService;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@Tag(name = "公开内容接口")
@RestController
@RequestMapping("/public")
@RequiredArgsConstructor
public class PublicController {
    private final PublicHomeService publicHomeService;
    private final ResumeShowcaseService resumeShowcaseService;
    private final FeedbackSubmissionService feedbackSubmissionService;

    @Operation(summary = "公开首页聚合数据")
    @GetMapping("/home")
    public Result<HomeDTO> home() {
        return Result.success(publicHomeService.getHome());
    }

    @Operation(summary = "公开样例详情")
    @GetMapping("/showcases/{slug}")
    public Result<ShowcaseDetailDTO> showcaseDetail(@PathVariable String slug) {
        return Result.success(resumeShowcaseService.getPublishedDetail(slug));
    }

    @Operation(summary = "提交公开问卷")
    @PostMapping("/feedback-submissions")
    public Result<Void> submitFeedback(@Valid @RequestBody FeedbackSubmissionCreateDTO dto,
                                       HttpServletRequest request) {
        feedbackSubmissionService.submit(dto, request.getRemoteAddr());
        return Result.success();
    }
}
