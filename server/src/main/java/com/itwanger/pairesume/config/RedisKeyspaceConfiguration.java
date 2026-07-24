package com.itwanger.pairesume.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(RedisKeyPrefixProperties.class)
public class RedisKeyspaceConfiguration {

    @Bean
    public StringRedisTemplate stringRedisTemplate(
            RedisConnectionFactory connectionFactory,
            RedisKeyPrefixProperties properties,
            @Value("${app.environment:unset}") String environment
    ) {
        StringRedisTemplate template = new StringRedisTemplate();
        template.setConnectionFactory(connectionFactory);
        template.setKeySerializer(
                new PrefixingStringRedisSerializer(properties.validatedPrefix(environment))
        );
        template.afterPropertiesSet();
        return template;
    }
}
