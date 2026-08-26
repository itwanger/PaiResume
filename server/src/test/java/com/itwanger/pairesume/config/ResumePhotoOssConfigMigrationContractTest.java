package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumePhotoOssConfigMigrationContractTest {
    @Test
    void v35StoresEncryptedCredentialsAndAuditWithoutPlaintextColumns() throws Exception {
        var resource = new ClassPathResource("db/migration/V35__create_resume_photo_oss_config.sql");
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS `resume_photo_oss_config`"));
        assertTrue(sql.contains("`access_key_id_cipher` BLOB"));
        assertTrue(sql.contains("`access_key_secret_cipher` BLOB"));
        assertTrue(sql.contains("`enabled` TINYINT NOT NULL DEFAULT 0"));
        assertTrue(sql.contains("resume_photo_oss_config_audit"));
        assertFalse(sql.contains("`access_key_secret` VARCHAR"));
    }

    @Test
    void v40AddsIsolatedPhotoObjectPrefixWithPaiResumeDefault() throws Exception {
        var resource = new ClassPathResource(
                "db/migration/V40__add_resume_photo_oss_object_prefix.sql");
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertTrue(sql.contains("`object_prefix` VARCHAR(128) NOT NULL DEFAULT 'pairesume'"));
    }
}
