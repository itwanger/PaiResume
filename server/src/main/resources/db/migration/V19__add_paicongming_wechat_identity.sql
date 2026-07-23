ALTER TABLE `user`
    MODIFY COLUMN `email` VARCHAR(128) NULL COMMENT '邮箱登录账号；纯微信扫码账号为空',
    MODIFY COLUMN `password` VARCHAR(255) NULL COMMENT '兼容密码摘要；纯微信扫码账号为空';

ALTER TABLE `user_auth_identity`
    ADD COLUMN `subscribed` TINYINT NOT NULL DEFAULT 0 COMMENT '派聪明服务号当前关注状态' AFTER `last_login_at`,
    ADD COLUMN `subscribed_at` DATETIME NULL COMMENT '最近一次可信关注或扫码确认时间' AFTER `subscribed`,
    ADD COLUMN `unsubscribed_at` DATETIME NULL COMMENT '最近一次可信取消关注时间' AFTER `subscribed_at`,
    ADD COLUMN `subscription_updated_at` DATETIME NULL COMMENT '关注状态最近可信更新时间' AFTER `unsubscribed_at`;
