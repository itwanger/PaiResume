package com.itwanger.pairesume.common;

import lombok.Getter;

@Getter
public enum ResultCode {
    SUCCESS(200, "success"),
    BAD_REQUEST(400, "请求参数错误"),
    UNAUTHORIZED(401, "未授权"),
    FORBIDDEN(403, "无权限"),
    NOT_FOUND(404, "资源不存在"),
    INTERNAL_ERROR(500, "服务器内部错误"),

    // Auth: 1xxx
    EMAIL_EXISTS(1001, "邮箱已注册"),
    EMAIL_FORMAT_ERROR(1002, "邮箱格式错误"),
    PASSWORD_RULE_ERROR(1003, "密码不符合规则"),
    VERIFY_CODE_ERROR(1004, "验证码错误或已过期"),
    VERIFY_CODE_EXPIRED(1005, "验证码已过期"),
    LOGIN_FAILED(2001, "邮箱或密码错误"),
    ACCOUNT_LOCKED(2003, "账号被锁定"),
    SEND_CODE_TOO_FREQUENT(3001, "请求过于频繁"),
    FORGOT_CODE_TOO_FREQUENT(4004, "请求过于频繁"),
    EMAIL_NOT_REGISTERED(4005, "邮箱未注册"),
    RESET_CODE_ERROR(4001, "验证码错误"),
    RESET_PASSWORD_RULE(4003, "密码不符合规则"),
    REFRESH_TOKEN_INVALID(6001, "Refresh Token 无效"),
    REFRESH_TOKEN_EXPIRED(6002, "Refresh Token 过期"),

    // Resume: 3xxx
    RESUME_NOT_FOUND(3001, "简历不存在"),
    RESUME_LIMIT_REACHED(3002, "简历数量已达上限"),
    MODULE_NOT_FOUND(3003, "模块不存在"),
    MODULE_ALREADY_EXISTS(3004, "该模块只能添加一份"),

    // AI: 4xxx
    AI_NOT_CONFIGURED(4000, "AI 服务未配置，请检查服务端 AI 模型参数"),
    AI_SERVICE_BUSY(4001, "AI 服务繁忙，请稍后重试"),
    AI_INPUT_TOO_LONG(4002, "输入内容过长"),
    AI_RESPONSE_INVALID(4003, "AI 返回内容格式异常"),

    // Notification: 5xxx
    NOTIFICATION_NOT_FOUND(5001, "通知不存在或无权限"),
    NOTIFICATION_SETTINGS_ERROR(5002, "参数错误"),
    NOTIFICATION_SEND_ERROR(5003, "参数错误"),

    // Admin: 1xxx
    ADMIN_REQUIRED(1002, "没有管理员权限");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
