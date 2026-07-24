package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.dao.DataAccessException;
import org.springframework.data.redis.connection.RedisClusterConnection;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisSentinelConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultScriptExecutor;
import org.springframework.data.redis.serializer.RedisSerializer;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RedisKeyspaceConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(RedisKeyspaceConfiguration.class)
            .withBean(RedisConnectionFactory.class, RedisKeyspaceConfigurationTest::connectionFactory);

    @Test
    void configuresOnePrefixingStringRedisTemplateWithoutChangingValuesOrHashFields() {
        contextRunner
                .withPropertyValues(
                        "app.environment=test",
                        "app.redis.key-prefix=pairesume:test:"
                )
                .run(context -> {
                    assertTrue(context.isRunning());
                    assertEquals(1, context.getBeansOfType(StringRedisTemplate.class).size());

                    StringRedisTemplate template = context.getBean(StringRedisTemplate.class);
                    RedisSerializer<Object> keySerializer = serializer(template.getKeySerializer());
                    RedisSerializer<Object> valueSerializer = serializer(template.getValueSerializer());
                    RedisSerializer<Object> hashKeySerializer = serializer(template.getHashKeySerializer());
                    RedisSerializer<Object> hashValueSerializer = serializer(template.getHashValueSerializer());

                    assertEquals(
                            "pairesume:test:login:attempts:ip:abc",
                            utf8(keySerializer.serialize("login:attempts:ip:abc"))
                    );
                    assertEquals(
                            "login:attempts:ip:abc",
                            keySerializer.deserialize(bytes("pairesume:test:login:attempts:ip:abc"))
                    );
                    assertEquals("value", utf8(valueSerializer.serialize("value")));
                    assertEquals("field", utf8(hashKeySerializer.serialize("field")));
                    assertEquals("hash-value", utf8(hashValueSerializer.serialize("hash-value")));
                });
    }

    @Test
    void luaKeysUseThePrefixWhileArgsKeepTheValueSerializer() {
        RedisKeyPrefixProperties properties = new RedisKeyPrefixProperties();
        properties.setKeyPrefix("pairesume:test:");
        StringRedisTemplate template = new RedisKeyspaceConfiguration().stringRedisTemplate(
                connectionFactory(),
                properties,
                "test"
        );

        ExposedScriptExecutor executor = new ExposedScriptExecutor(template);
        byte[][] keysAndArgs = executor.serialize(
                List.of("verify:code:abc", "verify:attempts:abc"),
                "hash-field",
                "plain-value"
        );

        assertEquals("pairesume:test:verify:code:abc", utf8(keysAndArgs[0]));
        assertEquals("pairesume:test:verify:attempts:abc", utf8(keysAndArgs[1]));
        assertEquals("hash-field", utf8(keysAndArgs[2]));
        assertEquals("plain-value", utf8(keysAndArgs[3]));
    }

    @Test
    void alreadyPhysicalKeysAreNotPrefixedTwice() {
        PrefixingStringRedisSerializer serializer =
                new PrefixingStringRedisSerializer("pairesume:test:");

        byte[] expected = bytes("pairesume:test:refresh:family:7");
        assertArrayEquals(expected, serializer.serialize("refresh:family:7"));
        assertArrayEquals(expected, serializer.serialize("pairesume:test:refresh:family:7"));
        assertNull(serializer.serialize(null));
        assertNull(serializer.deserialize(null));
    }

    @Test
    void productionRequiresTheDedicatedProductionPrefix() {
        RedisKeyPrefixProperties properties = new RedisKeyPrefixProperties();
        assertThrows(IllegalStateException.class, () -> properties.validatedPrefix("production"));

        properties.setKeyPrefix("pairesume:prod:");
        assertEquals("pairesume:prod:", properties.validatedPrefix("production"));
    }

    @Test
    void rejectsBlankWhitespaceAndUnsafePrefixes() {
        RedisKeyPrefixProperties properties = new RedisKeyPrefixProperties();
        for (String invalid : List.of("", " pairesume:dev:", "pairesume dev:", "pairesume")) {
            properties.setKeyPrefix(invalid);
            assertThrows(IllegalStateException.class, () -> properties.validatedPrefix("development"));
        }
    }

    @Test
    void productionContextFailsClosedWithTheDevelopmentDefault() {
        contextRunner
                .withPropertyValues("app.environment=production")
                .run(context -> {
                    assertNotNull(context.getStartupFailure());
                    assertTrue(context.getStartupFailure().getMessage().contains("stringRedisTemplate"));
                });
    }

    @SuppressWarnings("unchecked")
    private static RedisSerializer<Object> serializer(RedisSerializer<?> serializer) {
        return (RedisSerializer<Object>) serializer;
    }

    private static byte[] bytes(String value) {
        return value.getBytes(StandardCharsets.UTF_8);
    }

    private static String utf8(byte[] value) {
        return new String(value, StandardCharsets.UTF_8);
    }

    private static RedisConnectionFactory connectionFactory() {
        return new RedisConnectionFactory() {
            @Override
            public boolean getConvertPipelineAndTxResults() {
                return false;
            }

            @Override
            public RedisConnection getConnection() {
                return null;
            }

            @Override
            public RedisClusterConnection getClusterConnection() {
                return null;
            }

            @Override
            public RedisSentinelConnection getSentinelConnection() {
                return null;
            }

            @Override
            public DataAccessException translateExceptionIfPossible(RuntimeException exception) {
                return null;
            }
        };
    }

    private static final class ExposedScriptExecutor extends DefaultScriptExecutor<String> {
        private ExposedScriptExecutor(StringRedisTemplate template) {
            super(template);
        }

        private byte[][] serialize(List<String> keys, Object... args) {
            return keysAndArgs(RedisSerializer.string(), keys, args);
        }
    }
}
