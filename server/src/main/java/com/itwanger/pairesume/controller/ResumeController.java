package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.common.Result;
import com.itwanger.pairesume.dto.ModuleCreateDTO;
import com.itwanger.pairesume.dto.ModuleOrderUpdateDTO;
import com.itwanger.pairesume.dto.ModuleUpdateDTO;
import com.itwanger.pairesume.dto.ResumeCreateDTO;
import com.itwanger.pairesume.dto.ResumeImportDTO;
import com.itwanger.pairesume.dto.ResumeStyleUpdateDTO;
import com.itwanger.pairesume.dto.ResumeUpdateDTO;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.service.ResumeImportService;
import com.itwanger.pairesume.service.ResumeModuleService;
import com.itwanger.pairesume.service.ResumeService;
import com.itwanger.pairesume.util.SecurityUtils;
import com.itwanger.pairesume.vo.ResumeListVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "简历接口")
@RestController
@RequestMapping("/resumes")
public class ResumeController {

    private final ResumeService resumeService;
    private final ResumeModuleService moduleService;
    private final ResumeImportService resumeImportService;

    public ResumeController(
            ResumeService resumeService,
            ResumeModuleService moduleService,
            ResumeImportService resumeImportService
    ) {
        this.resumeService = resumeService;
        this.moduleService = moduleService;
        this.resumeImportService = resumeImportService;
    }

    @Operation(summary = "获取简历列表")
    @GetMapping
    public Result<List<ResumeListVO>> list() {
        return Result.success(resumeService.listByUserId(getCurrentUserId()));
    }

    @Operation(summary = "创建简历")
    @PostMapping
    public Result<ResumeListVO> create(@Valid @RequestBody ResumeCreateDTO dto) {
        return Result.success(resumeService.create(getCurrentUserId(), dto));
    }

    @Operation(summary = "原子导入简历及全部模块")
    @PostMapping("/import")
    public Result<ResumeListVO> importResume(@Valid @RequestBody ResumeImportDTO dto) {
        return Result.success(resumeImportService.importResume(getCurrentUserId(), dto));
    }

    @Operation(summary = "更新简历信息")
    @PutMapping("/{id}")
    public Result<ResumeListVO> update(@PathVariable Long id, @Valid @RequestBody ResumeUpdateDTO dto) {
        return Result.success(resumeService.update(getCurrentUserId(), id, dto));
    }

    @Operation(summary = "更新简历样式")
    @PutMapping("/{id}/style")
    public Result<ResumeListVO> updateStyle(@PathVariable Long id,
                                             @Valid @RequestBody ResumeStyleUpdateDTO dto) {
        return Result.success(resumeService.updateStyle(getCurrentUserId(), id, dto));
    }

    @Operation(summary = "删除简历")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        resumeService.delete(getCurrentUserId(), id);
        return Result.success();
    }

    @Operation(summary = "获取简历所有模块")
    @GetMapping("/{id}/modules")
    public Result<List<ResumeModule>> listModules(@PathVariable Long id) {
        return Result.success(moduleService.listByResumeId(id, getCurrentUserId()));
    }

    @Operation(summary = "新增模块")
    @PostMapping("/{id}/modules")
    public Result<ResumeModule> createModule(@PathVariable Long id, @Valid @RequestBody ModuleCreateDTO dto) {
        return Result.success(moduleService.create(id, getCurrentUserId(), dto));
    }

    @Operation(summary = "调整简历模块顺序")
    @PutMapping("/{id}/modules/order")
    public Result<Void> reorderModules(@PathVariable Long id,
                                       @Valid @RequestBody ModuleOrderUpdateDTO dto) {
        moduleService.reorder(id, getCurrentUserId(), dto.getModuleIds());
        return Result.success();
    }

    @Operation(summary = "更新模块内容")
    @PostMapping("/{id}/modules/{mid}/update")
    public Result<ResumeModule> updateModule(@PathVariable Long id, @PathVariable Long mid,
                                             @Valid @RequestBody ModuleUpdateDTO dto) {
        return Result.success(moduleService.update(id, getCurrentUserId(), mid, dto));
    }

    @Operation(summary = "删除模块")
    @DeleteMapping("/{id}/modules/{mid}")
    public Result<Void> deleteModule(@PathVariable Long id, @PathVariable Long mid) {
        moduleService.delete(id, getCurrentUserId(), mid);
        return Result.success();
    }

    private Long getCurrentUserId() {
        return SecurityUtils.getCurrentUserId();
    }
}
