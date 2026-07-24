package com.itwanger.pairesume.security;

import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.entity.ResumeModule;

import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Server-side trust boundary for resume photos.
 *
 * <p>The browser may preview remote images, but persisted resume data and
 * server-side publication paths must never dereference user-controlled URLs or
 * file paths. Only small, embedded raster images with a matching file signature
 * are accepted.</p>
 */
public final class ResumePhotoSecurityPolicy {
    public static final int MAX_PHOTO_BYTES = 3 * 1024 * 1024;
    public static final int MAX_IMAGE_DIMENSION = 4096;
    public static final long MAX_IMAGE_PIXELS = 16_000_000L;

    private static final int MAX_BASE64_CHARACTERS = ((MAX_PHOTO_BYTES + 2) / 3) * 4;
    private static final Pattern RASTER_DATA_URL = Pattern.compile(
            "^data:(image/(?:png|jpeg));base64,([A-Za-z0-9+/]*={0,2})$",
            Pattern.CASE_INSENSITIVE
    );

    private ResumePhotoSecurityPolicy() {
    }

    public static void validateModuleContent(String moduleType, Map<String, Object> content) {
        if (!"basic_info".equals(moduleType) || content == null || !content.containsKey("photo")) {
            return;
        }
        Object photo = content.get("photo");
        if (photo == null || photo instanceof String value && value.isBlank()) {
            return;
        }
        if (!isSafeRasterDataUrl(photo)) {
            throw new BusinessException(
                    ResultCode.BAD_REQUEST.getCode(),
                    "照片仅支持不超过 3MB、单边不超过 4096 像素且总像素不超过 1600 万的 PNG 或 JPEG 本地上传图片"
            );
        }
    }

    public static void validateModulesForExport(List<ResumeModule> modules) {
        if (modules == null) {
            return;
        }
        modules.forEach(module -> {
            if (module != null) {
                validateModuleContent(module.getModuleType(), module.getContent());
            }
        });
    }

    public static boolean isSafeRasterDataUrl(Object value) {
        if (!(value instanceof String text)) {
            return false;
        }
        var matcher = RASTER_DATA_URL.matcher(text.trim());
        if (!matcher.matches()) {
            return false;
        }

        String encoded = matcher.group(2);
        if (encoded.isEmpty() || encoded.length() > MAX_BASE64_CHARACTERS) {
            return false;
        }

        byte[] decoded;
        try {
            decoded = Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException exception) {
            return false;
        }
        if (decoded.length == 0 || decoded.length > MAX_PHOTO_BYTES) {
            return false;
        }

        ImageDimensions dimensions = readDimensions(
                matcher.group(1).toLowerCase(Locale.ROOT),
                decoded
        );
        return dimensions != null
                && dimensions.width() > 0
                && dimensions.height() > 0
                && dimensions.width() <= MAX_IMAGE_DIMENSION
                && dimensions.height() <= MAX_IMAGE_DIMENSION
                && dimensions.width() * dimensions.height() <= MAX_IMAGE_PIXELS;
    }

    private static ImageDimensions readDimensions(String mimeType, byte[] bytes) {
        return switch (mimeType) {
            case "image/png" -> readPngDimensions(bytes);
            case "image/jpeg" -> readJpegDimensions(bytes);
            default -> null;
        };
    }

    private static ImageDimensions readPngDimensions(byte[] bytes) {
        if (bytes.length < 24
                || unsigned(bytes[0]) != 0x89
                || bytes[1] != 'P'
                || bytes[2] != 'N'
                || bytes[3] != 'G'
                || unsigned(bytes[4]) != 0x0D
                || unsigned(bytes[5]) != 0x0A
                || unsigned(bytes[6]) != 0x1A
                || unsigned(bytes[7]) != 0x0A
                || bytes[12] != 'I'
                || bytes[13] != 'H'
                || bytes[14] != 'D'
                || bytes[15] != 'R') {
            return null;
        }
        return new ImageDimensions(readUnsignedInt32BigEndian(bytes, 16), readUnsignedInt32BigEndian(bytes, 20));
    }

    private static ImageDimensions readJpegDimensions(byte[] bytes) {
        if (bytes.length < 4
                || unsigned(bytes[0]) != 0xFF
                || unsigned(bytes[1]) != 0xD8
                || unsigned(bytes[2]) != 0xFF) {
            return null;
        }

        int offset = 2;
        while (offset < bytes.length) {
            while (offset < bytes.length && unsigned(bytes[offset]) != 0xFF) {
                offset++;
            }
            while (offset < bytes.length && unsigned(bytes[offset]) == 0xFF) {
                offset++;
            }
            if (offset >= bytes.length) {
                return null;
            }

            int marker = unsigned(bytes[offset++]);
            if (marker == 0xD9 || marker == 0xDA) {
                return null;
            }
            if (marker == 0x01 || marker == 0xD8 || marker >= 0xD0 && marker <= 0xD7) {
                continue;
            }
            if (offset + 2 > bytes.length) {
                return null;
            }

            int segmentLength = readUnsignedInt16BigEndian(bytes, offset);
            if (segmentLength < 2 || offset + segmentLength > bytes.length) {
                return null;
            }
            if (isStartOfFrameMarker(marker)) {
                if (segmentLength < 7) {
                    return null;
                }
                long height = readUnsignedInt16BigEndian(bytes, offset + 3);
                long width = readUnsignedInt16BigEndian(bytes, offset + 5);
                return new ImageDimensions(width, height);
            }
            offset += segmentLength;
        }
        return null;
    }

    private static boolean isStartOfFrameMarker(int marker) {
        return marker >= 0xC0 && marker <= 0xCF
                && marker != 0xC4
                && marker != 0xC8
                && marker != 0xCC;
    }

    private static int readUnsignedInt16BigEndian(byte[] bytes, int offset) {
        return unsigned(bytes[offset]) << 8 | unsigned(bytes[offset + 1]);
    }

    private static long readUnsignedInt32BigEndian(byte[] bytes, int offset) {
        return (long) unsigned(bytes[offset]) << 24
                | (long) unsigned(bytes[offset + 1]) << 16
                | (long) unsigned(bytes[offset + 2]) << 8
                | unsigned(bytes[offset + 3]);
    }

    private static int unsigned(byte value) {
        return Byte.toUnsignedInt(value);
    }

    private record ImageDimensions(long width, long height) {
    }
}
