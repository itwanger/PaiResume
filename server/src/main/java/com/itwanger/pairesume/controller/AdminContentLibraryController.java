package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.OfficialResumeMaterial;
import com.itwanger.pairesume.entity.ResumeContentTemplate;
import com.itwanger.pairesume.service.ResumeContentLibraryService;
import com.itwanger.pairesume.util.SecurityUtils;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "管理后台-简历内容库")
@RestController
@RequestMapping("/admin/content-library")
@RequiredArgsConstructor
public class AdminContentLibraryController {
    private final ResumeContentLibraryService service;

    @GetMapping("/materials")
    public Result<List<OfficialResumeMaterial>> listMaterials() {
        return Result.success(service.listAdminMaterials());
    }

    @PostMapping("/materials")
    public Result<OfficialResumeMaterial> createMaterial(@Valid @RequestBody OfficialMaterialUpsertDTO dto) {
        return Result.success(service.createOfficialMaterial(adminId(), dto));
    }

    @PutMapping("/materials/{id}")
    public Result<OfficialResumeMaterial> updateMaterial(@PathVariable Long id,
                                                        @Valid @RequestBody OfficialMaterialUpsertDTO dto) {
        return Result.success(service.updateOfficialMaterial(adminId(), id, dto));
    }

    @GetMapping("/templates")
    public Result<List<ResumeContentTemplate>> listTemplates() {
        return Result.success(service.listAdminTemplates());
    }

    @PostMapping("/templates")
    public Result<ResumeContentTemplate> createTemplate(@Valid @RequestBody ContentTemplateUpsertDTO dto) {
        return Result.success(service.createContentTemplate(adminId(), dto));
    }

    @PutMapping("/templates/{id}")
    public Result<ResumeContentTemplate> updateTemplate(@PathVariable Long id,
                                                       @Valid @RequestBody ContentTemplateUpsertDTO dto) {
        return Result.success(service.updateContentTemplate(adminId(), id, dto));
    }

    @Operation(summary = "使用 AI 生成待审核的官方素材草稿")
    @PostMapping("/ai-drafts")
    public Result<Map<String, Object>> generateAiDraft(@Valid @RequestBody LibraryAiDraftRequestDTO dto) {
        return Result.success(service.generateAiDraft(dto));
    }

    private Long adminId() {
        return SecurityUtils.getCurrentUserId();
    }
}
