ALTER TABLE `resume_photo_oss_config`
    ADD COLUMN `object_prefix` VARCHAR(128) NOT NULL DEFAULT 'pairesume'
        COMMENT 'root prefix for all resume photo objects' AFTER `bucket`;
