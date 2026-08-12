package com.itwanger.pairesume.service.impl;

import com.aliyun.oss.OSS;
import com.aliyun.oss.model.GeneratePresignedUrlRequest;
import com.aliyun.oss.model.PolicyConditions;
import com.itwanger.pairesume.config.ResumePhotoOssProperties;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Proxy;
import java.net.URL;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class AliyunOssResumePhotoObjectStorageTest {
    @Test
    void postPolicyPinsPrivateImageTypeExactSizeHashAndObjectKey() throws Exception {
        PolicyConditions[] captured = new PolicyConditions[1];
        OSS oss = (OSS) Proxy.newProxyInstance(OSS.class.getClassLoader(), new Class<?>[]{OSS.class},
                (proxy, method, arguments) -> switch (method.getName()) {
                    case "generatePostPolicy" -> {
                        captured[0] = (PolicyConditions) arguments[1];
                        yield "{" + captured[0].jsonize() + "}";
                    }
                    case "calculatePostSignature" -> "signature";
                    case "generatePresignedUrl" -> new URL(
                            "https://private-bucket.oss-cn-hangzhou.aliyuncs.com/key?signature=test");
                    case "shutdown" -> null;
                    case "toString" -> "PhotoOssFake";
                    case "hashCode" -> System.identityHashCode(proxy);
                    case "equals" -> proxy == arguments[0];
                    default -> throw new AssertionError("Unexpected OSS call " + method.getName());
                });
        ResumePhotoOssProperties properties = new ResumePhotoOssProperties();
        properties.setBucket("private-bucket");
        properties.setAccessKeyId("test-access-key-id");
        var storage = new AliyunOssResumePhotoObjectStorage(properties, oss);

        var target = storage.createUploadTarget("pairesume/resume-photo/staging/test.png",
                1024, "image/png", "a".repeat(64), LocalDateTime.now().plusMinutes(10));

        assertEquals("POST", target.method());
        assertEquals("image/png", target.fields().get("Content-Type"));
        assertEquals("private", target.fields().get("x-oss-object-acl"));
        assertEquals("AES256", target.fields().get("x-oss-server-side-encryption"));
        assertEquals("true", target.fields().get("x-oss-forbid-overwrite"));
        assertEquals("a".repeat(64), target.fields().get("x-oss-meta-photo-sha256"));
        assertNotNull(captured[0]);
        String policy = captured[0].jsonize();
        assertTrue(policy.contains("[\"content-length-range\",1024,1024]"));
        assertTrue(policy.contains("[\"eq\",\"$Content-Type\",\"image\\/png\"]"));
        assertTrue(policy.contains("pairesume\\/resume-photo\\/staging\\/test.png"));
    }
}
