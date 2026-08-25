UPDATE `resume_showcase`
SET `access_type` = CASE
    WHEN UPPER(TRIM(`access_type`)) = 'FREE' THEN 'PUBLIC'
    WHEN UPPER(TRIM(`access_type`)) = 'VIP' THEN 'PAID'
    WHEN UPPER(TRIM(`access_type`)) IN ('PUBLIC', 'LOGIN', 'PAID') THEN UPPER(TRIM(`access_type`))
    ELSE 'PAID'
END;

-- 这份官方精选已确认向所有访客公开。
UPDATE `resume_showcase`
SET `access_type` = 'PUBLIC'
WHERE `slug` = 'featured-65';

ALTER TABLE `resume_showcase`
    MODIFY COLUMN `access_type` VARCHAR(16) NOT NULL DEFAULT 'PUBLIC'
        COMMENT '访问类型: PUBLIC/LOGIN/PAID';
