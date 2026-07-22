ALTER TABLE `creator_wallet`
    ADD COLUMN `held_balance_cents` BIGINT NOT NULL DEFAULT 0 COMMENT '退款观察期内冻结余额，单位分' AFTER `user_id`,
    ADD COLUMN `debt_balance_cents` BIGINT NOT NULL DEFAULT 0 COMMENT '已打款收益退款形成的待抵扣欠款，单位分' AFTER `available_balance_cents`,
    ADD COLUMN `lifetime_refunded_cents` BIGINT NOT NULL DEFAULT 0 COMMENT '累计已冲销作者净收益，单位分' AFTER `lifetime_earned_cents`;

ALTER TABLE `creator_earning`
    ADD COLUMN `wallet_credit_cents` INT NULL COMMENT '扣除历史退款欠款后实际进入钱包的金额，单位分' AFTER `net_amount_cents`,
    ADD COLUMN `debt_offset_cents` INT NOT NULL DEFAULT 0 COMMENT '本笔收益抵扣历史退款欠款的金额，单位分' AFTER `wallet_credit_cents`,
    ADD COLUMN `reversed_from_status` VARCHAR(24) NULL COMMENT '退款冲销前收益状态' AFTER `reversed_at`,
    ADD COLUMN `reversal_reason` VARCHAR(255) NULL COMMENT '退款冲销原因' AFTER `reversed_from_status`;

UPDATE `creator_earning`
SET `wallet_credit_cents` = `net_amount_cents`
WHERE `wallet_credit_cents` IS NULL;

ALTER TABLE `creator_earning`
    MODIFY COLUMN `wallet_credit_cents` INT NOT NULL COMMENT '扣除历史退款欠款后实际进入钱包的金额，单位分',
    MODIFY COLUMN `earning_status` VARCHAR(24) NOT NULL DEFAULT 'HOLDING'
        COMMENT '收益状态: HOLDING/AVAILABLE/PENDING_SETTLEMENT/SETTLED/REVERSED',
    ADD KEY `idx_creator_earning_hold_release` (`earning_status`, `available_at`, `id`);
