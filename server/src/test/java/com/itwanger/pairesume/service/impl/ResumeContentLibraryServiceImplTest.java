package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.dto.OfficialMaterialUpsertDTO;
import com.itwanger.pairesume.dto.ResumeMaterialUpsertDTO;
import com.itwanger.pairesume.dto.ResumeProfileUpdateDTO;
import com.itwanger.pairesume.entity.UserResumeMaterial;
import com.itwanger.pairesume.entity.UserResumeProfile;
import com.itwanger.pairesume.entity.OfficialResumeMaterial;
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

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeContentLibraryServiceImplTest {
    @Mock private UserResumeProfileMapper profileMapper;
    @Mock private UserResumeMaterialMapper userMaterialMapper;
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
}
