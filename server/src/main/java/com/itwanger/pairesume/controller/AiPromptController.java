package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.MembershipService;
import com.itwanger.pairesume.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/resumes/field-optimize-methods")
@RequiredArgsConstructor
public class AiPromptController {
    private final AiService aiService;
    private final MembershipService membershipService;

    public record MethodView(String id, String name, String description) {}

    @GetMapping
    public Result<List<MethodView>> methods() {
        membershipService.requireAiAccess(SecurityUtils.getCurrentUserId());
        return Result.success(List.of("standard", "asu").stream().map(id -> {
            var config = aiService.getFieldOptimizePromptConfig(id);
            return new MethodView(id, config.getName(), config.getDescription());
        }).toList());
    }
}
