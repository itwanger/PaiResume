package com.itwanger.pairesume.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.itwanger.pairesume.entity.User;
import com.itwanger.pairesume.entity.UserAuthIdentity;
import com.itwanger.pairesume.mapper.UserAuthIdentityMapper;
import com.itwanger.pairesume.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Slf4j
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@RequiredArgsConstructor
public class DevelopmentAccountInitializer implements ApplicationRunner {

    private final UserMapper userMapper;
    private final UserAuthIdentityMapper userAuthIdentityMapper;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.environment:development}")
    private String appEnvironment;

    @Value("${app.dev-account.email:test@example.com}")
    private String devAccountEmail;

    @Value("${app.dev-account.password:Test123456}")
    private String devAccountPassword;

    @Value("${app.dev-admin.email:admin@example.com}")
    private String devAdminEmail;

    @Value("${app.dev-admin.password:Admin123456}")
    private String devAdminPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (!"development".equalsIgnoreCase(appEnvironment)) {
            return;
        }

        ensureAccount(devAccountEmail, devAccountPassword, 0, "Test User");
        ensureAccount(devAdminEmail, devAdminPassword, 1, "Admin User");
    }

    private void ensureAccount(String email, String password, int role, String nickname) {
        var existingUser = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getEmail, email)
        );
        if (existingUser != null) {
            log.info("Development account already exists: {}", email);
            return;
        }

        var user = new User();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setNickname(nickname);
        user.setAvatar("");
        user.setRole(role);
        user.setStatus(1);
        user.setMembershipStatus(role == 1 ? "ACTIVE" : "FREE");
        userMapper.insert(user);

        UserAuthIdentity identity = new UserAuthIdentity();
        identity.setUserId(user.getId());
        identity.setProvider("EMAIL_PASSWORD");
        identity.setPrincipal(email.toLowerCase());
        identity.setCredentialHash(user.getPassword());
        identity.setVerifiedAt(LocalDateTime.now());
        identity.setStatus(1);
        userAuthIdentityMapper.insert(identity);

        log.info("Development account created: {}", email);
    }
}
