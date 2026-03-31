package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ResumeCreateDTO;
import com.itwanger.pairesume.dto.ResumeUpdateDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.vo.ResumeListVO;

import java.util.List;

public interface ResumeService {
    List<ResumeListVO> listByUserId(Long userId);
    ResumeListVO create(Long userId, ResumeCreateDTO dto);
    ResumeListVO update(Long userId, Long resumeId, ResumeUpdateDTO dto);
    void delete(Long userId, Long resumeId);
    Resume getByIdAndUserId(Long resumeId, Long userId);
}
