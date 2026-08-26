package com.itwanger.pairesume.service.impl;

import com.aliyun.oss.*;
import com.aliyun.oss.model.*;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumePhotoOssProperties;
import com.itwanger.pairesume.security.ResumePhotoSecurityPolicy;
import com.itwanger.pairesume.service.ResumePhotoObjectStorage;
import com.itwanger.pairesume.service.ResumePhotoOssConfigService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;

@Slf4j
@Component
public class AliyunOssResumePhotoObjectStorage implements ResumePhotoObjectStorage {
    private static final String SHA256_METADATA_KEY = "photo-sha256";
    private static final String SSE_HEADER = "x-oss-server-side-encryption";
    private static final String ACL_HEADER = "x-oss-object-acl";
    private static final String FORBID_OVERWRITE_HEADER = "x-oss-forbid-overwrite";

    private final ResumePhotoOssProperties properties;
    private final ResumePhotoOssConfigService configService;
    private final OSS fixedClient;

    @Autowired
    public AliyunOssResumePhotoObjectStorage(ResumePhotoOssProperties properties,
                                              ResumePhotoOssConfigService configService) {
        this.properties = properties;
        this.configService = configService;
        this.fixedClient = null;
    }

    AliyunOssResumePhotoObjectStorage(ResumePhotoOssProperties properties, OSS oss) {
        this.properties = properties;
        this.configService = null;
        this.fixedClient = oss;
    }

    @Override
    public UploadTarget createUploadTarget(String stagingObjectKey, long expectedSizeBytes,
                                           String contentType, String sha256,
                                           LocalDateTime expiresAt) {
        var active = activeConfig();
        OSS oss = client(active);
        try {
            Date expiration = Date.from(expiresAt.atZone(ZoneId.systemDefault()).toInstant());
            PolicyConditions conditions = new PolicyConditions();
            conditions.addConditionItem("bucket", active.bucket());
            conditions.addConditionItem(MatchMode.Exact, PolicyConditions.COND_KEY, stagingObjectKey);
            conditions.addConditionItem(PolicyConditions.COND_CONTENT_LENGTH_RANGE,
                    expectedSizeBytes, expectedSizeBytes);
            conditions.addConditionItem(MatchMode.Exact, PolicyConditions.COND_CONTENT_TYPE, contentType);
            conditions.addConditionItem(MatchMode.Exact, PolicyConditions.COND_SUCCESS_ACTION_STATUS, "204");
            conditions.addConditionItem(MatchMode.Exact,
                    PolicyConditions.COND_X_OSS_META_PREFIX + SHA256_METADATA_KEY, sha256);
            conditions.addConditionItem(MatchMode.Exact, SSE_HEADER, "AES256");
            conditions.addConditionItem(MatchMode.Exact, ACL_HEADER, "private");
            conditions.addConditionItem(MatchMode.Exact, FORBID_OVERWRITE_HEADER, "true");

            String policyJson = oss.generatePostPolicy(expiration, conditions);
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("key", stagingObjectKey);
            fields.put("policy", Base64.getEncoder().encodeToString(
                    policyJson.getBytes(StandardCharsets.UTF_8)));
            fields.put("OSSAccessKeyId", active.accessKeyId());
            fields.put("Signature", oss.calculatePostSignature(policyJson));
            fields.put("success_action_status", "204");
            fields.put("Content-Type", contentType);
            fields.put("x-oss-meta-" + SHA256_METADATA_KEY, sha256);
            fields.put(SSE_HEADER, "AES256");
            fields.put(ACL_HEADER, "private");
            fields.put(FORBID_OVERWRITE_HEADER, "true");

            GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(
                    active.bucket(), stagingObjectKey, HttpMethod.GET);
            request.setExpiration(expiration);
            var signed = oss.generatePresignedUrl(request);
            return new UploadTarget(signed.getProtocol() + "://" + signed.getAuthority() + "/",
                    "POST", Map.of(), Map.copyOf(fields));
        } catch (OSSException | ClientException exception) {
            throw storageFailure("create photo upload target", exception);
        } finally {
            closeClient(oss);
        }
    }

