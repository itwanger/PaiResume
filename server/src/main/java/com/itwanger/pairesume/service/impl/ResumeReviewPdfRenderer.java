package com.itwanger.pairesume.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.ResumeModule;
import com.itwanger.pairesume.security.ResumePhotoSecurityPolicy;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class ResumeReviewPdfRenderer {
    private final ObjectMapper objectMapper;

    @Value("${app.project-root:}")
    private String configuredProjectRoot;

    public byte[] render(String immutableSnapshotJson) {
        Path output = null;
        Path diagnostics = null;
        try {
            JsonNode snapshot = objectMapper.readTree(immutableSnapshotJson);
            List<ResumeModule> modules = objectMapper.convertValue(
                    snapshot.path("modules"), new TypeReference<>() {});
            ResumePhotoSecurityPolicy.validateModulesForExport(modules);

            Path root = resolveProjectRoot();
            Path script = root.resolve("scripts/export-resume-pdf.ts");
            Path tsx = root.resolve("node_modules/.bin/tsx");
            if (!Files.isRegularFile(script) || !Files.isExecutable(tsx)) {
                throw new BusinessException(ResultCode.EXPORT_FAILED.getCode(), "服务端 PDF 渲染器未准备好");
            }
            output = Files.createTempFile("pai-resume-review-", ".pdf");
            diagnostics = Files.createTempFile("pai-resume-review-worker-", ".log");
            ProcessBuilder builder = new ProcessBuilder(tsx.toString(), script.toString(),
                    "--output", output.toString());
            builder.directory(root.toFile());
            builder.redirectErrorStream(true);
            builder.redirectOutput(diagnostics.toFile());
            Process process = builder.start();
            try (OutputStream stdin = process.getOutputStream()) {
                stdin.write(immutableSnapshotJson.getBytes(StandardCharsets.UTF_8));
            }
            boolean finished = process.waitFor(2, TimeUnit.MINUTES);
            if (!finished) {
                process.destroyForcibly();
                process.waitFor(10, TimeUnit.SECONDS);
                throw new BusinessException(ResultCode.EXPORT_FAILED.getCode(), "PDF 渲染超时");
            }
            if (process.exitValue() != 0) {
                log.error("Resume review PDF worker failed exitCode={}, outputLength={}",
                        process.exitValue(), Files.size(diagnostics));
                throw new BusinessException(ResultCode.EXPORT_FAILED);
            }
            long size = Files.size(output);
            if (size < 5 || size > 20L * 1024L * 1024L) {
                throw new BusinessException(ResultCode.EXPORT_FAILED.getCode(), "PDF 产物大小异常");
            }
            byte[] content = Files.readAllBytes(output);
            if (content[0] != '%' || content[1] != 'P' || content[2] != 'D'
                    || content[3] != 'F' || content[4] != '-') {
                throw new BusinessException(ResultCode.EXPORT_FAILED.getCode(), "PDF 产物格式异常");
            }
            return content;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            log.error("Resume review PDF render failed errorType={}", exception.getClass().getSimpleName());
            throw new BusinessException(ResultCode.EXPORT_FAILED);
        } finally {
            if (output != null) {
                try {
                    Files.deleteIfExists(output);
                } catch (Exception exception) {
                    log.warn("Resume review PDF temp cleanup failed errorType={}",
                            exception.getClass().getSimpleName());
                }
            }
            if (diagnostics != null) {
                try {
                    Files.deleteIfExists(diagnostics);
                } catch (Exception exception) {
                    log.warn("Resume review worker diagnostics cleanup failed errorType={}",
                            exception.getClass().getSimpleName());
                }
            }
        }
    }

    private Path resolveProjectRoot() {
        if (configuredProjectRoot != null && !configuredProjectRoot.isBlank()) {
            return Paths.get(configuredProjectRoot).toAbsolutePath().normalize();
        }
        Path current = Paths.get(System.getProperty("user.dir")).toAbsolutePath().normalize();
        return current.getFileName() != null && "server".equals(current.getFileName().toString())
                ? current.getParent() : current;
    }
}
