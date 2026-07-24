package com.itwanger.pairesume.service.impl;

import com.aliyun.oss.ClientException;
import com.aliyun.oss.HttpMethod;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.model.CopyObjectRequest;
import com.aliyun.oss.model.CannedAccessControlList;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.aliyun.oss.model.MatchMode;
import com.aliyun.oss.model.OSSObject;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PolicyConditions;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewOssProperties;
import com.itwanger.pairesume.service.ResumeReviewObjectStorage;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Slf4j
@Component
@ConditionalOnProperty(name = "app.resume-review.oss.enabled", havingValue = "true")
public class AliyunOssResumeReviewObjectStorage implements ResumeReviewObjectStorage {
    private static final String PDF_CONTENT_TYPE = "application/pdf";
    private static final String SHA256_METADATA_KEY = "pdf-sha256";
    private static final String SSE_HEADER = "x-oss-server-side-encryption";
    private static final String ACL_HEADER = "x-oss-object-acl";
    private static final String FORBID_OVERWRITE_HEADER = "x-oss-forbid-overwrite";
    private static final byte[] PDF_MAGIC = "%PDF-".getBytes(StandardCharsets.US_ASCII);

    private final ResumeReviewOssProperties properties;
    private final OSS oss;

    public AliyunOssResumeReviewObjectStorage(ResumeReviewOssProperties properties) {
        this(properties, new OSSClientBuilder().build(
                properties.getEndpoint(),
                properties.getAccessKeyId(),
                properties.getAccessKeySecret()
        ));
    }

    AliyunOssResumeReviewObjectStorage(ResumeReviewOssProperties properties, OSS oss) {
        this.properties = properties;
        this.oss = oss;
    }

    @Override
    public UploadTarget createPdfUploadTarget(String stagingObjectKey, long expectedSizeBytes,
                                              String sha256, LocalDateTime expiresAt) {
        try {
            Date expiration = Date.from(expiresAt.atZone(ZoneId.systemDefault()).toInstant());
            PolicyConditions conditions = new PolicyConditions();
            conditions.addConditionItem("bucket", properties.getBucket());
            conditions.addConditionItem(MatchMode.Exact, PolicyConditions.COND_KEY,
                    stagingObjectKey);
            conditions.addConditionItem(PolicyConditions.COND_CONTENT_LENGTH_RANGE,
                    expectedSizeBytes, expectedSizeBytes);
            conditions.addConditionItem(MatchMode.Exact, PolicyConditions.COND_CONTENT_TYPE,
                    PDF_CONTENT_TYPE);
            conditions.addConditionItem(MatchMode.Exact,
                    PolicyConditions.COND_SUCCESS_ACTION_STATUS, "204");
            conditions.addConditionItem(MatchMode.Exact,
                    PolicyConditions.COND_X_OSS_META_PREFIX + SHA256_METADATA_KEY, sha256);
            conditions.addConditionItem(MatchMode.Exact, SSE_HEADER, "AES256");
            conditions.addConditionItem(MatchMode.Exact, ACL_HEADER, "private");
            conditions.addConditionItem(MatchMode.Exact, FORBID_OVERWRITE_HEADER, "true");

            String policyJson = oss.generatePostPolicy(expiration, conditions);
            String policy = Base64.getEncoder().encodeToString(
                    policyJson.getBytes(StandardCharsets.UTF_8));
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("key", stagingObjectKey);
            fields.put("policy", policy);
            fields.put("OSSAccessKeyId", properties.getAccessKeyId());
            fields.put("Signature", oss.calculatePostSignature(policyJson));
            fields.put("success_action_status", "204");
            fields.put("Content-Type", PDF_CONTENT_TYPE);
            fields.put("x-oss-meta-" + SHA256_METADATA_KEY, sha256);
            fields.put(SSE_HEADER, "AES256");
            fields.put(ACL_HEADER, "private");
            fields.put(FORBID_OVERWRITE_HEADER, "true");

            GeneratePresignedUrlRequest endpointRequest = new GeneratePresignedUrlRequest(
                    properties.getBucket(), stagingObjectKey, HttpMethod.GET);
            endpointRequest.setExpiration(expiration);
            var signedObjectUrl = oss.generatePresignedUrl(endpointRequest);
            String uploadUrl = signedObjectUrl.getProtocol() + "://"
                    + signedObjectUrl.getAuthority() + "/";
            return new UploadTarget(uploadUrl, "POST", Map.of(), Map.copyOf(fields));
        } catch (OSSException | ClientException exception) {
            throw storageFailure("create upload target", exception);
        }
    }

