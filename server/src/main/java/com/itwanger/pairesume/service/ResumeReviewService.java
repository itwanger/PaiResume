package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.payment.ProviderPaymentResult;
import org.springframework.web.multipart.MultipartFile;
import java.util.List;

public interface ResumeReviewService {
    ResumeReviewEligibilityDTO eligibility(Long userId);
    ResumeReviewRequestDTO current(Long userId);
    void sendContactVerificationCode(Long userId, String email, String clientIp);
    ResumeReviewRequestDTO create(Long userId, CreateResumeReviewRequestDTO dto, String clientIp);
    ResumeReviewRequestDTO get(Long userId, String requestNo);
    ResumeReviewRequestDTO updateContactEmail(Long userId, String requestNo,
                                              String contactEmail, String verificationCode);
    ResumeReviewRequestDTO upgradePriority(Long userId, String requestNo,
                                           Integer priorityFeeCents, String clientIp);
    ResumeReviewRequestDTO refreshPayment(Long userId, String requestNo);
    ResumeReviewRequestDTO dispatch(Long userId, String requestNo, MultipartFile file);
    List<ResumeReviewQueueItemDTO> publicQueue();
    void handleVerifiedProviderNotification(ProviderPaymentResult result);
    void reconcileExpiredPayment(Long requestId);
    List<ResumeReviewAdminRequestDTO> adminList();
    long adminActionCount();
    ResumeReviewAdminRequestDTO adminGet(String requestNo);
    List<ResumeReviewAuditDTO> adminAudits(String requestNo);
    ResumeReviewRequestDTO adminAccept(String requestNo, Long adminId, String reason);
    ResumeReviewRequestDTO adminComplete(String requestNo, Long adminId, String reason);
    ResumeReviewRequestDTO adminReturn(String requestNo, Long adminId, String reason);
    ResumeReviewRequestDTO adminRetryMail(String requestNo, Long adminId, String reason);
    ResumeReviewRequestDTO adminConfirmRefund(String requestNo, Long adminId,
                                              String refundReference, String reason);
}
