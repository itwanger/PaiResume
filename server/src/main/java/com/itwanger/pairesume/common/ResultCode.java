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
    VERIFY_CODE_ATTEMPTS_EXCEEDED(1006, "验证码尝试次数过多，请重新获取"),
    LOGIN_FAILED(2001, "邮箱或密码错误"),
    ACCOUNT_LOCKED(2003, "账号被锁定"),
    SEND_CODE_TOO_FREQUENT(1101, "验证码发送过于频繁，请稍后再试"),
    SEND_CODE_LIMIT_EXCEEDED(1102, "验证码发送次数已达上限，请稍后再试"),
    LOGIN_TOO_MANY_ATTEMPTS(1103, "登录尝试过于频繁，请稍后再试"),
    FORGOT_CODE_TOO_FREQUENT(4004, "请求过于频繁"),
    EMAIL_NOT_REGISTERED(4005, "邮箱未注册"),
    RESET_CODE_ERROR(4001, "验证码错误"),
    RESET_PASSWORD_RULE(4003, "密码不符合规则"),
    REFRESH_TOKEN_INVALID(6001, "Refresh Token 无效"),
    REFRESH_TOKEN_EXPIRED(6002, "Refresh Token 过期"),
    USER_NOT_FOUND(6003, "用户不存在"),
    MAIL_NOT_CONFIGURED(6004, "邮件服务未配置"),
    MAIL_SEND_FAILED(6005, "邮件发送失败"),

    // Resume: 3xxx
    RESUME_NOT_FOUND(3001, "简历不存在"),
    RESUME_LIMIT_REACHED(3002, "简历数量已达上限"),
    MODULE_NOT_FOUND(3003, "模块不存在"),
    MODULE_ALREADY_EXISTS(3004, "该模块只能添加一份"),
    MEMBERSHIP_REQUIRED(3005, "开通会员后才可导出简历"),
    EXPORT_FAILED(3006, "导出失败，请稍后重试"),

    // AI: 4xxx
    AI_NOT_CONFIGURED(4000, "AI 服务未配置，请检查服务端 AI 模型参数"),
    AI_SERVICE_BUSY(4001, "AI 服务繁忙，请稍后重试"),
    AI_INPUT_TOO_LONG(4002, "输入内容过长"),
    AI_RESPONSE_INVALID(4003, "AI 返回内容格式异常"),
    AI_MEMBERSHIP_REQUIRED(4006, "开通 VIP 后才可使用 AI 功能"),

    // Notification: 5xxx
    NOTIFICATION_NOT_FOUND(5001, "通知不存在或无权限"),
    NOTIFICATION_SETTINGS_ERROR(5002, "参数错误"),
    NOTIFICATION_SEND_ERROR(5003, "参数错误"),

    // Coupon / Platform: 7xxx
    COUPON_NOT_FOUND(7001, "优惠码不存在"),
    COUPON_INVALID(7002, "优惠码无效"),
    COUPON_ALREADY_USED(7003, "优惠码已使用"),
    SHOWCASE_NOT_FOUND(7004, "样例不存在"),
    FEEDBACK_NOT_FOUND(7005, "问卷记录不存在"),
    FEEDBACK_RATE_LIMITED(7006, "提交过于频繁，请稍后再试"),
    FEEDBACK_PUBLISH_NOT_ALLOWED(7007, "当前问卷不满足发布条件"),
    SHOWCASE_MEMBERSHIP_REQUIRED(7008, "开通会员后才可查看优质简历"),
    VIP_INVITE_NOT_FOUND(7009, "邀请码不存在"),
    VIP_INVITE_INVALID(7010, "邀请码已失效"),
    VIP_INVITE_ALREADY_USED(7011, "邀请码已被使用"),
    VIP_INVITE_EXPIRED(7012, "邀请码已过期"),
    MEMBERSHIP_ALREADY_ACTIVE(7013, "当前账号已经是 VIP"),
    VIP_INVITE_EXHAUSTED(7014, "邀请码名额已用完"),
    VIP_INVITE_USER_ALREADY_REDEEMED(7015, "当前账号已经领取过邀请码会员"),
    MEMBERSHIP_PERMANENT(7016, "当前账号已是永久 VIP，无需延期"),
    VIP_INVITE_RATE_LIMITED(7017, "邀请码尝试过于频繁，请稍后再试"),
    VIP_INVITE_REDEMPTION_ALREADY_REVOKED(7018, "该邀请码权益已撤销"),
    VIP_INVITE_REDEMPTION_NOT_FOUND(7019, "邀请码兑换记录不存在"),

    // Resume marketplace: 71xx
    MARKET_LISTING_NOT_FOUND(7101, "公开简历不存在"),
    MARKET_LISTING_NOT_PUBLISHED(7102, "该简历当前未公开"),
    MARKET_LISTING_SUSPENDED(7103, "该简历已被平台暂停展示"),
    MARKET_PRICE_INVALID(7104, "简历定价不符合规则"),
    MARKET_PUBLIC_CONSENT_REQUIRED(7105, "请确认已知悉简历公开后的隐私风险"),
    MARKET_ACCESS_REQUIRED(7106, "购买后才可查看这份简历"),

    // Marketplace payment: 72xx
    MARKET_ORDER_NOT_FOUND(7201, "支付订单不存在"),
    MARKET_ORDER_FORBIDDEN(7202, "无权查看该支付订单"),
    MARKET_ALREADY_UNLOCKED(7203, "这份简历已经解锁"),
    PAYMENT_NOT_ENABLED(7204, "在线支付暂未开启"),
    PAYMENT_ORDER_EXPIRED(7205, "支付订单已过期，请重新下单"),
    PAYMENT_NOTIFICATION_INVALID(7206, "支付通知校验失败"),
    PAYMENT_AMOUNT_MISMATCH(7207, "支付金额校验失败"),
    PAYMENT_REFUND_REFERENCE_CONFLICT(7208, "退款流水已用于其他订单"),

    // Creator earnings: 73xx
    CREATOR_EARNING_NOT_FOUND(7301, "收益记录不存在"),
    CREATOR_EARNING_ALREADY_SETTLED(7302, "该笔收益已经结算"),

    // Admin: 1xxx
    ADMIN_REQUIRED(1002, "没有管理员权限");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
