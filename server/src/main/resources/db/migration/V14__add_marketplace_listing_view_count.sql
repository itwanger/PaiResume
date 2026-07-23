ALTER TABLE `resume_market_listing`
    ADD COLUMN `view_count` BIGINT NOT NULL DEFAULT 0 COMMENT '公开详情页累计浏览次数' AFTER `price_cents`;
