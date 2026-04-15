package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.ApproveFeedbackSubmissionDTO;
import com.itwanger.pairesume.dto.FeedbackSubmissionAdminDTO;
import com.itwanger.pairesume.dto.FeedbackSubmissionCreateDTO;
import com.itwanger.pairesume.dto.PublishedFeedbackDTO;
import com.itwanger.pairesume.dto.RejectFeedbackSubmissionDTO;

import java.util.List;

public interface FeedbackSubmissionService {
    void submit(FeedbackSubmissionCreateDTO dto, String sourceIp);

    List<FeedbackSubmissionAdminDTO> listAdminSubmissions();

    FeedbackSubmissionAdminDTO approve(Long submissionId, Long adminUserId, ApproveFeedbackSubmissionDTO dto);

    FeedbackSubmissionAdminDTO reject(Long submissionId, Long adminUserId, RejectFeedbackSubmissionDTO dto);

    FeedbackSubmissionAdminDTO publish(Long submissionId, Long adminUserId);

    FeedbackSubmissionAdminDTO unpublish(Long submissionId, Long adminUserId);

    FeedbackSubmissionAdminDTO resendCoupon(Long submissionId, Long adminUserId);

    List<PublishedFeedbackDTO> listPublishedTestimonials();
}
