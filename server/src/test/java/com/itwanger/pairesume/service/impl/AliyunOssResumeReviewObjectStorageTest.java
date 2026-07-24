package com.itwanger.pairesume.service.impl;

import com.aliyun.oss.ClientException;
import com.aliyun.oss.OSS;
import com.aliyun.oss.OSSException;
import com.aliyun.oss.model.CannedAccessControlList;
import com.aliyun.oss.model.CopyObjectRequest;
import com.aliyun.oss.model.CopyObjectResult;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.aliyun.oss.model.OSSObject;
import com.aliyun.oss.model.ObjectMetadata;
import com.aliyun.oss.model.PolicyConditions;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumeReviewOssProperties;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.lang.reflect.Proxy;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AliyunOssResumeReviewObjectStorageTest {
    private static final String BUCKET = "private-bucket";
    private static final String STAGING_KEY = "pairesume/resume-review/staging/test.pdf";
    private static final String FINAL_KEY = "pairesume/resume-review/objects/test.pdf";

    @Test
    void postPolicyPinsBucketKeyExactSizeAndSecurityFields() {
        InMemoryOss fake = new InMemoryOss();
        var storage = new AliyunOssResumeReviewObjectStorage(properties(), fake.client());

        var target = storage.createPdfUploadTarget(
                STAGING_KEY, 1024L, "a".repeat(64),
                LocalDateTime.now().plusMinutes(10));

        assertEquals("POST", target.method());
        assertEquals("https://private-bucket.oss-cn-hangzhou.aliyuncs.com/",
                target.uploadUrl());
        assertTrue(target.headers().isEmpty());
        assertEquals(STAGING_KEY, target.fields().get("key"));
        assertEquals("application/pdf", target.fields().get("Content-Type"));
        assertEquals("a".repeat(64),
                target.fields().get("x-oss-meta-pdf-sha256"));
        assertEquals("AES256",
                target.fields().get("x-oss-server-side-encryption"));
        assertEquals("private", target.fields().get("x-oss-object-acl"));
        assertEquals("true", target.fields().get("x-oss-forbid-overwrite"));
        assertEquals("test-access-key-id", target.fields().get("OSSAccessKeyId"));
        assertEquals("signature", target.fields().get("Signature"));

        String policy = fake.lastPolicyConditions.jsonize();
        assertTrue(policy.contains("{\"bucket\":\"private-bucket\"}"));
        assertTrue(policy.contains("[\"content-length-range\",1024,1024]"));
        assertTrue(policy.contains("[\"eq\",\"$key\","));
        assertTrue(policy.contains("[\"eq\",\"$Content-Type\",\"application\\/pdf\"]"));
        assertTrue(policy.contains(
                "[\"eq\",\"$x-oss-forbid-overwrite\",\"true\"]"));
    }

    @Test
    void freezeCopiesWithPrivateAclAndLeavesStagingForLifecycleCleanup() {
        byte[] pdf = "%PDF-1.7\nsafe test".getBytes(StandardCharsets.US_ASCII);
        String sha256 = sha256(pdf);
        InMemoryOss fake = new InMemoryOss();
        fake.put(STAGING_KEY, pdf, metadata(pdf, sha256, "etag-staging"));

        var storage = new AliyunOssResumeReviewObjectStorage(properties(), fake.client());
        var frozen = storage.freezeUploadedPdf(
                STAGING_KEY, FINAL_KEY, "resume.pdf", pdf.length, sha256);

        assertEquals(FINAL_KEY, frozen.objectKey());
        assertEquals("etag-final", frozen.etag());
        assertEquals(1, fake.copyCalls);
        assertEquals(0, fake.deleteCalls);
        assertTrue(fake.objects.containsKey(STAGING_KEY));
        assertTrue(fake.objects.containsKey(FINAL_KEY));

        CopyObjectRequest copy = fake.lastCopyRequest;
        assertNotNull(copy);
        assertEquals(CannedAccessControlList.Private.toString(),
                copy.getNewObjectMetadata().getRawMetadata().get("x-oss-object-acl"));
        assertEquals("AES256", copy.getNewObjectMetadata().getServerSideEncryption());
        assertEquals("etag-staging", copy.getMatchingETagConstraints().get(0));
    }

    @Test
    void freezeRecoversAnAlreadyCopiedFinalObjectWithoutStaging() {
        byte[] pdf = "%PDF-1.7\nretry-safe".getBytes(StandardCharsets.US_ASCII);
        String sha256 = sha256(pdf);
        InMemoryOss fake = new InMemoryOss();
        fake.put(FINAL_KEY, pdf, metadata(pdf, sha256, "etag-existing-final"));

        var storage = new AliyunOssResumeReviewObjectStorage(properties(), fake.client());
        var frozen = storage.freezeUploadedPdf(
                STAGING_KEY, FINAL_KEY, "resume.pdf", pdf.length, sha256);

        assertEquals(FINAL_KEY, frozen.objectKey());
        assertEquals("etag-existing-final", frozen.etag());
        assertEquals(pdf.length, frozen.sizeBytes());
        assertEquals(0, fake.copyCalls);
        assertEquals(0, fake.deleteCalls);
    }

    @Test
    void temporaryClientFailureIsRetryableInsteadOfRejectingThePdf() {
        InMemoryOss fake = new InMemoryOss();
        fake.doesObjectExistFailure = new ClientException("temporary timeout");
        var storage = new AliyunOssResumeReviewObjectStorage(properties(), fake.client());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> storage.freezeUploadedPdf(
                        STAGING_KEY, FINAL_KEY, "resume.pdf", 1024L,
                        "a".repeat(64)));

        assertEquals(ResultCode.RESUME_REVIEW_STORAGE_UNAVAILABLE.getCode(),
                exception.getCode());
        assertEquals(0, fake.copyCalls);
        assertEquals(0, fake.deleteCalls);
    }

    @Test
    void freezeRejectsStagingObjectWithoutEtagInsteadOfUnconditionalCopy() {
        byte[] pdf = "%PDF-1.7\nmissing etag".getBytes(StandardCharsets.US_ASCII);
        String sha256 = sha256(pdf);
        InMemoryOss fake = new InMemoryOss();
        fake.put(STAGING_KEY, pdf, metadata(pdf, sha256, null));
        var storage = new AliyunOssResumeReviewObjectStorage(properties(), fake.client());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> storage.freezeUploadedPdf(
                        STAGING_KEY, FINAL_KEY, "resume.pdf", pdf.length, sha256));

        assertEquals(ResultCode.RESUME_REVIEW_UPLOAD_INVALID.getCode(),
                exception.getCode());
        assertEquals(0, fake.copyCalls);
    }

    @Test
    void missingStagingObjectIsRejectedInsteadOfRetriedAsInfrastructureFailure() {
        InMemoryOss fake = new InMemoryOss();
        fake.missingObjectsAsNoSuchKey = true;
        var storage = new AliyunOssResumeReviewObjectStorage(properties(), fake.client());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> storage.freezeUploadedPdf(
                        STAGING_KEY, FINAL_KEY, "resume.pdf", 1024L,
                        "a".repeat(64)));

        assertEquals(ResultCode.RESUME_REVIEW_UPLOAD_INVALID.getCode(),
                exception.getCode());
        assertEquals(0, fake.copyCalls);
    }

    @Test
    void missingFinalDuringRecoveryFallsBackToTheStillAvailableStagingObject() {
        byte[] pdf = "%PDF-1.7\nrecovery race".getBytes(StandardCharsets.US_ASCII);
        String sha256 = sha256(pdf);
        InMemoryOss fake = new InMemoryOss();
        fake.put(STAGING_KEY, pdf, metadata(pdf, sha256, "etag-staging"));
        fake.missingObjectsAsNoSuchKey = true;
        fake.finalAppearsToExistOnce = true;
        var storage = new AliyunOssResumeReviewObjectStorage(properties(), fake.client());

        var frozen = storage.freezeUploadedPdf(
                STAGING_KEY, FINAL_KEY, "resume.pdf", pdf.length, sha256);

        assertEquals(FINAL_KEY, frozen.objectKey());
        assertEquals("etag-final", frozen.etag());
        assertEquals(1, fake.copyCalls);
        assertTrue(fake.objects.containsKey(STAGING_KEY));
    }

    private ResumeReviewOssProperties properties() {
        ResumeReviewOssProperties properties = new ResumeReviewOssProperties();
        properties.setEnabled(true);
        properties.setBucket(BUCKET);
        properties.setAccessKeyId("test-access-key-id");
        properties.setMaxPdfBytes(10L * 1024L * 1024L);
        return properties;
    }

    private static ObjectMetadata metadata(byte[] content, String sha256, String etag) {
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentLength(content.length);
        metadata.setContentType("application/pdf");
        metadata.setServerSideEncryption("AES256");
        metadata.setObjectAcl(CannedAccessControlList.Private);
        metadata.addUserMetadata("pdf-sha256", sha256);
        if (etag != null) {
            metadata.setHeader("ETag", etag);
        }
        return metadata;
    }

    private static String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(content));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static final class InMemoryOss {
        private final Map<String, StoredObject> objects = new HashMap<>();
        private int copyCalls;
        private int deleteCalls;
        private CopyObjectRequest lastCopyRequest;
        private PolicyConditions lastPolicyConditions;
        private RuntimeException doesObjectExistFailure;
        private boolean missingObjectsAsNoSuchKey;
        private boolean finalAppearsToExistOnce;

        void put(String key, byte[] content, ObjectMetadata metadata) {
            objects.put(key, new StoredObject(content.clone(), metadata));
        }

        OSS client() {
            return (OSS) Proxy.newProxyInstance(
                    OSS.class.getClassLoader(),
                    new Class<?>[]{OSS.class},
                    (proxy, method, arguments) -> switch (method.getName()) {
                        case "doesObjectExist" ->
                                doesObjectExist((String) arguments[1]);
                        case "getObjectMetadata" ->
                                require((String) arguments[1]).metadata();
                        case "getObject" -> object((String) arguments[1]);
                        case "copyObject" -> copy((CopyObjectRequest) arguments[0]);
                        case "generatePostPolicy" -> {
                            lastPolicyConditions = (PolicyConditions) arguments[1];
                            yield "{\"expiration\":\"2099-01-01T00:00:00.000Z\","
                                    + lastPolicyConditions.jsonize() + "}";
                        }
                        case "calculatePostSignature" -> "signature";
                        case "generatePresignedUrl" -> uploadUrl(
                                (GeneratePresignedUrlRequest) arguments[0]);
                        case "deleteObject" -> {
                            deleteCalls++;
                            objects.remove((String) arguments[1]);
                            yield null;
                        }
                        case "shutdown" -> null;
                        case "toString" -> "InMemoryOss";
                        case "hashCode" -> System.identityHashCode(proxy);
                        case "equals" -> proxy == arguments[0];
                        default -> throw new AssertionError(
                                "Unexpected OSS call: " + method.getName());
                    });
        }

        private boolean doesObjectExist(String key) {
            if (doesObjectExistFailure != null) {
                throw doesObjectExistFailure;
            }
            if (FINAL_KEY.equals(key) && finalAppearsToExistOnce) {
                finalAppearsToExistOnce = false;
                return true;
            }
            return objects.containsKey(key);
        }

        private URL uploadUrl(GeneratePresignedUrlRequest ignored) {
            try {
                return new URL("https://private-bucket.oss-cn-hangzhou.aliyuncs.com/"
                        + STAGING_KEY + "?signature=ignored");
            } catch (Exception exception) {
                throw new IllegalStateException(exception);
            }
        }

        private OSSObject object(String key) {
            StoredObject stored = require(key);
            OSSObject object = new OSSObject();
            object.setBucketName(BUCKET);
            object.setKey(key);
            object.setObjectMetadata(stored.metadata());
            object.setObjectContent(new ByteArrayInputStream(stored.content()));
            return object;
        }

        private CopyObjectResult copy(CopyObjectRequest request) {
            copyCalls++;
            lastCopyRequest = request;
            StoredObject source = require(request.getSourceKey());
            ObjectMetadata destinationMetadata = request.getNewObjectMetadata();
            destinationMetadata.setContentLength(source.content().length);
            destinationMetadata.setHeader("ETag", "etag-final");
            put(request.getDestinationKey(), source.content(), destinationMetadata);

            CopyObjectResult result = new CopyObjectResult();
            result.setEtag("etag-final");
            return result;
        }

        private StoredObject require(String key) {
            StoredObject stored = objects.get(key);
            if (stored == null) {
                if (missingObjectsAsNoSuchKey) {
                    throw new OSSException(
                            "Object does not exist", "NoSuchKey", "request-id",
                            "private-bucket", null, "Object", "GET");
                }
                throw new AssertionError("Missing fake object: " + key);
            }
            return stored;
        }
    }

    private record StoredObject(byte[] content, ObjectMetadata metadata) {
    }
}
