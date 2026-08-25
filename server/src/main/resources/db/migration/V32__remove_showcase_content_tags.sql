SET @drop_showcase_tags_sql = (
    SELECT IF(
        EXISTS(
            SELECT 1
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'resume_showcase'
              AND COLUMN_NAME = 'tags'
        ),
        'ALTER TABLE `resume_showcase` DROP COLUMN `tags`',
        'SELECT 1'
    )
);

PREPARE drop_showcase_tags_statement FROM @drop_showcase_tags_sql;
EXECUTE drop_showcase_tags_statement;
DEALLOCATE PREPARE drop_showcase_tags_statement;
