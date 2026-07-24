-- 关注奖励流程已下线。保留历史表和已发生记录，仅让尚未使用的凭证失效。
UPDATE `resume_review_follow_challenge`
SET `challenge_status` = 'EXPIRED',
    `active_user_key` = NULL,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `challenge_status` = 'ACTIVE';

UPDATE `resume_review_follow_fallback_code`
SET `code_status` = 'REVOKED'
WHERE `code_status` = 'ISSUED';

ALTER TABLE `platform_config`
    MODIFY COLUMN `resume_review_price_cents` INT NOT NULL DEFAULT 0
        COMMENT '第二次及以后人工精修单次价格（分）';
