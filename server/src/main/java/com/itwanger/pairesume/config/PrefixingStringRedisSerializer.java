package com.itwanger.pairesume.config;

import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

final class PrefixingStringRedisSerializer implements RedisSerializer<String> {

    private final String prefix;
    private final StringRedisSerializer delegate = new StringRedisSerializer();

    PrefixingStringRedisSerializer(String prefix) {
        this.prefix = prefix;
    }

    @Override
    public byte[] serialize(String key) {
        if (key == null) {
            return null;
        }
        return delegate.serialize(key.startsWith(prefix) ? key : prefix + key);
    }

    @Override
    public String deserialize(byte[] bytes) {
        String physicalKey = delegate.deserialize(bytes);
        if (physicalKey == null || !physicalKey.startsWith(prefix)) {
            return physicalKey;
        }
        return physicalKey.substring(prefix.length());
    }
}
