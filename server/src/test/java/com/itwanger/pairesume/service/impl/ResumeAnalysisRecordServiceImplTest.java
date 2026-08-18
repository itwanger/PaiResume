package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.dto.ResumeAnalysisIssueDTO;
import com.itwanger.pairesume.entity.ResumeAnalysisRecord;
import com.itwanger.pairesume.mapper.ResumeAnalysisRecordMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeAnalysisRecordServiceImplTest {
    @Mock
    private ResumeAnalysisRecordMapper mapper;

    @InjectMocks
    private ResumeAnalysisRecordServiceImpl service;

    @Test
    void latestRecordRestoresCanonicalScenarioAndDefaults() {
        ResumeAnalysisRecord record = new ResumeAnalysisRecord();
        record.setScenarioCode(" working_professional ");
        record.setScore(88);
        record.setIssues(List.of(new ResumeAnalysisIssueDTO()));
        record.setSuggestions(List.of("补充量化成果"));
        when(mapper.selectOne(org.mockito.ArgumentMatchers.any())).thenReturn(record);

        var dto = service.getLatestCompletedRecord(51L, 7L);

        assertEquals("WORKING_PROFESSIONAL", dto.getScenarioCode());
        assertEquals("工作党", dto.getScenarioName());
        assertEquals(88, dto.getScore());
        assertEquals(1, dto.getIssues().size());
        assertEquals(List.of("补充量化成果"), dto.getSuggestions());
    }

    @Test
    void latestRecordWithoutScenarioLeavesScenarioFieldsEmpty() {
        ResumeAnalysisRecord record = new ResumeAnalysisRecord();
        record.setScore(70);
        when(mapper.selectOne(org.mockito.ArgumentMatchers.any())).thenReturn(record);

        var dto = service.getLatestCompletedRecord(51L, 7L);

        assertNull(dto.getScenarioCode());
        assertNull(dto.getScenarioName());
        assertEquals(70, dto.getScore());
        assertEquals(List.of(), dto.getIssues());
        assertEquals(List.of(), dto.getSuggestions());
    }

    @Test
    void missingLatestRecordReturnsNull() {
        when(mapper.selectOne(org.mockito.ArgumentMatchers.any())).thenReturn(null);

        assertNull(service.getLatestCompletedRecord(51L, 7L));
    }

    @Test
    void saveInsertsRecordAndIgnoresNull() {
        ResumeAnalysisRecord record = new ResumeAnalysisRecord();
        record.setScenarioCode("WORKING_PROFESSIONAL");

        service.save(record);
        service.save(null);

        verify(mapper).insert(record);
        verifyNoMoreInteractions(mapper);
    }
}
