ALTER TABLE `resume_review_request`
    ADD COLUMN `base_price_cents` INT NOT NULL DEFAULT 0
        COMMENT '下单时的人工精修基础价格快照（分）' AFTER `price_cents`,
    ADD COLUMN `priority_fee_cents` INT NOT NULL DEFAULT 0
        COMMENT '用户自选的加急金额（分），等待队列按金额倒序' AFTER `base_price_cents`,
    ADD KEY `idx_resume_review_priority_queue`
        (`request_status`, `priority_fee_cents`, `paid_at`, `id`);

UPDATE `resume_review_request`
SET `base_price_cents` = `price_cents`,
    `priority_fee_cents` = 0;
