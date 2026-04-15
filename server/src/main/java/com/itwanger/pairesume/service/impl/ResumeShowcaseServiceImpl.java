package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.ResumeShowcaseUpsertDTO;
import com.itwanger.pairesume.dto.ShowcaseCardDTO;
import com.itwanger.pairesume.dto.ShowcaseDetailDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.entity.ResumeShowcase;
import com.itwanger.pairesume.mapper.ResumeMapper;
import com.itwanger.pairesume.mapper.ResumeModuleMapper;
import com.itwanger.pairesume.mapper.ResumeShowcaseMapper;
import com.itwanger.pairesume.service.ResumeShowcaseService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ResumeShowcaseServiceImpl implements ResumeShowcaseService {
    private final ResumeShowcaseMapper resumeShowcaseMapper;
    private final ResumeMapper resumeMapper;
    private final ResumeModuleMapper resumeModuleMapper;

    @Override
    public List<ShowcaseCardDTO> listPublishedShowcases() {
        return resumeShowcaseMapper.selectList(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getPublishStatus, "PUBLISHED")
                        .orderByAsc(ResumeShowcase::getDisplayOrder)
                        .orderByDesc(ResumeShowcase::getUpdatedAt)
        ).stream().map(this::toCardDto).toList();
    }

    @Override
    public ShowcaseDetailDTO getPublishedDetail(String slug) {
        ResumeShowcase showcase = resumeShowcaseMapper.selectOne(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getSlug, slug)
                        .eq(ResumeShowcase::getPublishStatus, "PUBLISHED")
                        .last("LIMIT 1")
        );
        if (showcase == null) {
            throw new BusinessException(ResultCode.SHOWCASE_NOT_FOUND);
        }
        return toDetailDto(showcase);
    }

    @Override
    public List<ResumeShowcase> listAdminShowcases() {
        return resumeShowcaseMapper.selectList(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .orderByAsc(ResumeShowcase::getDisplayOrder)
                        .orderByDesc(ResumeShowcase::getUpdatedAt)
        );
    }

    @Override
    public ResumeShowcase create(Long adminUserId, ResumeShowcaseUpsertDTO dto) {
        ResumeShowcase showcase = new ResumeShowcase();
        applyUpsert(showcase, adminUserId, dto);
        resumeShowcaseMapper.insert(showcase);
        return showcase;
    }

    @Override
    public ResumeShowcase update(Long showcaseId, Long adminUserId, ResumeShowcaseUpsertDTO dto) {
        ResumeShowcase showcase = resumeShowcaseMapper.selectById(showcaseId);
        if (showcase == null) {
            throw new BusinessException(ResultCode.SHOWCASE_NOT_FOUND);
        }
        applyUpsert(showcase, adminUserId, dto);
        resumeShowcaseMapper.updateById(showcase);
        return showcase;
    }

    private void applyUpsert(ResumeShowcase showcase, Long adminUserId, ResumeShowcaseUpsertDTO dto) {
        Resume resume = resumeMapper.selectById(dto.getResumeId());
        if (resume == null || resume.getStatus() == 0 || !adminUserId.equals(resume.getUserId())) {
            throw new BusinessException(ResultCode.RESUME_NOT_FOUND);
        }

        ResumeShowcase existingSlug = resumeShowcaseMapper.selectOne(
                new LambdaQueryWrapper<ResumeShowcase>()
                        .eq(ResumeShowcase::getSlug, dto.getSlug().trim())
                        .last("LIMIT 1")
        );
        if (existingSlug != null && !existingSlug.getId().equals(showcase.getId())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "slug 已被占用");
        }

        showcase.setResumeId(dto.getResumeId());
        showcase.setSlug(dto.getSlug().trim());
        showcase.setScoreLabel(dto.getScoreLabel().trim());
        showcase.setSummary(dto.getSummary().trim());
        showcase.setTags(dto.getTags());
        showcase.setDisplayOrder(dto.getDisplayOrder());
        showcase.setPublishStatus(dto.getPublishStatus().trim().toUpperCase());
    }

    private ShowcaseCardDTO toCardDto(ResumeShowcase showcase) {
        Resume resume = resumeMapper.selectById(showcase.getResumeId());
        ShowcaseCardDTO dto = new ShowcaseCardDTO();
        dto.setId(showcase.getId());
        dto.setSlug(showcase.getSlug());
        dto.setTitle(resume != null ? resume.getTitle() : "官方样例");
        dto.setScoreLabel(showcase.getScoreLabel());
        dto.setSummary(showcase.getSummary());
        dto.setTags(showcase.getTags());
        dto.setUpdatedAt(DateTimeUtils.format(showcase.getUpdatedAt()));
        return dto;
    }

    private ShowcaseDetailDTO toDetailDto(ResumeShowcase showcase) {
        Resume resume = resumeMapper.selectById(showcase.getResumeId());
        if (resume == null || resume.getStatus() == 0) {
            throw new BusinessException(ResultCode.SHOWCASE_NOT_FOUND);
        }

        List<ResumeModule> modules = resumeModuleMapper.selectList(
                new LambdaQueryWrapper<ResumeModule>()
                        .eq(ResumeModule::getResumeId, showcase.getResumeId())
                        .orderByAsc(ResumeModule::getSortOrder)
                        .orderByAsc(ResumeModule::getId)
        );

        ShowcaseDetailDTO dto = new ShowcaseDetailDTO();
        dto.setId(showcase.getId());
        dto.setSlug(showcase.getSlug());
        dto.setTitle(resume.getTitle());
        dto.setScoreLabel(showcase.getScoreLabel());
        dto.setSummary(showcase.getSummary());
        dto.setTags(showcase.getTags());
        dto.setModules(modules);
        dto.setUpdatedAt(DateTimeUtils.format(showcase.getUpdatedAt()));
        return dto;
    }
}
