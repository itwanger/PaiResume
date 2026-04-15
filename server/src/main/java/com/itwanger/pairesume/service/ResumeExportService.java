package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ResumeExportRequestDTO;

public interface ResumeExportService {
    ExportedResumeFile exportPdf(Long resumeId, Long userId, ResumeExportRequestDTO request);

    record ExportedResumeFile(byte[] content, String fileName) {
    }
}
