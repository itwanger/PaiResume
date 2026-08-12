package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumePhotoMigrationContractTest {
    @Test
    void v27StoresOnlyPrivateOssAssetMetadata() throws Exception {
        var resource = new ClassPathResource("db/migration/V27__create_resume_photo_asset.sql");
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
        assertTrue(sql.contains("CREATE TABLE `resume_photo`"));
        assertTrue(sql.contains("`staging_object_key`"));
        assertTrue(sql.contains("`object_key`"));
        assertTrue(sql.contains("`content_type`"));
        assertTrue(sql.contains("`sha256` CHAR(64)"));
        assertTrue(sql.contains("`width` INT"));
        assertTrue(sql.contains("`height` INT"));
        assertTrue(sql.contains("FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)"));
    }
}
