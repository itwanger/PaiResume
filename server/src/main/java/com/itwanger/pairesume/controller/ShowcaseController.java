package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.ShowcaseDetailDTO;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "优质简历接口")
@RestController
@RequestMapping("/showcases")
@RequiredArgsConstructor
public class ShowcaseController {
    private final ResumeShowcaseService resumeShowcaseService;

    @Operation(summary = "查看优质简历详情")
    @GetMapping("/{slug}")
    public Result<ShowcaseDetailDTO> detail(
            @PathVariable String slug,
            @RequestHeader(value = "X-Showcase-Purchase-Token", required = false) String purchaseToken
    ) {
        return Result.success(resumeShowcaseService.getPublishedDetail(
                slug,
                SecurityUtils.getCurrentUserId(),
                purchaseToken
        ));
    }
}
