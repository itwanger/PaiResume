package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.common.*;
import com.itwanger.pairesume.config.ResumePhotoOssProperties;
import com.itwanger.pairesume.dto.*;
import com.itwanger.pairesume.entity.*;
import com.itwanger.pairesume.mapper.*;
import com.itwanger.pairesume.security.ResumePhotoSecurityPolicy;
import com.itwanger.pairesume.service.ResumePhotoObjectStorage;
import com.itwanger.pairesume.util.DateTimeUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ResumePhotoService {
    private static final String STORED_PHOTO_PREFIX = "resume-photo:";
    private static final DateTimeFormatter OBJECT_DATE = DateTimeFormatter.ofPattern("yyyy/MM/dd");
    private static final Pattern OBJECT_PREFIX = Pattern.compile("^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*/$");

    private final ResumePhotoMapper photoMapper;
    private final UserMapper userMapper;
    private final ResumePhotoObjectStorage objectStorage;
    private final ResumePhotoOssProperties properties;

    @Transactional
    public ResumePhotoUploadAuthorizationDTO authorize(Long userId, CreateResumePhotoUploadDTO dto) {
        User user = userMapper.selectById(userId);
        if (user == null || user.getStatus() == null || user.getStatus() == 0
                || user.getAccountDeletedAt() != null) {
            throw new BusinessException(ResultCode.USER_NOT_FOUND);
        }
        validateDeclaredPhoto(dto);
        ResumePhoto previous = photoMapper.selectActiveForUpdate(activeUserKey(userId));
        if (previous != null) {
            previous.setPhotoStatus("EXPIRED");
            previous.setActiveUserKey(null);
            photoMapper.updateById(previous);
        }

        String token = UUID.randomUUID().toString().replace("-", "");
        String extension = "image/png".equals(dto.getContentType()) ? ".png" : ".jpg";
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(properties.getUploadUrlTtlMinutes());
        ResumePhoto photo = new ResumePhoto();
        photo.setPhotoNo("RP" + token);
        photo.setUserId(userId);
        photo.setActiveUserKey(activeUserKey(userId));
        photo.setStagingObjectKey(prefix(properties.getStagingPrefix()) + token + extension);
        photo.setObjectKey(prefix(properties.getObjectPrefix())
                + OBJECT_DATE.format(LocalDate.now()) + "/" + token + extension);
        photo.setOriginalFileName(normalizeFileName(dto.getFileName(), extension));
        photo.setContentType(dto.getContentType());
        photo.setSizeBytes(dto.getSizeBytes());
        photo.setSha256(dto.getSha256().toLowerCase(Locale.ROOT));
        photo.setWidth(dto.getWidth());
        photo.setHeight(dto.getHeight());
        photo.setPhotoStatus("PENDING");
        photo.setExpiresAt(expiresAt);
        try {
            photoMapper.insert(photo);
        } catch (DuplicateKeyException exception) {
            throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_INVALID.getCode(),
                    "已有照片正在上传，请稍后重试");
        }
        var target = objectStorage.createUploadTarget(photo.getStagingObjectKey(), photo.getSizeBytes(),
                photo.getContentType(), photo.getSha256(), expiresAt);
        return new ResumePhotoUploadAuthorizationDTO(photo.getPhotoNo(), target.uploadUrl(),
                target.method(), target.headers(), target.fields(), DateTimeUtils.format(expiresAt),
                properties.getMaxPhotoBytes());
    }

    @Transactional(noRollbackFor = BusinessException.class)
    public ResumePhotoDTO complete(Long userId, String photoNo) {
        ResumePhoto photo = requireForUpdate(photoNo);
        requireOwner(photo, userId);
        if ("READY".equals(photo.getPhotoStatus())) return toDto(photo);
        if (!"PENDING".equals(photo.getPhotoStatus())) throw invalidPhoto();
        ensureNotExpired(photo);
        try {
            var stored = objectStorage.finalizePhoto(photo.getStagingObjectKey(), photo.getObjectKey(),
                    photo.getContentType(), photo.getSizeBytes(), photo.getSha256(),
                    photo.getWidth(), photo.getHeight());
            photo.setObjectEtag(stored.etag());
            photo.setSizeBytes(stored.sizeBytes());
            photo.setWidth(stored.width());
            photo.setHeight(stored.height());
            photo.setPhotoStatus("READY");
            photo.setActiveUserKey(null);
            photoMapper.updateById(photo);
            return toDto(photo);
        } catch (BusinessException exception) {
            if (exception.getCode() == ResultCode.RESUME_PHOTO_UPLOAD_INVALID.getCode()) {
                photo.setPhotoStatus("REJECTED");
                photo.setActiveUserKey(null);
                photoMapper.updateById(photo);
            }
            throw exception;
        }
    }

    public ResumePhotoDTO access(Long userId, Long photoId) {
        ResumePhoto photo = requireReadyOwned(userId, photoId);
        return toDto(photo);
    }

    public String storedReference(Long photoId) {
        if (photoId == null || photoId <= 0) throw invalidPhoto();
        return STORED_PHOTO_PREFIX + photoId;
    }

    public Long storedPhotoId(String reference) {
        if (!StringUtils.hasText(reference) || !reference.startsWith(STORED_PHOTO_PREFIX)) return null;
        String value = reference.substring(STORED_PHOTO_PREFIX.length());
        if (!value.matches("^[1-9][0-9]{0,18}$")) return null;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    public Map<String, Object> prepareBasicInfoForPersistence(Long userId, String moduleType,
                                                               Map<String, Object> input) {
        Map<String, Object> content = input == null ? new LinkedHashMap<>() : new LinkedHashMap<>(input);
        if (!"basic_info".equals(moduleType)) return content;
        content.remove("photoWidth");
        content.remove("photoHeight");
        Object rawPhotoId = content.get("photoId");
        Long photoId = parsePhotoId(rawPhotoId);
        if (photoId != null) {
            requireReadyOwned(userId, photoId);
            content.put("photoId", photoId);
            content.remove("photo");
            return content;
        }
        content.remove("photoId");
        Object photo = content.get("photo");
        if (photo instanceof String value && value.startsWith("data:image/")) {
            // Transitional read/write compatibility for existing records. New browser uploads
            // never create Base64 values and use photoId instead.
            ResumePhotoSecurityPolicy.validateModuleContent("basic_info", content);
        } else if (ResumePhotoSecurityPolicy.isSafeRemotePhotoUrl(photo)) {
            content.put("photo", ((String) photo).strip());
        } else if (photo == null || photo instanceof String value && value.isBlank()) {
            content.remove("photo");
        } else {
            throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_INVALID.getCode(),
                    "请输入有效的 http:// 或 https:// 图片链接，或重新选择图片上传");
        }
        return content;
    }

    public Map<String, Object> hydrateBasicInfoForRead(Long userId, String moduleType,
                                                       Map<String, Object> input) {
        Map<String, Object> content = input == null ? new LinkedHashMap<>() : new LinkedHashMap<>(input);
        if (!"basic_info".equals(moduleType)) return content;
        Long photoId = parsePhotoId(content.get("photoId"));
        if (photoId == null) return content;
        ResumePhotoDTO photo = access(userId, photoId);
        content.put("photo", photo.accessUrl());
        content.put("photoId", photo.id());
        content.put("photoWidth", photo.width());
        content.put("photoHeight", photo.height());
        return content;
    }

    public void deleteAllForUser(Long userId) {
        List<ResumePhoto> photos = photoMapper.selectList(new LambdaQueryWrapper<ResumePhoto>()
                .eq(ResumePhoto::getUserId, userId));
        if (photos.isEmpty()) return;
        for (ResumePhoto photo : photos) {
            objectStorage.deleteObject(photo.getObjectKey());
            objectStorage.deleteObject(photo.getStagingObjectKey());
        }
        photoMapper.delete(new LambdaQueryWrapper<ResumePhoto>().eq(ResumePhoto::getUserId, userId));
    }

    private ResumePhotoDTO toDto(ResumePhoto photo) {
        LocalDateTime expiresAt = LocalDateTime.now().plusMinutes(properties.getAccessUrlTtlMinutes());
        return new ResumePhotoDTO(photo.getId(), photo.getPhotoNo(), photo.getContentType(),
                photo.getSizeBytes(), photo.getWidth(), photo.getHeight(),
                objectStorage.createAccessUrl(photo.getObjectKey(), expiresAt),
                DateTimeUtils.format(expiresAt));
    }

    private ResumePhoto requireForUpdate(String photoNo) {
        if (!StringUtils.hasText(photoNo) || photoNo.length() > 64) {
            throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_NOT_FOUND);
        }
        ResumePhoto photo = photoMapper.selectByPhotoNoForUpdate(photoNo.strip());
        if (photo == null) throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_NOT_FOUND);
        return photo;
    }

    private ResumePhoto requireReadyOwned(Long userId, Long photoId) {
        ResumePhoto photo = photoMapper.selectById(photoId);
        if (photo == null || !Objects.equals(photo.getUserId(), userId)) {
            throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_FORBIDDEN);
        }
        if (!"READY".equals(photo.getPhotoStatus()) || !StringUtils.hasText(photo.getObjectEtag())) {
            throw invalidPhoto();
        }
        return photo;
    }

    private void requireOwner(ResumePhoto photo, Long userId) {
        if (!Objects.equals(photo.getUserId(), userId)) {
            throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_FORBIDDEN);
        }
    }

    private void ensureNotExpired(ResumePhoto photo) {
        if (photo.getExpiresAt() == null || !photo.getExpiresAt().isAfter(LocalDateTime.now())) {
            photo.setPhotoStatus("EXPIRED");
            photo.setActiveUserKey(null);
            photoMapper.updateById(photo);
            throw new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_EXPIRED);
        }
    }

    private void validateDeclaredPhoto(CreateResumePhotoUploadDTO dto) {
        if (dto.getSizeBytes() <= 0 || dto.getSizeBytes() > properties.getMaxPhotoBytes()
                || dto.getWidth() > properties.getMaxImageDimension()
                || dto.getHeight() > properties.getMaxImageDimension()
                || (long) dto.getWidth() * dto.getHeight() > properties.getMaxImagePixels()) {
            throw invalidPhoto();
        }
    }

    private Long parsePhotoId(Object value) {
        if (value instanceof Number number && number.longValue() > 0) return number.longValue();
        if (value instanceof String text && text.matches("^[1-9][0-9]{0,18}$")) {
            try { return Long.parseLong(text); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private String normalizeFileName(String value, String extension) {
        String normalized = value == null ? "" : value.replace('\\', '/');
        int slash = normalized.lastIndexOf('/');
        if (slash >= 0) normalized = normalized.substring(slash + 1);
        normalized = normalized.replaceAll("[\\p{Cntrl}]", "").strip();
        if (normalized.isBlank() || normalized.length() > 200) return "resume-photo" + extension;
        return normalized;
    }

    private String prefix(String value) {
        String normalized = value == null ? "" : value.strip();
        if (!OBJECT_PREFIX.matcher(normalized).matches()) {
            // Startup validation guarantees this invariant. Treat any later mutation as
            // an internal configuration error instead of exposing an optional feature state.
            throw new IllegalStateException("Resume photo OSS prefix is invalid");
        }
        return normalized;
    }

    private String activeUserKey(Long userId) { return "RESUME_PHOTO:" + userId; }
    private BusinessException invalidPhoto() { return new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_INVALID); }
}