    @Override
    public StoredPhoto finalizePhoto(String stagingObjectKey, String objectKey,
                                     String contentType, long expectedSizeBytes,
                                     String expectedSha256, int expectedWidth, int expectedHeight) {
        var active = activeConfig();
        OSS oss = client(active);
        try {
            ObjectMetadata metadata = oss.getObjectMetadata(active.bucket(), stagingObjectKey);
            validateMetadata(metadata, contentType, expectedSizeBytes, expectedSha256);
            byte[] bytes = readExact(oss, active.bucket(), stagingObjectKey, expectedSizeBytes);
            if (!sha256(bytes).equalsIgnoreCase(expectedSha256)) throw invalidPhoto();
            var dimensions = ResumePhotoSecurityPolicy.inspectRasterBytes(
                    contentType, bytes, properties.getMaxImageDimension(), properties.getMaxImagePixels());
            if (dimensions == null || dimensions.width() != expectedWidth
                    || dimensions.height() != expectedHeight) throw invalidPhoto();
            if (!StringUtils.hasText(metadata.getETag())) throw invalidPhoto();

            CopyObjectRequest copy = new CopyObjectRequest(active.bucket(), stagingObjectKey,
                    active.bucket(), objectKey);
            copy.setMatchingETagConstraints(List.of(metadata.getETag()));
            ObjectMetadata finalMetadata = new ObjectMetadata();
            finalMetadata.setContentType(contentType);
            finalMetadata.setContentDisposition("inline");
            finalMetadata.setCacheControl("private, max-age=300");
            finalMetadata.setServerSideEncryption("AES256");
            finalMetadata.setObjectAcl(CannedAccessControlList.Private);
            finalMetadata.addUserMetadata(SHA256_METADATA_KEY, expectedSha256);
            copy.setNewObjectMetadata(finalMetadata);
            var copied = oss.copyObject(copy);

            ObjectMetadata stored = oss.getObjectMetadata(active.bucket(), objectKey);
            validateMetadata(stored, contentType, expectedSizeBytes, expectedSha256);
            String etag = StringUtils.hasText(copied.getETag()) ? copied.getETag() : stored.getETag();
            if (!StringUtils.hasText(etag)) throw invalidPhoto();
            return new StoredPhoto(objectKey, etag, stored.getContentLength(),
                    Math.toIntExact(dimensions.width()), Math.toIntExact(dimensions.height()));
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw storageFailure("finalize photo", exception);
        } finally {
            closeClient(oss);
        }
    }

    @Override
    public String createAccessUrl(String objectKey, LocalDateTime expiresAt) {
        var active = activeConfig();
        OSS oss = client(active);
        try {
            GeneratePresignedUrlRequest request = new GeneratePresignedUrlRequest(
                    active.bucket(), objectKey, HttpMethod.GET);
            request.setExpiration(Date.from(expiresAt.atZone(ZoneId.systemDefault()).toInstant()));
            return oss.generatePresignedUrl(request).toExternalForm();
        } catch (OSSException | ClientException exception) {
            throw storageFailure("create photo access URL", exception);
        } finally {
            closeClient(oss);
        }
    }

    @Override
    public void deleteObject(String objectKey) {
        if (!StringUtils.hasText(objectKey)) return;
        var active = activeConfig();
        OSS oss = client(active);
        try {
            oss.deleteObject(active.bucket(), objectKey);
        } catch (OSSException exception) {
            if (!"NoSuchKey".equals(exception.getErrorCode())) throw storageFailure("delete photo", exception);
        } catch (ClientException exception) {
            throw storageFailure("delete photo", exception);
        } finally {
            closeClient(oss);
        }
    }

    private byte[] readExact(OSS oss, String bucket, String objectKey, long size) throws Exception {
        if (size <= 0 || size > properties.getMaxPhotoBytes() || size > Integer.MAX_VALUE - 1L) {
            throw invalidPhoto();
        }
        try (OSSObject object = oss.getObject(bucket, objectKey);
             InputStream input = object.getObjectContent()) {
            byte[] bytes = input.readNBytes((int) size + 1);
            if (bytes.length != size) throw invalidPhoto();
            return bytes;
        }
    }

    private void validateMetadata(ObjectMetadata metadata, String type, long size, String sha256) {
        if (metadata == null || metadata.getContentLength() != size || size <= 0
                || size > properties.getMaxPhotoBytes()
                || !type.equalsIgnoreCase(metadata.getContentType())
                || !sha256.equalsIgnoreCase(metadata.getUserMetadata().get(SHA256_METADATA_KEY))
                || !"AES256".equalsIgnoreCase(metadata.getServerSideEncryption())) {
            throw invalidPhoto();
        }
    }

    private String sha256(byte[] bytes) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }

    private BusinessException invalidPhoto() {
        return new BusinessException(ResultCode.RESUME_PHOTO_UPLOAD_INVALID);
    }

    private BusinessException storageFailure(String action, Exception exception) {
        log.warn("Resume photo OSS operation failed action={}, errorType={}",
                action, exception.getClass().getSimpleName());
        if (exception instanceof OSSException ossException
                && ("NoSuchKey".equals(ossException.getErrorCode())
                || "NoSuchObject".equals(ossException.getErrorCode())
                || "PreconditionFailed".equals(ossException.getErrorCode()))) {
            return invalidPhoto();
        }
        return new BusinessException(ResultCode.RESUME_PHOTO_STORAGE_UNAVAILABLE);
    }

    private ResumePhotoOssConfigService.ActiveResumePhotoOssConfig activeConfig() {
        if (configService != null) return configService.resolveActive();
        return new ResumePhotoOssConfigService.ActiveResumePhotoOssConfig(
                properties.getEndpoint(), properties.getBucket(),
                "pairesume",
                properties.getAccessKeyId(), properties.getAccessKeySecret());
    }

    private OSS client(ResumePhotoOssConfigService.ActiveResumePhotoOssConfig active) {
        if (fixedClient != null) return fixedClient;
        return new OSSClientBuilder().build(
                active.endpoint(), active.accessKeyId(), active.accessKeySecret());
    }

    private void closeClient(OSS oss) {
        if (fixedClient == null && oss != null) oss.shutdown();
    }
}
