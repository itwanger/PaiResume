package com.itwanger.pairesume.service.impl;

import org.springframework.util.StringUtils;
import org.springframework.web.util.HtmlUtils;

import java.net.URI;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

final class VerificationMailTemplate {

    static final String SUBJECT = "【派简历】邮箱注册验证码";

    private static final Pattern SIX_DIGIT_CODE = Pattern.compile("\\d{6}");

    enum Purpose {
        REGISTER(SUBJECT, "验证注册邮箱", "你正在注册派简历账号。", ""),
        BIND_EMAIL("派简历绑定邮箱验证码", "验证登录邮箱", "你正在绑定派简历登录邮箱。", ""),
        REVIEW_CONTACT("派简历人工精修联系邮箱验证码", "验证人工精修联系邮箱", "你正在验证人工精修联系邮箱。", ""),
        RESET_PASSWORD("【派简历】重置密码验证码", "重置派简历密码", "你正在重置派简历账号密码。", "完成重置后，已登录设备会全部退出。");

        final String subject;
        final String title;
        final String description;
        final String consequence;

        Purpose(String subject, String title, String description, String consequence) {
            this.subject = subject;
            this.title = title;
            this.description = description;
            this.consequence = consequence;
        }
    }

    private VerificationMailTemplate() {
    }

    static RenderedMail render(String code, int ttlSeconds, String publicUrl) {
        return render(code, ttlSeconds, publicUrl, Purpose.REGISTER);
    }

    static RenderedMail render(String code, int ttlSeconds, String publicUrl, Purpose purpose) {
        if (code == null || !SIX_DIGIT_CODE.matcher(code).matches()) {
            throw new IllegalArgumentException("Verification code must contain exactly six digits");
        }
        if (ttlSeconds <= 0) {
            throw new IllegalArgumentException("Verification code TTL must be positive");
        }

        URI siteUri = parsePublicUrl(publicUrl);
        String normalizedPublicUrl = normalizePublicUrl(siteUri);
        String displayHost = siteUri.getHost().toLowerCase(Locale.ROOT);
        String validityText = formatValidity(ttlSeconds);

        String plainText = """
                %s

                %s验证码：

                %s

                %s内有效。
                %s
                如非本人操作，请忽略此邮件。
                派简历不会向你索要验证码，请勿转发或泄露。

                访问派简历：%s
                """.formatted(purpose.subject, purpose.description, code, validityText,
                purpose.consequence, normalizedPublicUrl);

        String htmlText = HTML_TEMPLATE
                .replace("{{TITLE}}", escapeHtml(purpose.title))
                .replace("{{DESCRIPTION}}", escapeHtml(purpose.description))
                .replace("{{CONSEQUENCE}}", purpose.consequence.isEmpty() ? ""
                        : "<p style=\"margin:16px 0;color:#475569;font-size:14px;line-height:24px;\">"
                        + escapeHtml(purpose.consequence) + "</p>")
                .replace("{{VALIDITY}}", escapeHtml(validityText))
                .replace("{{CODE}}", escapeHtml(code))
                .replace("{{PUBLIC_URL}}", escapeHtml(normalizedPublicUrl))
                .replace("{{DISPLAY_HOST}}", escapeHtml(displayHost));

        return new RenderedMail(purpose.subject, plainText, htmlText);
    }

    private static URI parsePublicUrl(String publicUrl) {
        if (!StringUtils.hasText(publicUrl)) {
            throw new IllegalArgumentException("Public URL must be configured");
        }
        try {
            URI uri = new URI(publicUrl.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || !StringUtils.hasText(uri.getHost())
                    || uri.getUserInfo() != null
                    || uri.getQuery() != null
                    || uri.getFragment() != null) {
                throw new IllegalArgumentException("Public URL must be an absolute HTTPS URL");
            }
            return uri;
        } catch (URISyntaxException exception) {
            throw new IllegalArgumentException("Public URL must be a valid URI", exception);
        }
    }

    private static String normalizePublicUrl(URI publicUrl) {
        String normalized = publicUrl.normalize().toString();
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private static String formatValidity(int ttlSeconds) {
        if (ttlSeconds % 60 == 0) {
            return ttlSeconds / 60 + " 分钟";
        }
        return ttlSeconds + " 秒";
    }

    private static String escapeHtml(String value) {
        return HtmlUtils.htmlEscape(value, StandardCharsets.UTF_8.name());
    }

    record RenderedMail(String subject, String plainText, String htmlText) {
    }

    private static final String HTML_TEMPLATE = """
            <!doctype html>
            <html lang="zh-CN">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>{{TITLE}}</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f4f7fb;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding:32px 12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:#ffffff;border-radius:12px;">
                      <tr>
                        <td style="padding:32px 24px;">
                          <p style="margin:0 0 24px;color:#1d4ed8;font-size:18px;font-weight:700;">派简历</p>
                          <h1 style="margin:0 0 12px;font-size:24px;line-height:34px;">{{TITLE}}</h1>
                          <p style="margin:0;color:#475569;font-size:15px;line-height:26px;">{{DESCRIPTION}}</p>
                          <div style="margin:28px 0 12px;text-align:center;font-family:Menlo,Consolas,'Courier New',monospace;font-size:40px;line-height:56px;font-weight:700;letter-spacing:6px;color:#1d4ed8;white-space:nowrap;">{{CODE}}</div>
                          <p style="margin:0 0 28px;text-align:center;color:#64748b;font-size:14px;line-height:24px;">{{VALIDITY}}内有效</p>
                          {{CONSEQUENCE}}
                          <p style="margin:0;padding-top:20px;border-top:1px solid #e2e8f0;color:#64748b;font-size:13px;line-height:24px;"><strong>安全提醒：</strong>请勿转发或泄露验证码。如非本人操作，请忽略此邮件。</p>
                          <p style="margin:20px 0 0;color:#94a3b8;font-size:12px;line-height:20px;">派简历不会向你索要验证码。<br><a href="{{PUBLIC_URL}}" style="color:#64748b;text-decoration:none;">{{DISPLAY_HOST}}</a></p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
}
