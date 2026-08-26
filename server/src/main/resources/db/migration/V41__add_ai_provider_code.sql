ALTER TABLE `ai_provider_config`
    ADD COLUMN `provider_code` VARCHAR(32) NOT NULL DEFAULT 'DEEPSEEK'
        COMMENT '服务商预设编码；地址、模型和隐私政策由服务端预设决定' AFTER `id`;

UPDATE `ai_provider_config`
SET `base_url` = 'https://api.deepseek.com',
    `general_model` = 'deepseek-v4-flash',
    `analysis_model` = 'deepseek-v4-flash',
    `privacy_policy_url` = 'https://cdn.deepseek.com/policies/zh-CN/deepseek-privacy-policy.html'
WHERE `id` = 1
  AND `enabled` = 0
  AND `api_key_cipher` IS NULL
  AND `display_name` = 'DeepSeek'
  AND `base_url` = 'https://api.deepseek.com/v1'
  AND `general_model` = 'deepseek-chat'
  AND `analysis_model` = 'deepseek-chat';
