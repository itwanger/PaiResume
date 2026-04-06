package com.itwanger.pairesume.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DevelopmentAccountInitializer implements ApplicationRunner {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.environment:development}")
    private String appEnvironment;

    @Value("${app.dev-account.email:test@example.com}")
    private String devAccountEmail;

    @Value("${app.dev-account.password:Test123456}")
    private String devAccountPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (!"development".equalsIgnoreCase(appEnvironment)) {
            return;
        }

        var existingUser = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getEmail, devAccountEmail)
        );
        if (existingUser != null) {
            log.info("Development test account already exists: {}", devAccountEmail);
            return;
        }

        var user = new User();
        user.setEmail(devAccountEmail);
        user.setPassword(passwordEncoder.encode(devAccountPassword));
        user.setNickname("Test User");
        user.setAvatar("");
        user.setRole(0);
        user.setStatus(1);
        userMapper.insert(user);

        log.info("Development test account created: {}", devAccountEmail);
    }
}
