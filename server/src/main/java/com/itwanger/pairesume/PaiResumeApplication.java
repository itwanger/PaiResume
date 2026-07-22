package com.itwanger.pairesume;

import com.itwanger.pairesume.config.DotenvConfig;
import com.itwanger.pairesume.config.ApplicationTimeZone;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
@MapperScan("com.itwanger.pairesume.mapper")
@EnableScheduling
public class PaiResumeApplication {

    static {
        // LocalDateTime is persisted throughout the existing schema. Set the
        // process-wide zone before Spring, Jackson, JDBC, or a scheduler can
        // initialize so every conversion has the same wall-clock basis.
        ApplicationTimeZone.enforce();
    }

    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(PaiResumeApplication.class);
        app.addInitializers(new DotenvConfig());
        app.run(args);
    }
}
