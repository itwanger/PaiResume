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

        String endpoint = normalize(dto.getEndpoint());
        String bucket = normalize(dto.getBucket());
        if (StringUtils.hasText(endpoint)) validateEndpoint(endpoint);
        if (StringUtils.hasText(bucket)) validateBucket(bucket);
        if (!Objects.equals(config.getEndpoint(), endpoint)) {
            config.setEndpoint(endpoint);
            changedFields.add("endpoint");
        }
        if (!Objects.equals(config.getBucket(), bucket)) {
            config.setBucket(bucket);
            changedFields.add("bucket");
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

        changed(config.getPrivateBucketConfirmed(), dto.isPrivateBucketConfirmed(),
                config::setPrivateBucketConfirmed, "privateBucketConfirmed", changedFields);
        changed(config.getCorsConfirmed(), dto.isCorsConfirmed(),
                config::setCorsConfirmed, "corsConfirmed", changedFields);
        changed(config.getStagingLifecycleConfirmed(), dto.isStagingLifecycleConfirmed(),
                config::setStagingLifecycleConfirmed, "stagingLifecycleConfirmed", changedFields);
        changed(config.getRamPolicyConfirmed(), dto.isRamPolicyConfirmed(),
                config::setRamPolicyConfirmed, "ramPolicyConfirmed", changedFields);
        changed(config.getEnabled(), dto.isEnabled(), config::setEnabled, "enabled", changedFields);

        if (dto.isEnabled()) validateReady(config);
        config.setUpdatedBy(adminUserId);
        configMapper.updateById(config);
        auditMapper.insert(audit(adminUserId, "UPDATE", String.join(",", changedFields),
                credentialsRotated, "更新完成，变更字段 " + changedFields.size() + " 个"));
        return toView(config);
    }

    @Override
    public ResumePhotoOssTestResultDTO testConnection(Long adminUserId) {
        ActiveResumePhotoOssConfig active = resolveConfigured();
        long start = System.currentTimeMillis();
        boolean success = false;
        String message;
        var oss = new OSSClientBuilder().build(active.endpoint(), active.accessKeyId(), active.accessKeySecret());
        try {
            String probeKey = properties.getStagingPrefix() + ".admin-connection-test";
            oss.getObjectMetadata(active.bucket(), probeKey);
            success = true;
            message = "连接成功";
        } catch (OSSException exception) {
            if ("NoSuchKey".equals(exception.getErrorCode())
                    || "NoSuchObject".equals(exception.getErrorCode())) {
                success = true;
                message = "连接成功";
            } else {
                message = "连接失败：" + safeErrorCode(exception.getErrorCode());
            }
        } catch (ClientException exception) {
            message = "连接失败：ClientException";
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
        if (config == null || !Boolean.TRUE.equals(config.getEnabled())) throw unavailable();
        validateReady(config);
        return decrypt(config);
    }

    private ActiveResumePhotoOssConfig resolveConfigured() {
        ResumePhotoOssConfig config = requireRow();
        validateCore(config);
        return decrypt(config);
    }

    private ActiveResumePhotoOssConfig decrypt(ResumePhotoOssConfig config) {
        try {
            return new ActiveResumePhotoOssConfig(
                    config.getEndpoint(), config.getBucket(),
                    cryptoService.decrypt(config.getAccessKeyIdCipher()),
                    cryptoService.decrypt(config.getAccessKeySecretCipher()));
        } catch (BusinessException exception) {
            throw unavailable();
        }
    }

    private void validateReady(ResumePhotoOssConfig config) {
        validateCore(config);
        if (!Boolean.TRUE.equals(config.getPrivateBucketConfirmed())
                || !Boolean.TRUE.equals(config.getCorsConfirmed())
                || !Boolean.TRUE.equals(config.getStagingLifecycleConfirmed())
                || !Boolean.TRUE.equals(config.getRamPolicyConfirmed())) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "启用前必须确认私有 Bucket、CORS、生命周期和 RAM 最小权限");
        }
    }

    private void validateCore(ResumePhotoOssConfig config) {
        try {
            validateEndpoint(config.getEndpoint());
            validateBucket(config.getBucket());
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
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(),
                    "OSS Endpoint 必须是无路径的 HTTPS 地址");
        }
    }

    private void validateBucket(String value) {
        if (!StringUtils.hasText(value) || !BUCKET.matcher(value).matches()) {
            throw new BusinessException(ResultCode.BAD_REQUEST.getCode(), "OSS Bucket 名称不合法");
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
        view.setEndpoint(config.getEndpoint());
        view.setBucket(config.getBucket());
        view.setAccessKeyIdMask(config.getAccessKeyIdMask());
        view.setAccessKeySecretMask(config.getAccessKeySecretMask());
        view.setCredentialsConfigured(config.getAccessKeyIdCipher() != null
                && config.getAccessKeySecretCipher() != null);
        view.setPrivateBucketConfirmed(Boolean.TRUE.equals(config.getPrivateBucketConfirmed()));
        view.setCorsConfirmed(Boolean.TRUE.equals(config.getCorsConfirmed()));
        view.setStagingLifecycleConfirmed(Boolean.TRUE.equals(config.getStagingLifecycleConfirmed()));
        view.setRamPolicyConfirmed(Boolean.TRUE.equals(config.getRamPolicyConfirmed()));
        view.setEnabled(Boolean.TRUE.equals(config.getEnabled()));
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

    private void changed(Boolean before, boolean after, java.util.function.Consumer<Boolean> setter,
                         String field, ArrayList<String> changedFields) {
        if (Boolean.TRUE.equals(before) != after) {
            setter.accept(after);
            changedFields.add(field);
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.strip();
    }

    private String safeErrorCode(String value) {
        return StringUtils.hasText(value) ? value.replaceAll("[^A-Za-z0-9_-]", "") : "OSSException";
    }

    private BusinessException unavailable() {
        return new BusinessException(ResultCode.RESUME_PHOTO_STORAGE_UNAVAILABLE);
    }
}