    @Override
    public FrozenPdf freezeUploadedPdf(String stagingObjectKey, String finalObjectKey,
                                       String originalFileName, long expectedSizeBytes,
                                       String expectedSha256) {
        try {
            FrozenPdf existing = findVerifiedFrozenPdf(
                    finalObjectKey, expectedSizeBytes, expectedSha256);
            if (existing != null) {
                return existing;
            }

            ObjectMetadata staging = oss.getObjectMetadata(properties.getBucket(), stagingObjectKey);
            validateMetadata(staging, expectedSizeBytes, expectedSha256);
            validatePdfContent(stagingObjectKey, expectedSizeBytes, expectedSha256);
            if (!StringUtils.hasText(staging.getETag())) {
                throw invalidPdf();
            }

            CopyObjectRequest copy = new CopyObjectRequest(
                    properties.getBucket(), stagingObjectKey,
                    properties.getBucket(), finalObjectKey);
            copy.setMatchingETagConstraints(List.of(staging.getETag()));
            ObjectMetadata immutableMetadata = new ObjectMetadata();
            immutableMetadata.setContentType(PDF_CONTENT_TYPE);
            immutableMetadata.setContentDisposition("attachment");
            immutableMetadata.setServerSideEncryption("AES256");
            immutableMetadata.setObjectAcl(CannedAccessControlList.Private);
            immutableMetadata.addUserMetadata(SHA256_METADATA_KEY, expectedSha256);
            copy.setNewObjectMetadata(immutableMetadata);
            var copyResult = oss.copyObject(copy);

            ObjectMetadata frozen = oss.getObjectMetadata(properties.getBucket(), finalObjectKey);
            validateMetadata(frozen, expectedSizeBytes, expectedSha256);
            String etag = StringUtils.hasText(copyResult.getETag())
                    ? copyResult.getETag() : frozen.getETag();
            if (!StringUtils.hasText(etag)) {
                throw invalidPdf();
            }
            return new FrozenPdf(finalObjectKey, etag, frozen.getContentLength());
        } catch (BusinessException exception) {
            throw exception;
        } catch (OSSException | ClientException exception) {
            throw storageFailure("freeze uploaded PDF", exception);
        }
    }

    private FrozenPdf findVerifiedFrozenPdf(String finalObjectKey, long expectedSizeBytes,
                                            String expectedSha256) {
        try {
            if (!oss.doesObjectExist(properties.getBucket(), finalObjectKey)) {
                return null;
            }
            ObjectMetadata frozen = oss.getObjectMetadata(properties.getBucket(), finalObjectKey);
            validateMetadata(frozen, expectedSizeBytes, expectedSha256);
            validatePdfContent(finalObjectKey, expectedSizeBytes, expectedSha256);
            if (!StringUtils.hasText(frozen.getETag())) {
                throw invalidPdf();
            }
            return new FrozenPdf(finalObjectKey, frozen.getETag(), frozen.getContentLength());
        } catch (OSSException exception) {
            if (isMissingObject(exception)) {
                return null;
            }
            throw exception;
        } catch (BusinessException exception) {
            if (exception.getCode() == ResultCode.RESUME_REVIEW_UPLOAD_INVALID.getCode()
                    && !oss.doesObjectExist(properties.getBucket(), finalObjectKey)) {
                return null;
            }
            throw exception;
        }
    }

