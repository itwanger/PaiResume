package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.ResumeReviewQueueItemDTO;
import com.itwanger.pairesume.service.ResumeReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/public/resume-reviews")
@RequiredArgsConstructor
public class PublicResumeReviewController {
    private final ResumeReviewService service;

    @GetMapping("/queue")
    public Result<List<ResumeReviewQueueItemDTO>> queue() {
        return Result.success(service.publicQueue());
    }
}
