package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.*;
import com.itwanger.pairesume.vo.ResumeListVO;
import com.itwanger.pairesume.vo.ResumeHistoryMaterialVO;

import java.util.List;
import java.util.Map;

public interface ResumeContentLibraryService {
    UserResumeProfile getProfile(Long userId);
    UserResumeProfile saveProfile(Long userId, ResumeProfileUpdateDTO dto);
    List<UserResumeMaterial> listUserMaterials(Long userId, String moduleType, String query);
    UserResumeMaterial createUserMaterial(Long userId, ResumeMaterialUpsertDTO dto);
    UserResumeMaterial updateUserMaterial(Long userId, Long materialId, ResumeMaterialUpsertDTO dto);
    void deleteUserMaterial(Long userId, Long materialId);
    List<ResumeHistoryMaterialVO> listHistoryMaterials(Long userId, String moduleType,
                                                       String query, Long excludeResumeId);

    List<OfficialResumeMaterial> listPublishedMaterials(String moduleType, String query, String targetRole);
    OfficialResumeMaterial usePublishedMaterial(Long userId, Long materialId);
    List<ResumeContentTemplate> listPublishedTemplates(String query, String targetRole);
    ResumeListVO createResumeFromTemplate(Long userId, Long templateId, ContentTemplateCreateResumeDTO dto);

    List<OfficialResumeMaterial> listAdminMaterials();
    OfficialResumeMaterial createOfficialMaterial(Long adminUserId, OfficialMaterialUpsertDTO dto);
    OfficialResumeMaterial updateOfficialMaterial(Long adminUserId, Long materialId, OfficialMaterialUpsertDTO dto);
    List<ResumeContentTemplate> listAdminTemplates();
    ResumeContentTemplate createContentTemplate(Long adminUserId, ContentTemplateUpsertDTO dto);
    ResumeContentTemplate updateContentTemplate(Long adminUserId, Long templateId, ContentTemplateUpsertDTO dto);
    Map<String, Object> generateAiDraft(LibraryAiDraftRequestDTO dto);
}
