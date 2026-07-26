package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ResumeImportDTO;
import com.itwanger.pairesume.vo.ResumeListVO;

public interface ResumeImportService {
    ResumeListVO importResume(Long userId, ResumeImportDTO dto);
}
