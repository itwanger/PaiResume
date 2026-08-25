package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewOssProperties;
import com.itwanger.pairesume.dto.CreateResumeReviewUploadDTO;
import com.itwanger.pairesume.dto.ResumeReviewUploadAuthorizationDTO;
import com.itwanger.pairesume.dto.ResumeReviewUploadDTO;
import com.itwanger.pairesume.entity.ResumeReviewUpload;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.ResumeReviewRequestMapper;
import com.itwanger.pairesume.mapper.ResumeReviewUploadMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.ResumeReviewObjectStorage;
import com.itwanger.pairesume.service.ResumeService;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ResumeReviewUploadService {
    private static final DateTimeFormatter OBJECT_DATE = DateTimeFormatter.ofPattern("yyyy/MM/dd");
    private static final Pattern OBJECT_PREFIX =
            Pattern.compile("^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*/$");

    private final ResumeReviewUploadMapper uploadMapper;
    private final ResumeReviewRequestMapper requestMapper;
    private final UserMapper userMapper;
    private final ResumeService resumeService;
    private final ResumeReviewObjectStorage objectStorage;
    private final ResumeReviewOssProperties properties;

    @Transactional
    public ResumeReviewUploadAuthorizationDTO authorize(Long userId, CreateResumeReviewUploadDTO dto) {
        ensureEnabled();
        User user = userMapper.selectByIdForUpdate(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        if (!"ACTIVE".equals(user.getMembershipStatus())
                || (user.getMembershipExpiresAt() != null
                && !user.getMembershipExpiresAt().isAfter(LocalDateTime.now()))) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_MEMBERSHIP_REQUIRED);
        }
        if (dto.getResumeId() != null) {
            resumeService.getByIdAndUserId(dto.getResumeId(), userId);
        }
        if (requestMapper.selectActive(reviewActiveUserKey(userId)) != null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_ACTIVE_EXISTS);
        }

        String fileName = normalizePdfFileName(dto.getFileName());
        long sizeBytes = dto.getSizeBytes();
        if (sizeBytes < 5 || sizeBytes > properties.getMaxPdfBytes()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID.getCode(),
                    "PDF 文件大小必须在 5 字节到 "
                            + properties.getMaxPdfBytes() + " 字节之间");
        }
        String sha256 = dto.getSha256().toLowerCase(Locale.ROOT);

        ResumeReviewUpload previous = uploadMapper.selectActiveForUpdate(uploadActiveUserKey(userId));
        if (previous != null) {
            previous.setUploadStatus("EXPIRED");
            previous.setActiveUserKey(null);
            uploadMapper.updateById(previous);
        }

        String token = UUID.randomUUID().toString().replace("-", "");
        String uploadNo = "RU" + token;
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(properties.getUploadUrlTtlMinutes());
        ResumeReviewUpload upload = new ResumeReviewUpload();
        upload.setUploadNo(uploadNo);
        upload.setUserId(userId);
        upload.setResumeId(dto.getResumeId());
        upload.setActiveUserKey(uploadActiveUserKey(userId));
        upload.setStagingObjectKey(prefix(properties.getStagingPrefix()) + token + ".pdf");
        upload.setFinalObjectKey(prefix(properties.getObjectPrefix())
                + OBJECT_DATE.format(LocalDate.now()) + "/" + token + ".pdf");
        upload.setOriginalFileName(fileName);
        upload.setSizeBytes(sizeBytes);
        upload.setSha256(sha256);
        upload.setUploadStatus("PENDING");
        upload.setExpiresAt(expiresAt);
        try {
            uploadMapper.insert(upload);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_STATE_INVALID.getCode(),
                    "已有 PDF 正在上传，请稍后重试");
        }

        ResumeReviewObjectStorage.UploadTarget target = objectStorage.createPdfUploadTarget(
                upload.getStagingObjectKey(), sizeBytes, sha256, expiresAt);
        return new ResumeReviewUploadAuthorizationDTO(
                uploadNo,
                target.uploadUrl(),
                target.method(),
                target.headers(),
                target.fields(),
                DateTimeUtils.format(expiresAt),
                properties.getMaxPdfBytes()
        );
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public ResumeReviewUploadDTO complete(Long userId, String uploadNo) {
        ensureEnabled();
        ResumeReviewUpload upload = requireForUpdate(uploadNo);
        requireOwner(upload, userId);
        if ("READY".equals(upload.getUploadStatus())) {
            ensureNotExpired(upload);
            return toDto(upload);
        }
        if (!"PENDING".equals(upload.getUploadStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_STATE_INVALID);
        }
        ensureNotExpired(upload);

        ResumeReviewObjectStorage.FrozenPdf frozen;
        try {
            frozen = objectStorage.freezeUploadedPdf(
                    upload.getStagingObjectKey(),
                    upload.getFinalObjectKey(),
                    upload.getOriginalFileName(),
                    upload.getSizeBytes(),
                    upload.getSha256()
            );
        } catch (BusinessException exception) {
            if (exception.getCode() == ResultCode.RESUME_REVIEW_UPLOAD_INVALID.getCode()) {
                upload.setUploadStatus("REJECTED");
                upload.setActiveUserKey(null);
                uploadMapper.updateById(upload);
            }
            throw exception;
        }
        upload.setObjectEtag(frozen.etag());
        upload.setSizeBytes(frozen.sizeBytes());
        upload.setUploadStatus("READY");
        upload.setExpiresAt(LocalDateTime.now().plusMinutes(properties.getReadyTtlMinutes()));
        uploadMapper.updateById(upload);
        return toDto(upload);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public ResumeReviewUpload requireReadyForCreate(Long userId, String uploadNo, Long resumeId) {
        ResumeReviewUpload upload = requireForUpdate(uploadNo);
        requireOwner(upload, userId);
        if (!Objects.equals(upload.getResumeId(), resumeId)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_FORBIDDEN);
        }
        if (!"READY".equals(upload.getUploadStatus())
                || !StringUtils.hasText(upload.getFinalObjectKey())
                || !StringUtils.hasText(upload.getObjectEtag())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_STATE_INVALID);
        }
        requireNotExpired(upload);
        return upload;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void markConsumed(ResumeReviewUpload upload, Long requestId) {
        if (upload == null || upload.getId() == null || !"READY".equals(upload.getUploadStatus())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_STATE_INVALID);
        }
        upload.setUploadStatus("CONSUMED");
        upload.setConsumedRequestId(requestId);
        upload.setActiveUserKey(null);
        uploadMapper.updateById(upload);
    }

    private ResumeReviewUpload requireForUpdate(String uploadNo) {
        if (!StringUtils.hasText(uploadNo) || uploadNo.length() > 64) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_NOT_FOUND);
        }
        ResumeReviewUpload upload = uploadMapper.selectByUploadNoForUpdate(uploadNo.trim());
        if (upload == null) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_NOT_FOUND);
        }
        return upload;
    }

    private void requireOwner(ResumeReviewUpload upload, Long userId) {
        if (!Objects.equals(upload.getUserId(), userId)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_FORBIDDEN);
        }
    }

    private void ensureNotExpired(ResumeReviewUpload upload) {
        if (upload.getExpiresAt() == null || !upload.getExpiresAt().isAfter(LocalDateTime.now())) {
            if (!"CONSUMED".equals(upload.getUploadStatus())) {
                upload.setUploadStatus("EXPIRED");
                upload.setActiveUserKey(null);
                uploadMapper.updateById(upload);
            }
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_EXPIRED);
        }
    }

    private void requireNotExpired(ResumeReviewUpload upload) {
        if (upload.getExpiresAt() == null || !upload.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_EXPIRED);
        }
    }

    private void ensureEnabled() {
        if (!properties.isEnabled()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STORAGE_NOT_CONFIGURED);
        }
    }

    private String normalizePdfFileName(String value) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
        }
        String normalized = value.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        if (slash >= 0) normalized = normalized.substring(slash + 1);
        normalized = normalized.replaceAll("[\\p{Cntrl}]", "").trim();
        if (normalized.length() > 200 || !normalized.toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
        }
        return normalized;
    }

    private String prefix(String value) {
        if (!StringUtils.hasText(value)) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STORAGE_NOT_CONFIGURED);
        }
        String normalized = value.trim();
        if (!OBJECT_PREFIX.matcher(normalized).matches()) {
            throw new BusinessException(ResultCode.RESUME_REVIEW_STORAGE_NOT_CONFIGURED);
        }
        return normalized;
    }

    private ResumeReviewUploadDTO toDto(ResumeReviewUpload upload) {
        return new ResumeReviewUploadDTO(
                upload.getUploadNo(),
                upload.getOriginalFileName(),
                upload.getSizeBytes(),
                upload.getSha256(),
                upload.getUploadStatus()
        );
    }

    private String reviewActiveUserKey(Long userId) {
        return "RESUME_REVIEW:" + userId;
    }

    private String uploadActiveUserKey(Long userId) {
        return "RESUME_REVIEW_UPLOAD:" + userId;
    }
}
