package com.itwanger.pairesume.service.impl;

import com.aliyun.oss.ClientException;
import com.aliyun.oss.OSSClientBuilder;
import com.aliyun.oss.OSSException;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.config.ResumePhotoOssProperties;
import com.itwanger.pairesume.dto.ResumePhotoOssConfigUpdateDTO;
import com.itwanger.pairesume.dto.ResumePhotoOssConfigViewDTO;
import com.itwanger.pairesume.dto.ResumePhotoOssTestResultDTO;
import com.itwanger.pairesume.entity.ResumePhotoOssConfig;
import com.itwanger.pairesume.entity.ResumePhotoOssConfigAudit;
import com.itwanger.pairesume.mapper.ResumePhotoOssConfigAuditMapper;
import com.itwanger.pairesume.mapper.ResumePhotoOssConfigMapper;
import com.itwanger.pairesume.service.ResumePhotoOssConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URI;
import java.util.ArrayList;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class ResumePhotoOssConfigServiceImpl implements ResumePhotoOssConfigService {
    private static final Pattern BUCKET = Pattern.compile("^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$");
    private static final Pattern OBJECT_PREFIX = Pattern.compile(
            "^[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*$");

    private final ResumePhotoOssConfigMapper configMapper;
    private final ResumePhotoOssConfigAuditMapper auditMapper;
    private final AiProviderCryptoService cryptoService;
    private final ResumePhotoOssProperties properties;

    @Override
    @Transactional(readOnly = true)
    public ResumePhotoOssConfigViewDTO view() {
        return toView(requireRow());
    }

    @Override
    @Transactional
    public ResumePhotoOssConfigViewDTO update(Long adminUserId, ResumePhotoOssConfigUpdateDTO dto) {
        ResumePhotoOssConfig config = requireRow();
        var changedFields = new ArrayList<String>();
        boolean credentialsRotated = false;

        String endpoint = normalizeEndpoint(dto.getEndpoint());
        String bucket = normalize(dto.getBucket());
        String objectPrefix = StringUtils.hasText(dto.getObjectPrefix())
                ? normalizeObjectPrefix(dto.getObjectPrefix())
                : normalizeObjectPrefix(config.getObjectPrefix());
        validateEndpoint(endpoint);
        validateBucket(bucket);
        validateObjectPrefix(objectPrefix);
        if (!Objects.equals(config.getEndpoint(), endpoint)) {
            config.setEndpoint(endpoint);
            changedFields.add("endpoint");
        }
        if (!Objects.equals(config.getBucket(), bucket)) {
            config.setBucket(bucket);
            changedFields.add("bucket");
        }
        if (!Objects.equals(config.getObjectPrefix(), objectPrefix)) {
            config.setObjectPrefix(objectPrefix);
            changedFields.add("objectPrefix");
        }

        if (StringUtils.hasText(dto.getAccessKeyId())) {
            requireMasterKey();
            String value = validateSecret(dto.getAccessKeyId(), "AccessKey ID");
            config.setAccessKeyIdCipher(cryptoService.encrypt(value));
            config.setAccessKeyIdMask(AiProviderCryptoService.mask(value));
            changedFields.add("accessKeyId");
            credentialsRotated = true;
        }
        if (StringUtils.hasText(dto.getAccessKeySecret())) {
            requireMasterKey();
            String value = validateSecret(dto.getAccessKeySecret(), "AccessKey Secret");
            config.setAccessKeySecretCipher(cryptoService.encrypt(value));
            config.setAccessKeySecretMask(AiProviderCryptoService.mask(value));
            changedFields.add("accessKeySecret");
            credentialsRotated = true;
        }

        validateReady(config);
        config.setUpdatedBy(adminUserId);
        configMapper.updateById(config);
        auditMapper.insert(audit(adminUserId, "UPDATE", String.join(",", changedFields),
                credentialsRotated, "更新完成，变更字段 " + changedFields.size() + " 个"));
        return toView(config);
    }

    @Override
    public ResumePhotoOssTestResultDTO testConnection(Long adminUserId, ResumePhotoOssConfigUpdateDTO dto) {
        ActiveResumePhotoOssConfig active = resolveCandidate(dto);
        long start = System.currentTimeMillis();
        boolean success = false;
        String message;
        var oss = new OSSClientBuilder().build(active.endpoint(), active.accessKeyId(), active.accessKeySecret());
        try {
            String probeKey = active.objectPrefix() + "/resume-photo/staging/.admin-connection-test";
            oss.getObjectMetadata(active.bucket(), probeKey);
            success = true;
            message = "连接成功";
        } catch (OSSException exception) {
            if ("NoSuchKey".equals(exception.getErrorCode())
                    || "NoSuchObject".equals(exception.getErrorCode())) {
                success = true;
                message = "连接成功";
            } else {
                message = safeErrorCode(exception.getErrorCode());
            }
        } catch (ClientException exception) {
            message = "网络连接失败";
        } finally {
            oss.shutdown();
        }
        int latency = Math.toIntExact(Math.min(Integer.MAX_VALUE, System.currentTimeMillis() - start));
        auditMapper.insert(audit(adminUserId, "TEST", null, false,
                (success ? "成功" : "失败") + "，耗时 " + latency + "ms"));
        return new ResumePhotoOssTestResultDTO(success, latency, message);
    }

    @Override
    @Transactional(readOnly = true)
    public ActiveResumePhotoOssConfig resolveActive() {
        ResumePhotoOssConfig config = configMapper.selectById(ResumePhotoOssConfig.SINGLE_ROW_ID);
        if (config == null) throw unavailable();
        try {
            validateReady(config);
            return decrypt(config);
        } catch (BusinessException exception) {
            throw unavailable();
        }
    }

    private ActiveResumePhotoOssConfig resolveCandidate(ResumePhotoOssConfigUpdateDTO dto) {
        ResumePhotoOssConfig stored = requireRow();
        String endpoint = normalizeEndpoint(StringUtils.hasText(dto.getEndpoint())
                ? dto.getEndpoint() : stored.getEndpoint());
        String bucket = normalize(StringUtils.hasText(dto.getBucket())
                ? dto.getBucket() : stored.getBucket());
        String objectPrefix = normalizeObjectPrefix(StringUtils.hasText(dto.getObjectPrefix())
                ? dto.getObjectPrefix() : stored.getObjectPrefix());
        validateEndpoint(endpoint);
        validateBucket(bucket);
        validateObjectPrefix(objectPrefix);
        String accessKeyId = StringUtils.hasText(dto.getAccessKeyId())
                ? validateSecret(dto.getAccessKeyId(), "AccessKey ID")
                : decryptCredential(stored.getAccessKeyIdCipher());
        String accessKeySecret = StringUtils.hasText(dto.getAccessKeySecret())
                ? validateSecret(dto.getAccessKeySecret(), "AccessKey Secret")
                : decryptCredential(stored.getAccessKeySecretCipher());
        return new ActiveResumePhotoOssConfig(
                endpoint, bucket, objectPrefix, accessKeyId, accessKeySecret);
    }

    private ActiveResumePhotoOssConfig decrypt(ResumePhotoOssConfig config) {
        try {
            return new ActiveResumePhotoOssConfig(
                    config.getEndpoint(), config.getBucket(),
                    normalizeObjectPrefix(config.getObjectPrefix()),
                    cryptoService.decrypt(config.getAccessKeyIdCipher()),
                    cryptoService.decrypt(config.getAccessKeySecretCipher()));
        } catch (BusinessException exception) {
            throw unavailable();
        }
    }

    private void validateReady(ResumePhotoOssConfig config) {
        validateCore(config);
    }

    private void validateCore(ResumePhotoOssConfig config) {
        try {
            validateEndpoint(config.getEndpoint());
            validateBucket(config.getBucket());
            validateObjectPrefix(normalizeObjectPrefix(config.getObjectPrefix()));
        } catch (BusinessException exception) {
            throw exception;
        }
        if (config.getAccessKeyIdCipher() == null || config.getAccessKeySecretCipher() == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请先配置 OSS AccessKey");
        }
        requireMasterKey();
    }

    private void validateEndpoint(String value) {
        try {
            URI uri = URI.create(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !StringUtils.hasText(uri.getHost())
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || (StringUtils.hasText(uri.getPath()) && !"/".equals(uri.getPath()))) {
                throw new IllegalArgumentException();
            }
        } catch (RuntimeException exception) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "OSS Endpoint 格式不正确");
        }
    }

    private void validateBucket(String value) {
        if (!StringUtils.hasText(value) || !BUCKET.matcher(value).matches()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "OSS Bucket 名称不合法");
        }
    }

    private void validateObjectPrefix(String value) {
        if (!StringUtils.hasText(value) || value.length() > 128
                || !OBJECT_PREFIX.matcher(value).matches()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "OSS 目录前缀不合法");
        }
    }

    private String validateSecret(String value, String name) {
        String normalized = value == null ? "" : value.strip();
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (normalized.length() < 8 || lower.contains("replace-me") || lower.contains("example")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), name + " 不合法");
        }
        return normalized;
    }

    private void requireMasterKey() {
        if (!cryptoService.isAvailable()) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(),
                    "服务器未配置 AI_PROVIDER_MASTER_KEY，暂时无法保存或读取加密凭据");
        }
    }

    private ResumePhotoOssConfig requireRow() {
        ResumePhotoOssConfig config = configMapper.selectById(ResumePhotoOssConfig.SINGLE_ROW_ID);
        if (config == null) {
            throw new BusinessException(ResultCode.INTERNAL_ERROR.getCode(), "照片 OSS 配置行缺失");
        }
        return config;
    }

    private ResumePhotoOssConfigViewDTO toView(ResumePhotoOssConfig config) {
        var view = new ResumePhotoOssConfigViewDTO();
        view.setEndpoint(endpointForView(config.getEndpoint()));
        view.setBucket(config.getBucket());
        view.setObjectPrefix(normalizeObjectPrefix(config.getObjectPrefix()));
        view.setAccessKeyIdMask(config.getAccessKeyIdMask());
        view.setAccessKeySecretMask(config.getAccessKeySecretMask());
        view.setCredentialsConfigured(config.getAccessKeyIdCipher() != null
                && config.getAccessKeySecretCipher() != null);
        view.setMasterKeyConfigured(cryptoService.isAvailable());
        view.setUpdatedAt(config.getUpdatedAt());
        return view;
    }

    private ResumePhotoOssConfigAudit audit(Long adminUserId, String action, String changedFields,
                                             boolean credentialsRotated, String detail) {
        var audit = new ResumePhotoOssConfigAudit();
        audit.setAdminUserId(adminUserId);
        audit.setAction(action);
        audit.setChangedFields(changedFields);
        audit.setCredentialsRotated(credentialsRotated);
        audit.setDetail(detail);
        return audit;
    }

    private String normalize(String value) {
        return value == null ? "" : value.strip();
    }

    private String normalizeObjectPrefix(String value) {
        String normalized = normalize(value).replace('\\', '/');
        normalized = normalized.replaceAll("^/+|/+$", "");
        return normalized.replaceAll("/{2,}", "/");
    }

    private String normalizeEndpoint(String value) {
        String endpoint = normalize(value);
        if (endpoint.regionMatches(true, 0, "http://", 0, 7)) {
            endpoint = endpoint.substring(7);
        } else if (endpoint.regionMatches(true, 0, "https://", 0, 8)) {
            endpoint = endpoint.substring(8);
        } else if (endpoint.contains("://")) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "OSS Endpoint 格式不正确");
        }
        endpoint = endpoint.endsWith("/") ? endpoint.substring(0, endpoint.length() - 1) : endpoint;
        return "https://" + endpoint;
    }

    private String endpointForView(String value) {
        String endpoint = normalize(value);
        return endpoint.regionMatches(true, 0, "https://", 0, 8)
                ? endpoint.substring(8) : endpoint;
    }

    private String decryptCredential(byte[] cipher) {
        if (cipher == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "请填写 AK 和 SK");
        }
        requireMasterKey();
        try {
            return cryptoService.decrypt(cipher);
        } catch (BusinessException exception) {
            throw unavailable();
        }
    }

    private String safeErrorCode(String value) {
        return StringUtils.hasText(value) ? value.replaceAll("[^A-Za-z0-9_-]", "") : "OSSException";
    }

    private BusinessException unavailable() {
        return new BusinessException(ResultCode.RESUME_PHOTO_STORAGE_UNAVAILABLE);
    }
}
