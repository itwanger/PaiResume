package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewOssProperties;
import com.itwanger.pairesume.config.ResumeReviewProperties;
import com.itwanger.pairesume.dto.CreateResumeReviewUploadDTO;
import com.itwanger.pairesume.entity.Resume;
import com.itwanger.pairesume.entity.ResumeReviewUpload;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.ResumeReviewRequestMapper;
import com.itwanger.pairesume.mapper.ResumeReviewUploadMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.ResumeReviewObjectStorage;
import com.itwanger.pairesume.service.ResumeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumeReviewUploadServiceTest {
    @Mock private ResumeReviewUploadMapper uploadMapper;
    @Mock private ResumeReviewRequestMapper requestMapper;
    @Mock private UserMapper userMapper;
    @Mock private ResumeService resumeService;
    @Mock private ResumeReviewObjectStorage objectStorage;

    private ResumeReviewOssProperties properties;
    private ResumeReviewProperties reviewProperties;
    private ResumeReviewUploadService service;

    @BeforeEach
    void setUp() {
        properties = new ResumeReviewOssProperties();
        properties.setEnabled(true);
        properties.setMaxPdfBytes(10L * 1024L * 1024L);
        properties.setUploadUrlTtlMinutes(10);
        properties.setReadyTtlMinutes(30);
        reviewProperties = new ResumeReviewProperties();
        reviewProperties.setEnabled(true);
        service = new ResumeReviewUploadService(uploadMapper, requestMapper, userMapper,
                resumeService, objectStorage, properties, reviewProperties);

        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        lenient().when(userMapper.selectByIdForUpdate(7L)).thenReturn(user);
        Resume resume = new Resume();
        resume.setId(11L);
        resume.setUserId(7L);
        lenient().when(resumeService.getByIdAndUserId(11L, 7L)).thenReturn(resume);
        lenient().doAnswer(invocation -> {
            invocation.<ResumeReviewUpload>getArgument(0).setId(99L);
            return 1;
        }).when(uploadMapper).insert(any(ResumeReviewUpload.class));
    }

    @Test
    void masterSwitchRejectsAuthorizeAndCompleteBeforeDatabaseOrOssAccess() {
        reviewProperties.setEnabled(false);

        BusinessException authorize = assertThrows(BusinessException.class,
                () -> service.authorize(7L, uploadDto()));
        BusinessException complete = assertThrows(BusinessException.class,
                () -> service.complete(7L, "RU-upload"));

        assertEquals(ResultCode.RESUME_REVIEW_DISABLED.getCode(), authorize.getCode());
        assertEquals(ResultCode.RESUME_REVIEW_DISABLED.getCode(), complete.getCode());
        verifyNoInteractions(requestMapper, resumeService, objectStorage);
        verify(userMapper, never()).selectByIdForUpdate(anyLong());
        verify(uploadMapper, never()).selectByUploadNoForUpdate(anyString());
    }

    @Test
    void authorizeLocksUserAndReturnsBoundPostPolicy() {
        when(objectStorage.createPdfUploadTarget(
                anyString(), eq(1024L), eq("a".repeat(64)), any()))
                .thenReturn(new ResumeReviewObjectStorage.UploadTarget(
                        "https://bucket.oss.example/", "POST", Map.of(),
                        Map.of("policy", "signed-policy")));

        var result = service.authorize(7L, uploadDto());

        assertEquals("POST", result.getMethod());
        assertEquals("signed-policy", result.getFields().get("policy"));
        assertEquals(properties.getMaxPdfBytes(), result.getMaxSizeBytes());
        assertTrue(result.getUploadNo().startsWith("RU"));
        verify(userMapper).selectByIdForUpdate(7L);
        verify(resumeService).getByIdAndUserId(11L, 7L);

        ArgumentCaptor<ResumeReviewUpload> uploadCaptor =
                ArgumentCaptor.forClass(ResumeReviewUpload.class);
        verify(uploadMapper).insert(uploadCaptor.capture());
        ResumeReviewUpload upload = uploadCaptor.getValue();
        assertEquals("PENDING", upload.getUploadStatus());
        assertEquals("RESUME_REVIEW_UPLOAD:7", upload.getActiveUserKey());
        assertTrue(upload.getStagingObjectKey().endsWith(".pdf"));
        assertTrue(upload.getFinalObjectKey().endsWith(".pdf"));
        assertFalse(upload.getFinalObjectKey().equals(upload.getStagingObjectKey()));
    }

    @Test
    void authorizeExpiresPreviousTicketWithoutDeletingItsObjectInsideTransaction() {
        ResumeReviewUpload previous = readyUpload();
        when(uploadMapper.selectActiveForUpdate("RESUME_REVIEW_UPLOAD:7")).thenReturn(previous);
        when(objectStorage.createPdfUploadTarget(anyString(), anyLong(), anyString(), any()))
                .thenReturn(new ResumeReviewObjectStorage.UploadTarget(
                        "https://bucket.oss.example/", "POST", Map.of(), Map.of()));

        service.authorize(7L, uploadDto());

        assertEquals("EXPIRED", previous.getUploadStatus());
        assertNull(previous.getActiveUserKey());
        verify(uploadMapper).updateById(previous);
    }

    @Test
    void completeStreamsAndFreezesTheExactOwnedPdf() {
        ResumeReviewUpload pending = pendingUpload();
        when(uploadMapper.selectByUploadNoForUpdate("RU-upload")).thenReturn(pending);
        when(objectStorage.freezeUploadedPdf(
                pending.getStagingObjectKey(), pending.getFinalObjectKey(),
                pending.getOriginalFileName(), pending.getSizeBytes(), pending.getSha256()))
                .thenReturn(new ResumeReviewObjectStorage.FrozenPdf(
                        pending.getFinalObjectKey(), "etag-frozen", pending.getSizeBytes()));

        var result = service.complete(7L, "RU-upload");

        assertEquals("READY", result.getStatus());
        assertEquals("etag-frozen", pending.getObjectEtag());
        assertEquals("READY", pending.getUploadStatus());
        assertTrue(pending.getExpiresAt().isAfter(LocalDateTime.now().plusMinutes(25)));
        verify(uploadMapper).updateById(pending);
    }

    @Test
    void completeRejectsAnotherUsersTicketBeforeAccessingOss() {
        ResumeReviewUpload pending = pendingUpload();
        pending.setUserId(8L);
        when(uploadMapper.selectByUploadNoForUpdate("RU-upload")).thenReturn(pending);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.complete(7L, "RU-upload"));

        assertEquals(ResultCode.RESUME_REVIEW_UPLOAD_FORBIDDEN.getCode(), exception.getCode());
        verifyNoInteractions(objectStorage);
    }

    @Test
    void deterministicPdfFailureRejectsTicketAndClearsActiveKey() {
        ResumeReviewUpload pending = pendingUpload();
        when(uploadMapper.selectByUploadNoForUpdate("RU-upload")).thenReturn(pending);
        when(objectStorage.freezeUploadedPdf(anyString(), anyString(), anyString(),
                anyLong(), anyString()))
                .thenThrow(new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.complete(7L, "RU-upload"));

        assertEquals(ResultCode.RESUME_REVIEW_UPLOAD_INVALID.getCode(),
                exception.getCode());
        assertEquals("REJECTED", pending.getUploadStatus());
        assertNull(pending.getActiveUserKey());
        verify(uploadMapper).updateById(pending);
    }

    @Test
    void temporaryOssFailureKeepsTicketPendingForRetry() {
        ResumeReviewUpload pending = pendingUpload();
        when(uploadMapper.selectByUploadNoForUpdate("RU-upload")).thenReturn(pending);
        when(objectStorage.freezeUploadedPdf(anyString(), anyString(), anyString(),
                anyLong(), anyString()))
                .thenThrow(new BusinessException(
                        ResultCode.RESUME_REVIEW_STORAGE_UNAVAILABLE));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.complete(7L, "RU-upload"));

        assertEquals(ResultCode.RESUME_REVIEW_STORAGE_UNAVAILABLE.getCode(),
                exception.getCode());
        assertEquals("PENDING", pending.getUploadStatus());
        assertEquals("RESUME_REVIEW_UPLOAD:7", pending.getActiveUserKey());
        verify(uploadMapper, never()).updateById(pending);
    }

    @Test
    void requireReadyBindsUploadToTheResumeAndConsumeClearsActiveKey() {
        ResumeReviewUpload ready = readyUpload();
        when(uploadMapper.selectByUploadNoForUpdate("RU-upload")).thenReturn(ready);

        ResumeReviewUpload selected = service.requireReadyForCreate(7L, "RU-upload", 11L);
        service.markConsumed(selected, 123L);

        assertEquals("CONSUMED", ready.getUploadStatus());
        assertEquals(123L, ready.getConsumedRequestId());
        assertNull(ready.getActiveUserKey());
        verify(uploadMapper).updateById(ready);
    }

    @Test
    void authorizeRejectsDisabledAccountBeforeIssuingOssCredentials() {
        User disabled = new User();
        disabled.setId(7L);
        disabled.setStatus(0);
        when(userMapper.selectByIdForUpdate(7L)).thenReturn(disabled);

        BusinessException exception = assertThrows(BusinessException.class,
                () -> service.authorize(7L, uploadDto()));

        assertEquals(ResultCode.USER_NOT_FOUND.getCode(), exception.getCode());
        verifyNoInteractions(objectStorage);
    }

    private CreateResumeReviewUploadDTO uploadDto() {
        CreateResumeReviewUploadDTO dto = new CreateResumeReviewUploadDTO();
        dto.setResumeId(11L);
        dto.setFileName("我的简历.pdf");
        dto.setSizeBytes(1024L);
        dto.setSha256("a".repeat(64));
        return dto;
    }

    private ResumeReviewUpload pendingUpload() {
        ResumeReviewUpload upload = new ResumeReviewUpload();
        upload.setId(99L);
        upload.setUploadNo("RU-upload");
        upload.setUserId(7L);
        upload.setResumeId(11L);
        upload.setActiveUserKey("RESUME_REVIEW_UPLOAD:7");
        upload.setStagingObjectKey("staging/test.pdf");
        upload.setFinalObjectKey("objects/test.pdf");
        upload.setOriginalFileName("resume.pdf");
        upload.setSizeBytes(1024L);
        upload.setSha256("a".repeat(64));
        upload.setUploadStatus("PENDING");
        upload.setExpiresAt(LocalDateTime.now().plusMinutes(5));
        return upload;
    }

    private ResumeReviewUpload readyUpload() {
        ResumeReviewUpload upload = pendingUpload();
        upload.setUploadStatus("READY");
        upload.setObjectEtag("etag");
        return upload;
    }
}