    @Override
    public byte[] readVerifiedPdf(String objectKey, long expectedSizeBytes, String expectedSha256) {
        if (expectedSizeBytes <= 0 || expectedSizeBytes > properties.getMaxPdfBytes()
                || expectedSizeBytes > Integer.MAX_VALUE - 1L) {
            throw invalidPdf();
        }
        try {
            ObjectMetadata metadata = oss.getObjectMetadata(properties.getBucket(), objectKey);
            validateMetadata(metadata, expectedSizeBytes, expectedSha256);
            try (OSSObject object = oss.getObject(properties.getBucket(), objectKey);
                 InputStream input = object.getObjectContent()) {
                byte[] content = input.readNBytes((int) expectedSizeBytes + 1);
                if (content.length != expectedSizeBytes || !startsWithPdfMagic(content)
                        || !sha256(content).equalsIgnoreCase(expectedSha256)) {
                    throw invalidPdf();
                }
                return content;
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw storageFailure("read review PDF", exception);
        }
    }

    private void validateMetadata(ObjectMetadata metadata, long expectedSizeBytes,
                                  String expectedSha256) {
        if (metadata == null || !validSha256(expectedSha256)) {
            throw invalidPdf();
        }
        String contentType = metadata.getContentType();
        String storedSha256 = metadata.getUserMetadata().get(SHA256_METADATA_KEY);
        if (metadata.getContentLength() != expectedSizeBytes
                || expectedSizeBytes <= 0
                || expectedSizeBytes > properties.getMaxPdfBytes()
                || contentType == null
                || !PDF_CONTENT_TYPE.equals(contentType.toLowerCase(Locale.ROOT))
                || !expectedSha256.equalsIgnoreCase(storedSha256)
                || !"AES256".equalsIgnoreCase(metadata.getServerSideEncryption())) {
            throw invalidPdf();
        }
    }

    private void validatePdfContent(String objectKey, long expectedSizeBytes,
                                    String expectedSha256) {
        MessageDigest digest = sha256Digest();
        long total = 0;
        int prefixOffset = 0;
        try (OSSObject object = oss.getObject(properties.getBucket(), objectKey);
             InputStream input = object.getObjectContent()) {
            byte[] buffer = new byte[16 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                if (total + read > expectedSizeBytes) throw invalidPdf();
                for (int index = 0; index < read && prefixOffset < PDF_MAGIC.length;
                     index++, prefixOffset++) {
                    if (buffer[index] != PDF_MAGIC[prefixOffset]) throw invalidPdf();
                }
                digest.update(buffer, 0, read);
                total += read;
            }
            if (total != expectedSizeBytes || prefixOffset < PDF_MAGIC.length
                    || !HexFormat.of().formatHex(digest.digest())
                    .equalsIgnoreCase(expectedSha256)) {
                throw invalidPdf();
            }
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw storageFailure("validate review PDF content", exception);
        }
    }

    private boolean startsWithPdfMagic(byte[] value) {
        if (value == null || value.length < PDF_MAGIC.length) return false;
        for (int index = 0; index < PDF_MAGIC.length; index++) {
            if (value[index] != PDF_MAGIC[index]) return false;
        }
        return true;
    }

    private String sha256(byte[] value) {
        return HexFormat.of().formatHex(sha256Digest().digest(value));
    }

    private MessageDigest sha256Digest() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }

    private boolean validSha256(String value) {
        return value != null && value.matches("(?i)^[0-9a-f]{64}$");
    }

    private BusinessException invalidPdf() {
        return new BusinessException(ResultCode.RESUME_REVIEW_UPLOAD_INVALID);
    }

    private BusinessException storageFailure(String action, Exception exception) {
        if (exception instanceof OSSException ossException) {
            log.warn("Resume review OSS operation failed action={}, errorType={}, errorCode={}, requestId={}",
                    action,
                    exception.getClass().getSimpleName(),
                    ossException.getErrorCode(),
                    ossException.getRequestId());
            if (isMissingObject(ossException)
                    || "PreconditionFailed".equals(ossException.getErrorCode())) {
                return invalidPdf();
            }
        } else {
            log.warn("Resume review OSS operation failed action={}, errorType={}",
                    action, exception.getClass().getSimpleName());
        }
        return new BusinessException(ResultCode.RESUME_REVIEW_STORAGE_UNAVAILABLE);
    }

    private boolean isMissingObject(OSSException exception) {
        return "NoSuchKey".equals(exception.getErrorCode())
                || "NoSuchObject".equals(exception.getErrorCode());
    }

    @PreDestroy
    public void shutdown() {
        oss.shutdown();
    }
}
