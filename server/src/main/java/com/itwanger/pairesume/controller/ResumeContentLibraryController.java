package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.*;
import com.itwanger.pairesume.service.ResumeContentLibraryService;
import com.itwanger.pairesume.util.SecurityUtils;
import com.itwanger.pairesume.vo.ResumeListVO;
import com.itwanger.pairesume.vo.ResumeHistoryMaterialVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "简历资料库")
@RestController
@RequestMapping("/content-library")
@RequiredArgsConstructor
public class ResumeContentLibraryController {
    private final ResumeContentLibraryService service;

    @Operation(summary = "获取我的常用资料")
    @GetMapping("/profile")
    public Result<UserResumeProfile> getProfile() {
        return Result.success(service.getProfile(userId()));
    }

    @Operation(summary = "保存我的常用资料")
    @PutMapping("/profile")
    public Result<UserResumeProfile> saveProfile(@Valid @RequestBody ResumeProfileUpdateDTO dto) {
        return Result.success(service.saveProfile(userId(), dto));
    }

    @Operation(summary = "查询我的模块资料")
    @GetMapping("/my-materials")
    public Result<List<UserResumeMaterial>> listMyMaterials(
            @RequestParam(required = false) String moduleType,
            @RequestParam(required = false) String query
    ) {
        return Result.success(service.listUserMaterials(userId(), moduleType, query));
    }

    @Operation(summary = "从历史简历自动汇总可复用资料")
    @GetMapping("/history-materials")
    public Result<List<ResumeHistoryMaterialVO>> listHistoryMaterials(
            @RequestParam(required = false) String moduleType,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) Long excludeResumeId
    ) {
        return Result.success(service.listHistoryMaterials(userId(), moduleType, query, excludeResumeId));
    }

    @Operation(summary = "保存模块到我的资料库")
    @PostMapping("/my-materials")
    public Result<UserResumeMaterial> createMyMaterial(@Valid @RequestBody ResumeMaterialUpsertDTO dto) {
        return Result.success(service.createUserMaterial(userId(), dto));
    }

    @Operation(summary = "更新我的模块资料")
    @PutMapping("/my-materials/{id}")
    public Result<UserResumeMaterial> updateMyMaterial(@PathVariable Long id,
                                                       @Valid @RequestBody ResumeMaterialUpsertDTO dto) {
        return Result.success(service.updateUserMaterial(userId(), id, dto));
    }

    @Operation(summary = "删除我的模块资料")
    @DeleteMapping("/my-materials/{id}")
    public Result<Void> deleteMyMaterial(@PathVariable Long id) {
        service.deleteUserMaterial(userId(), id);
        return Result.success();
    }

    @Operation(summary = "查询官方参考素材")
    @GetMapping("/official-materials")
    public Result<List<OfficialResumeMaterial>> listOfficialMaterials(
            @RequestParam(required = false) String moduleType,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String targetRole
    ) {
        return Result.success(service.listPublishedMaterials(moduleType, query, targetRole));
    }

    @Operation(summary = "记录并取得官方参考素材快照")
    @PostMapping("/official-materials/{id}/use")
    public Result<OfficialResumeMaterial> useOfficialMaterial(@PathVariable Long id) {
        return Result.success(service.usePublishedMaterial(userId(), id));
    }

    @Operation(summary = "查询官方内容模板")
    @GetMapping("/templates")
    public Result<List<ResumeContentTemplate>> listTemplates(
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String targetRole
    ) {
        return Result.success(service.listPublishedTemplates(query, targetRole));
    }

    @Operation(summary = "使用内容模板创建独立简历")
    @PostMapping("/templates/{id}/create-resume")
    public Result<ResumeListVO> createResumeFromTemplate(
            @PathVariable Long id,
            @Valid @RequestBody ContentTemplateCreateResumeDTO dto
    ) {
        return Result.success(service.createResumeFromTemplate(userId(), id, dto));
    }

    private Long userId() {
        return SecurityUtils.getCurrentUserId();
    }
}
