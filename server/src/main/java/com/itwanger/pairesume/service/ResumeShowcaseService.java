package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ShowcaseCardDTO;
import com.itwanger.pairesume.dto.ShowcaseDetailDTO;
import com.itwanger.pairesume.dto.ResumeShowcaseUpsertDTO;
import com.itwanger.pairesume.entity.ResumeShowcase;

import java.util.List;

public interface ResumeShowcaseService {
    List<ShowcaseCardDTO> listPublishedShowcases();

    ShowcaseDetailDTO getPublishedDetail(String slug);

    List<ResumeShowcase> listAdminShowcases();

    ResumeShowcase create(Long adminUserId, ResumeShowcaseUpsertDTO dto);

    ResumeShowcase update(Long showcaseId, Long adminUserId, ResumeShowcaseUpsertDTO dto);
}
