package com.itwanger.pairesume.service.impl;

import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

final class PasswordResetMailTemplate {

    private static final Pattern SIX_DIGIT_CODE = Pattern.compile("\\d{6}");

    private PasswordResetMailTemplate() {
    }

    static RenderedMail render(String code, int ttlSeconds, String publicUrl) {
        if (code == null || !SIX_DIGIT_CODE.matcher(code).matches()) {
            throw new IllegalArgumentException("Password reset code must contain exactly six digits");
        }
        if (ttlSeconds <= 0) {
            throw new IllegalArgumentException("Password reset code TTL must be positive");
        }

        String normalizedUrl = normalizePublicUrl(publicUrl);
        String validity = ttlSeconds % 60 == 0 ? ttlSeconds / 60 + " 分钟" : ttlSeconds + " 秒";
        String plainText = """
                【派简历】重置密码验证码

                你正在重置派简历账号密码，验证码是：%s

                验证码 %s内有效。完成重置后，已登录设备会全部退出。
                如非本人操作，请忽略此邮件，不要向任何人提供验证码。

                访问派简历：%s
                """.formatted(code, validity, normalizedUrl);
        String htmlText = """
                <!doctype html>
                <html lang="zh-CN">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>派简历重置密码</title></head>
                <body style="margin:0;padding:32px 12px;background:#f4f7fb;color:#172554;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
                  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #dbeafe;border-radius:16px;padding:32px;">
                    <h1 style="margin:0 0 18px;font-size:24px;">重置派简历密码</h1>
                    <p style="line-height:1.8;color:#475569;">请在重置密码页面输入以下验证码：</p>
                    <div style="margin:24px 0;padding:20px;text-align:center;background:#eff6ff;border-radius:12px;font:700 36px Menlo,Consolas,monospace;letter-spacing:8px;color:#1d4ed8;">%s</div>
                    <p style="line-height:1.8;color:#475569;">验证码 %s内有效。完成重置后，已登录设备会全部退出。</p>
                    <p style="line-height:1.8;color:#64748b;">如非本人操作，请忽略此邮件，不要向任何人提供验证码。</p>
                    <a href="%s" style="color:#2563eb;">返回派简历</a>
                  </div>
                </body>
                </html>
                """.formatted(escape(code), escape(validity), escape(normalizedUrl));
        return new RenderedMail("【派简历】重置密码验证码", plainText, htmlText);
    }

    private static String normalizePublicUrl(String publicUrl) {
        if (!StringUtils.hasText(publicUrl)) {
            throw new IllegalArgumentException("Public URL must be configured");
        }
        try {
            URI uri = new URI(publicUrl.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || !StringUtils.hasText(uri.getHost())
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null) {
                throw new IllegalArgumentException("Public URL must be an absolute HTTPS URL");
            }
            String normalized = uri.normalize().toString();
            while (normalized.endsWith("/")) {
                normalized = normalized.substring(0, normalized.length() - 1);
            }
            return normalized;
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("Public URL must be a valid URI", exception);
        }
    }

    private static String escape(String value) {
        return HtmlUtils.htmlEscape(value, StandardCharsets.UTF_8.name());
    }

    record RenderedMail(String subject, String plainText, String htmlText) {
    }
}
