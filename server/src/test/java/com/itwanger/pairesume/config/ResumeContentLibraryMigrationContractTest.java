package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumeContentLibraryMigrationContractTest {
    @Test
    void v26SeparatesPrivateFactsOfficialReferencesTemplatesAndUsage() throws Exception {
        var resource = new ClassPathResource("db/migration/V26__create_resume_content_library.sql");
        String sql;
        try (var input = resource.getInputStream()) {
            sql = new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }

        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS `user_resume_profile`"));
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS `user_resume_material`"));
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS `official_resume_material`"));
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS `resume_content_template`"));
        assertTrue(sql.contains("CREATE TABLE IF NOT EXISTS `resume_material_usage`"));
        assertTrue(sql.contains("与 resume_module 一致的内容 JSON"));
        assertTrue(sql.contains("模块快照数组，不与官方素材实时关联"));
        assertTrue(sql.contains("DRAFT/PUBLISHED/ARCHIVED"));
    }
}
