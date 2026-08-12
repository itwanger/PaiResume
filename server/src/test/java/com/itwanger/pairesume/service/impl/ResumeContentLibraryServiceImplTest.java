package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.dto.OfficialMaterialUpsertDTO;
import com.itwanger.pairesume.dto.ResumeMaterialUpsertDTO;
import com.itwanger.pairesume.dto.ResumeProfileUpdateDTO;
import com.itwanger.pairesume.entity.UserResumeMaterial;
import com.itwanger.pairesume.entity.UserResumeProfile;
import com.itwanger.pairesume.entity.OfficialResumeMaterial;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.mapper.*;
import com.itwanger.pairesume.service.AiService;
import com.itwanger.pairesume.service.ResumeImportService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeContentLibraryServiceImplTest {
    @Mock private UserResumeProfileMapper profileMapper;
    @Mock private UserResumeMaterialMapper userMaterialMapper;
    @Mock private ResumeMapper resumeMapper;
    @Mock private ResumeModuleMapper resumeModuleMapper;
    @Mock private OfficialResumeMaterialMapper officialMaterialMapper;
    @Mock private ResumeContentTemplateMapper contentTemplateMapper;
    @Mock private ResumeImportService resumeImportService;
    @Mock private AiService aiService;
    @Mock private JdbcTemplate jdbcTemplate;

    private ResumeContentLibraryServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ResumeContentLibraryServiceImpl(
                profileMapper,
                userMaterialMapper,
                resumeMapper,
                resumeModuleMapper,
                officialMaterialMapper,
                contentTemplateMapper,
                resumeImportService,
                aiService,
                jdbcTemplate,
                new ObjectMapper()
        );
    }

    @Test
    void profileKeepsOnlySupportedPrivateFields() {
        ResumeProfileUpdateDTO dto = new ResumeProfileUpdateDTO();
        dto.setContent(Map.of(
                "name", "张三",
                "github", "https://github.com/example",
                "serverSecret", "must-not-persist"
        ));

        UserResumeProfile result = service.saveProfile(7L, dto);

        assertEquals("张三", result.getContent().get("name"));
        assertFalse(result.getContent().containsKey("serverSecret"));
        verify(profileMapper).insert(any(UserResumeProfile.class));
    }

    @Test
    void profileRejectsInvalidEmailBeforePersisting() {
        ResumeProfileUpdateDTO dto = new ResumeProfileUpdateDTO();
        dto.setContent(Map.of("email", "zhangtianba.qq.com"));

        assertThrows(BusinessException.class, () -> service.saveProfile(7L, dto));
        verify(profileMapper, never()).insert(any(UserResumeProfile.class));
        verify(profileMapper, never()).updateById(any(UserResumeProfile.class));
    }

    @Test
    void officialMaterialRejectsPersonalBasicInfo() {
        OfficialMaterialUpsertDTO dto = new OfficialMaterialUpsertDTO();
        dto.setModuleType("basic_info");
        dto.setTitle("不安全示例");
        dto.setContent(Map.of("phone", "13800000000"));
        dto.setStatus("DRAFT");

        assertThrows(BusinessException.class, () -> service.createOfficialMaterial(1L, dto));
        verify(officialMaterialMapper, never()).insert(any(OfficialResumeMaterial.class));
    }

    @Test
    void privateMaterialCanOnlyBeUpdatedByItsOwner() {
        UserResumeMaterial material = new UserResumeMaterial();
        material.setId(9L);
        material.setUserId(8L);
        when(userMaterialMapper.selectById(9L)).thenReturn(material);
        ResumeMaterialUpsertDTO dto = new ResumeMaterialUpsertDTO();
        dto.setModuleType("project");
        dto.setTitle("真实项目");
        dto.setContent(Map.of("projectName", "PaiResume"));
        dto.setTags(List.of("Java"));

        assertThrows(BusinessException.class, () -> service.updateUserMaterial(7L, 9L, dto));
        verify(userMaterialMapper, never()).updateById(any(UserResumeMaterial.class));
    }

    @Test
    void historyMaterialsPreferNewestResumeAndKeepUniqueLegacyEntries() {
        Resume olderResume = new Resume();
        olderResume.setId(10L);
        olderResume.setTitle("旧简历");
        Resume newerResume = new Resume();
        newerResume.setId(11L);
        newerResume.setTitle("新简历");
        when(resumeMapper.selectList(any())).thenReturn(List.of(newerResume, olderResume));

        Map<String, Object> duplicatedContent = Map.of(
                "school", "北京邮电大学",
                "department", "计算机学院",
                "major", "计算机科学与技术",
                "degree", "本科",
                "startDate", "2020-09",
                "endDate", "2024-06"
        );
        ResumeModule newerModule = resumeModule(101L, 11L, duplicatedContent, LocalDateTime.of(2026, 8, 12, 10, 0));
        ResumeModule olderModule = resumeModule(100L, 10L, duplicatedContent, LocalDateTime.of(2026, 8, 11, 10, 0));
        when(resumeModuleMapper.selectList(any())).thenReturn(List.of(newerModule, olderModule));

        UserResumeMaterial duplicateLegacy = new UserResumeMaterial();
        duplicateLegacy.setId(201L);
        duplicateLegacy.setModuleType("education");
        duplicateLegacy.setTitle("北邮旧资料");
        duplicateLegacy.setContent(duplicatedContent);
        UserResumeMaterial uniqueLegacy = new UserResumeMaterial();
        uniqueLegacy.setId(202L);
        uniqueLegacy.setModuleType("education");
        uniqueLegacy.setTitle("郑州大学");
        uniqueLegacy.setContent(Map.of(
                "school", "郑州大学",
                "department", "计算机与人工智能学院",
                "degree", "硕士"
        ));
        when(userMaterialMapper.selectList(any())).thenReturn(List.of(duplicateLegacy, uniqueLegacy));

        var result = service.listHistoryMaterials(7L, "education", null, 99L);

        assertEquals(2, result.size());
        assertEquals("HISTORY_RESUME", result.get(0).getSourceType());
        assertEquals(11L, result.get(0).getSourceResumeId());
        assertEquals("新简历", result.get(0).getSourceResumeTitle());
        assertEquals("LEGACY_LIBRARY", result.get(1).getSourceType());
        assertEquals(202L, result.get(1).getLegacyMaterialId());
    }

    @Test
    void historyMaterialsFilterBlankDraftsAndKeepLegacyBasicProfile() {
        when(resumeMapper.selectList(any())).thenReturn(List.of());
        UserResumeProfile profile = new UserResumeProfile();
        profile.setUserId(7L);
        profile.setContent(Map.of("name", "张三", "email", "zhangsan@example.com"));
        when(profileMapper.selectById(7L)).thenReturn(profile);
        when(userMaterialMapper.selectList(any())).thenReturn(List.of());

        var result = service.listHistoryMaterials(7L, "basic_info", null, null);

        assertEquals(1, result.size());
        assertEquals("LEGACY_PROFILE", result.get(0).getSourceType());
        assertEquals("张三", result.get(0).getTitle());
    }

    private ResumeModule resumeModule(Long id, Long resumeId, Map<String, Object> content,
                                      LocalDateTime updatedAt) {
        ResumeModule module = new ResumeModule();
        module.setId(id);
        module.setResumeId(resumeId);
        module.setModuleType("education");
        module.setContent(content);
        module.setUpdatedAt(updatedAt);
        return module;
    }
}
