ALTER TABLE `platform_config`
    MODIFY COLUMN `resume_review_price_cents` INT NOT NULL DEFAULT 0
        COMMENT '人工精修单次价格（分）';

ALTER TABLE `resume_review_request`
    MODIFY COLUMN `entitlement_type` VARCHAR(24) NOT NULL
        COMMENT '历史 WELCOME_FREE/FOLLOW_REWARD 或当前 PAID';

ALTER TABLE `resume_review_credit_ledger`
    MODIFY COLUMN `credit_type` VARCHAR(24) NOT NULL
        COMMENT '历史 WELCOME_FREE/FOLLOW_REWARD 或当前 PAID';
