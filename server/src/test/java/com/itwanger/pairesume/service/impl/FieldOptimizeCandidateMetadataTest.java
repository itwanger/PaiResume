package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.AiOptimizeRecord;
import com.itwanger.pairesume.mapper.AiOptimizeRecordMapper;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class FieldOptimizeCandidateMetadataTest {
    @Test
    void modelMetadataStaysAlignedAndSurvivesHistoryRead() {
        var content = """
          {"candidates":["简洁内容","Redis限流","已有数据99%"],"candidateTags":[["concise"],["technical","invalid"],["quantified"]]}
          """;
        var candidates = List.of("Redis 限流", "简洁内容", "已有数据99%");
        var expected = List.of(List.of("technical"), List.of("concise"), List.of("quantified"));
        assertEquals(expected, FieldOptimizeCandidateMetadata.tags(content, candidates));
        assertEquals(List.of(List.of()), FieldOptimizeCandidateMetadata.tags("{\"candidates\":[\"量化99%\"]}", List.of("量化99%")));
        assertEquals(List.of(List.of()), FieldOptimizeCandidateMetadata.tags(content, List.of("没有对应文本")));
        var mapper = mock(AiOptimizeRecordMapper.class);
        var record = new AiOptimizeRecord();
        record.setCandidates(candidates);
        record.setStreamedContent(content);
        when(mapper.selectOne(any(com.baomidou.mybatisplus.core.conditions.Wrapper.class))).thenReturn(record);
        var service = new AiOptimizeRecordServiceImpl(mapper);
        assertEquals(expected, service.getLatestRecord(1L, 2L, 3L, "responsibility", 0).getCandidateTags());
    }
}
