package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.config.ResumePhotoOssProperties;
import com.itwanger.pairesume.dto.CreateResumePhotoUploadDTO;
import com.itwanger.pairesume.entity.ResumePhoto;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.ResumePhotoMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.service.ResumePhotoObjectStorage;
import com.itwanger.pairesume.service.ResumePhotoOssConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.ArgumentCaptor;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ResumePhotoServiceTest {
    @Mock private ResumePhotoMapper photoMapper;
    @Mock private UserMapper userMapper;
    @Mock private ResumePhotoObjectStorage objectStorage;
    @Mock private ResumePhotoOssConfigService ossConfigService;
    private ResumePhotoOssProperties properties;
    private ResumePhotoService service;

    @BeforeEach
    void setUp() {
        properties = new ResumePhotoOssProperties();
        service = new ResumePhotoService(
                photoMapper, userMapper, objectStorage, ossConfigService, properties);
    }

    @Test
    void rejectsDeclaredPhotoThatExceedsPixelLimitBeforeCreatingTicket() {
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectById(7L)).thenReturn(user);
        CreateResumePhotoUploadDTO dto = new CreateResumePhotoUploadDTO();
        dto.setFileName("photo.png");
        dto.setContentType("image/png");
        dto.setSizeBytes(1024);
        dto.setSha256("a".repeat(64));
        dto.setWidth(4096);
        dto.setHeight(4096);

        assertThrows(BusinessException.class, () -> service.authorize(7L, dto));
        verify(photoMapper, never()).insert(any(ResumePhoto.class));
    }

    @Test
    void persistenceStoresOwnedPhotoIdButNeverSignedUrl() {
        ResumePhoto photo = readyPhoto(9L, 7L);
        when(photoMapper.selectById(9L)).thenReturn(photo);

        Map<String, Object> result = service.prepareBasicInfoForPersistence(7L, "basic_info",
                Map.of("name", "张三", "photoId", 9L,
                        "photo", "https://private-oss.example/signed"));

        assertEquals(9L, result.get("photoId"));
        assertFalse(result.containsKey("photo"));
    }

    @Test
    void persistenceRejectsPhotoOwnedByAnotherUser() {
        when(photoMapper.selectById(9L)).thenReturn(readyPhoto(9L, 8L));
        assertThrows(BusinessException.class, () -> service.prepareBasicInfoForPersistence(
                7L, "basic_info", Map.of("photoId", 9L)));
    }

    @Test
    void persistenceKeepsSafeExternalPhotoLinkWithoutPhotoAsset() {
        Map<String, Object> result = service.prepareBasicInfoForPersistence(7L, "basic_info",
                Map.of("name", "张三", "photo", "  https://images.example.com/photo.jpg?size=large  "));

        assertEquals("https://images.example.com/photo.jpg?size=large", result.get("photo"));
        assertFalse(result.containsKey("photoId"));
        verifyNoInteractions(photoMapper);
    }

    @Test
    void uploadKeysUseAdminConfiguredObjectPrefix() {
        User user = new User();
        user.setId(7L);
        user.setStatus(1);
        when(userMapper.selectById(7L)).thenReturn(user);
        when(ossConfigService.resolveActive()).thenReturn(
                new ResumePhotoOssConfigService.ActiveResumePhotoOssConfig(
                        "https://oss-cn-beijing.aliyuncs.com", "itwanger-oss", "pairesume",
                        "access-key-id", "access-key-secret"));
        when(objectStorage.createUploadTarget(anyString(), anyLong(), anyString(), anyString(), any()))
                .thenReturn(new ResumePhotoObjectStorage.UploadTarget(
                        "https://itwanger-oss.oss-cn-beijing.aliyuncs.com/", "POST",
                        Map.of(), Map.of()));
        CreateResumePhotoUploadDTO dto = new CreateResumePhotoUploadDTO();
        dto.setFileName("photo.png");
        dto.setContentType("image/png");
        dto.setSizeBytes(1024);
        dto.setSha256("a".repeat(64));
        dto.setWidth(600);
        dto.setHeight(800);

        service.authorize(7L, dto);

        var photo = ArgumentCaptor.forClass(ResumePhoto.class);
        verify(photoMapper).insert(photo.capture());
        assertTrue(photo.getValue().getStagingObjectKey()
                .startsWith("pairesume/resume-photo/staging/"));
        assertTrue(photo.getValue().getObjectKey()
                .startsWith("pairesume/resume-photo/objects/"));
    }

    @Test
    void accountAvatarPublishesSeparateObjectWithoutChangingPrivateOriginal() {
        ResumePhoto photo = readyPhoto(9L, 7L);
        photo.setObjectKey("pairesume/resume-photo/objects/2026/09/08/uuid.jpg");
        when(photoMapper.selectById(9L)).thenReturn(photo);
        when(objectStorage.publishAvatar(photo.getObjectKey(), "pairesume/account-avatar/2026/09/08/uuid.jpg"))
                .thenReturn("https://cdn.example.com/pairesume/account-avatar/2026/09/08/uuid.jpg");
        assertEquals("https://cdn.example.com/pairesume/account-avatar/2026/09/08/uuid.jpg",
                service.accountAvatarUrl(7L, 9L));
        verify(objectStorage, never()).createAccessUrl(anyString(), any());
        assertEquals("pairesume/resume-photo/objects/2026/09/08/uuid.jpg", photo.getObjectKey());
    }

    @Test
    void privateContentRemainsReadableAfterUploadTicketExpiresButRejectsOtherUsers() {
        ResumePhoto photo = readyPhoto(9L, 7L);
        photo.setObjectKey("pairesume/resume-photo/objects/image.jpg");
        photo.setSizeBytes(3L);
        photo.setContentType("image/jpeg");
        photo.setExpiresAt(java.time.LocalDateTime.now().minusYears(1));
        when(photoMapper.selectById(9L)).thenReturn(photo);
        when(objectStorage.readPhoto(photo.getObjectKey(), 3L)).thenReturn(new byte[]{1, 2, 3});
        assertArrayEquals(new byte[]{1, 2, 3}, service.readContent(7L, 9L).bytes());
        assertThrows(BusinessException.class, () -> service.readContent(8L, 9L));
        assertThrows(BusinessException.class, () -> service.accountAvatarUrl(8L, 9L));
        verify(objectStorage, times(1)).readPhoto(anyString(), anyLong());
        verify(objectStorage, never()).publishAvatar(anyString(), anyString());
    }

    @Test
    void accountDeletionAlsoRemovesPublicAvatarCopy() {
        ResumePhoto photo = readyPhoto(9L, 7L);
        photo.setObjectKey("pairesume/resume-photo/objects/uuid.jpg");
        photo.setStagingObjectKey("pairesume/resume-photo/staging/uuid.jpg");
        when(photoMapper.selectList(any())).thenReturn(java.util.List.of(photo));
        service.deleteAllForUser(7L);
        verify(objectStorage).deleteObject("pairesume/account-avatar/uuid.jpg");
        verify(objectStorage).deleteObject(photo.getObjectKey());
        verify(objectStorage).deleteObject(photo.getStagingObjectKey());
    }

    private ResumePhoto readyPhoto(Long id, Long userId) {
        ResumePhoto photo = new ResumePhoto();
        photo.setId(id);
        photo.setUserId(userId);
        photo.setPhotoStatus("READY");
        photo.setObjectEtag("etag");
        return photo;
    }
}
