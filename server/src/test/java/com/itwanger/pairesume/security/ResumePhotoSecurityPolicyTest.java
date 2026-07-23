package com.itwanger.pairesume.security;

import com.itwanger.pairesume.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.Base64;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumePhotoSecurityPolicyTest {
    private static final String ONE_PIXEL_PNG =
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwC"
                    + "AAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    private static final String ONE_PIXEL_JPEG =
            "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcg"
                    + "LikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09P"
                    + "T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAABAAEDASIA"
                    + "AhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAA"
                    + "AAAAAAAAAAAAAf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKQAQ//Z";

    @Test
    void acceptsSmallEmbeddedRasterImage() {
        assertTrue(ResumePhotoSecurityPolicy.isSafeRasterDataUrl(ONE_PIXEL_PNG));
        assertTrue(ResumePhotoSecurityPolicy.isSafeRasterDataUrl(ONE_PIXEL_JPEG));
        assertDoesNotThrow(() -> ResumePhotoSecurityPolicy.validateModuleContent(
                "basic_info", Map.of("photo", ONE_PIXEL_PNG)));
    }

    @Test
    void rejectsLocalhostPhotoUrl() {
        assertRejected("http://127.0.0.1:8080/internal.png");
        assertRejected("http://localhost:8080/internal.png");
    }

    @Test
    void rejectsAbsoluteFilePath() {
        assertRejected("/etc/private-image.png");
        assertRejected("file:///etc/private-image.png");
    }

    @Test
    void rejectsOversizedDataUrlBeforeExport() {
        byte[] oversized = new byte[ResumePhotoSecurityPolicy.MAX_PHOTO_BYTES + 1];
        oversized[0] = (byte) 0x89;
        oversized[1] = 'P';
        oversized[2] = 'N';
        oversized[3] = 'G';
        oversized[4] = 0x0D;
        oversized[5] = 0x0A;
        oversized[6] = 0x1A;
        oversized[7] = 0x0A;
        String dataUrl = "data:image/png;base64," + Base64.getEncoder().encodeToString(oversized);

        assertRejected(dataUrl);
    }

    @Test
    void rejectsMimeTypeSpoofingAndNonRasterData() {
        assertFalse(ResumePhotoSecurityPolicy.isSafeRasterDataUrl(
                "data:image/png;base64," + Base64.getEncoder().encodeToString("not-a-png".getBytes())));
        assertRejected("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=");
        assertRejected("data:image/webp;base64,UklGRgAAAABXRUJQ");
    }

    @Test
    void rejectsSmallPngThatDeclaresADecompressionBombCanvas() {
        byte[] forged = Base64.getDecoder().decode(ONE_PIXEL_PNG.substring(ONE_PIXEL_PNG.indexOf(',') + 1));
        writeUnsignedInt32BigEndian(forged, 16, ResumePhotoSecurityPolicy.MAX_IMAGE_DIMENSION);
        writeUnsignedInt32BigEndian(forged, 20, ResumePhotoSecurityPolicy.MAX_IMAGE_DIMENSION);

        assertRejected("data:image/png;base64," + Base64.getEncoder().encodeToString(forged));
    }

    private void assertRejected(String photo) {
        assertFalse(ResumePhotoSecurityPolicy.isSafeRasterDataUrl(photo));
        assertThrows(BusinessException.class, () -> ResumePhotoSecurityPolicy.validateModuleContent(
                "basic_info", Map.of("photo", photo)));
    }

    private void writeUnsignedInt32BigEndian(byte[] bytes, int offset, int value) {
        bytes[offset] = (byte) (value >>> 24);
        bytes[offset + 1] = (byte) (value >>> 16);
        bytes[offset + 2] = (byte) (value >>> 8);
        bytes[offset + 3] = (byte) value;
    }
}
