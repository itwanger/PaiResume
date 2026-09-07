package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.dto.AiFieldOptimizeRecordDTO;
import com.itwanger.pairesume.entity.AiOptimizeRecord;
import com.itwanger.pairesume.mapper.AiOptimizeRecordMapper;
import com.itwanger.pairesume.service.AiOptimizeRecordService;
import org.springframework.stereotype.Service;

@Service
public class AiOptimizeRecordServiceImpl implements AiOptimizeRecordService {

    private final AiOptimizeRecordMapper aiOptimizeRecordMapper;

    public AiOptimizeRecordServiceImpl(AiOptimizeRecordMapper aiOptimizeRecordMapper) {
        this.aiOptimizeRecordMapper = aiOptimizeRecordMapper;
    }

    @Override
    public void save(AiOptimizeRecord record) {
        if (record == null) {
            return;
        }
        aiOptimizeRecordMapper.insert(record);
    }

    @Override
    public AiFieldOptimizeRecordDTO getLatestRecord(Long userId, Long resumeId, Long moduleId, String fieldType, Integer fieldIndex) {
        var query = new LambdaQueryWrapper<AiOptimizeRecord>()
                .eq(AiOptimizeRecord::getUserId, userId)
                .eq(AiOptimizeRecord::getResumeId, resumeId)
                .eq(AiOptimizeRecord::getModuleId, moduleId)
                .eq(AiOptimizeRecord::getFieldType, fieldType)
                .orderByDesc(AiOptimizeRecord::getCreatedAt)
                .orderByDesc(AiOptimizeRecord::getId)
                .last("LIMIT 1");

        if (fieldIndex == null) {
            query.isNull(AiOptimizeRecord::getFieldIndex);
        } else {
            query.eq(AiOptimizeRecord::getFieldIndex, fieldIndex);
        }

        var record = aiOptimizeRecordMapper.selectOne(query);
        if (record == null) {
            return null;
        }

        var dto = new AiFieldOptimizeRecordDTO();
        dto.setId(record.getId());
        dto.setStatus(record.getRecordStatus());
        dto.setOriginal(record.getOriginalText());
        dto.setReasoning(record.getReasoningMarkdown());
        dto.setStreamedContent(record.getStreamedContent());
        dto.setOptimized(record.getOptimizedText());
        dto.setCandidates(record.getCandidates());
        dto.setError(record.getErrorMessage());
        dto.setCreatedAt(record.getCreatedAt());
        dto.setUpdatedAt(record.getUpdatedAt());
        return dto;
    }
}
