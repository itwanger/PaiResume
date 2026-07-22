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

    private VerificationMailTemplate() {
    }

    static RenderedMail render(String code, int ttlSeconds, String publicUrl) {
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
                【派简历】邮箱注册验证码

                你好，

                你正在注册派简历账号，验证码是：

                %s

                验证码 %s内有效，请尽快完成验证。

                如非本人操作，请忽略此邮件。
                派简历不会向你索要验证码，请勿转发或泄露。

                访问派简历：%s
                """.formatted(code, validityText, normalizedPublicUrl);

        String htmlText = HTML_TEMPLATE
                .replace("{{VALIDITY}}", escapeHtml(validityText))
                .replace("{{CODE}}", escapeHtml(code))
                .replace("{{PUBLIC_URL}}", escapeHtml(normalizedPublicUrl))
                .replace("{{DISPLAY_HOST}}", escapeHtml(displayHost));

        return new RenderedMail(SUBJECT, plainText, htmlText);
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
              <title>派简历邮箱注册验证码</title>
            </head>
            <body style="margin:0;padding:0;background-color:#f4f7fb;color:#172554;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
              <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;line-height:1px;font-size:1px;">
                你的派简历注册验证码，{{VALIDITY}}内有效。
              </div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f4f7fb;">
                <tr>
                  <td align="center" style="padding:32px 12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:#ffffff;border:1px solid #e0ebff;border-radius:18px;overflow:hidden;box-shadow:0 12px 32px rgba(30,64,175,0.10);">
                      <tr>
                        <td style="height:6px;background-color:#3369e8;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                      <tr>
                        <td style="padding:34px 38px 12px 38px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" valign="middle" width="48" height="48" style="width:48px;height:48px;background-color:#1d4ed8;border-radius:14px;color:#ffffff;font-size:24px;font-weight:700;line-height:48px;">派</td>
                              <td style="padding-left:14px;">
                                <div style="font-size:21px;font-weight:700;line-height:28px;color:#172554;">派简历</div>
                                <div style="font-size:13px;line-height:20px;color:#64748b;">让每一份经历都被认真看见</div>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:18px 38px 0 38px;">
                          <h1 style="margin:0 0 12px 0;font-size:26px;line-height:36px;font-weight:700;color:#0f172a;">验证你的邮箱</h1>
                          <p style="margin:0;font-size:15px;line-height:26px;color:#475569;">你好，你正在注册派简历账号。请在注册页面输入下面的验证码：</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:26px 38px 8px 38px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f0f5ff;border:1px solid #bfd7ff;border-radius:14px;">
                            <tr>
                              <td align="center" style="padding:24px 16px 10px 16px;">
                                <div style="font-family:Menlo,Consolas,'Courier New',monospace;font-size:38px;line-height:48px;font-weight:700;letter-spacing:8px;color:#1e40af;white-space:nowrap;">{{CODE}}</div>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding:0 16px 22px 16px;font-size:13px;line-height:20px;color:#475569;">验证码 <strong style="color:#1e40af;">{{VALIDITY}}</strong>内有效</td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:18px 38px 0 38px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background-color:#f8fafc;border-left:4px solid #8fb8ff;border-radius:8px;">
                            <tr>
                              <td style="padding:14px 16px;font-size:13px;line-height:22px;color:#475569;">
                                <strong style="color:#334155;">安全提醒：</strong>派简历不会向你索要验证码，请勿转发或泄露。如非本人操作，请直接忽略此邮件。
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:26px 38px 8px 38px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" bgcolor="#1d4ed8" style="border-radius:10px;">
                                <a href="{{PUBLIC_URL}}" target="_blank" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:15px;font-weight:600;line-height:20px;text-decoration:none;border-radius:10px;">打开派简历</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:10px 38px 32px 38px;font-size:12px;line-height:20px;color:#94a3b8;word-break:break-all;">
                          按钮无法打开时，请访问<br>
                          <a href="{{PUBLIC_URL}}" target="_blank" style="color:#3369e8;text-decoration:none;">{{PUBLIC_URL}}</a>
                        </td>
                      </tr>
                      <tr>
                        <td align="center" style="padding:20px 24px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:20px;color:#94a3b8;">
                          此邮件由派简历系统自动发送，请勿直接回复。<br>
                          <a href="{{PUBLIC_URL}}" target="_blank" style="color:#64748b;text-decoration:none;">{{DISPLAY_HOST}}</a>
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
