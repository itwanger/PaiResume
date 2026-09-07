package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.FieldOptimizePromptConfigDTO;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.impl.FieldOptimizePromptService;
import com.itwanger.pairesume.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/admin/field-optimize-prompts")
@RequiredArgsConstructor
public class AdminFieldOptimizePromptController {
    private final AiService aiService;
    private final FieldOptimizePromptService service;

    @GetMapping
    public Result<List<FieldOptimizePromptConfigDTO>> list() {
        return Result.success(List.of("standard", "asu").stream()
                .map(aiService::getFieldOptimizePromptConfig).toList());
    }

    @PutMapping("/{presetId}")
    public Result<FieldOptimizePromptConfigDTO> update(@PathVariable String presetId,
                                                      @RequestBody FieldOptimizePromptConfigDTO request) {
        return Result.success(service.save(presetId, request, SecurityUtils.getCurrentUserId()));
    }
}
