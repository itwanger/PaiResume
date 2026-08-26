package com.itwanger.pairesume.service.impl;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.itwanger.pairesume.common.BusinessException;
import com.itwanger.pairesume.common.ResultCode;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.UserAdminDTO;
import com.itwanger.pairesume.mapper.UserMapper;
import com.itwanger.pairesume.mapper.UserAuthIdentityMapper;
import org.apache.ibatis.mapping.Environment;
import org.apache.ibatis.session.SqlSession;
import org.apache.ibatis.session.SqlSessionFactory;
import org.apache.ibatis.session.SqlSessionFactoryBuilder;
import org.apache.ibatis.transaction.jdbc.JdbcTransactionFactory;
import org.h2.jdbcx.JdbcDataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MembershipServiceListUsersTest {

    private SqlSession sqlSession;
    private Connection connection;
    private MembershipServiceImpl membershipService;

    @BeforeEach
    void setUp() throws SQLException {
        JdbcDataSource dataSource = new JdbcDataSource();
        dataSource.setURL("jdbc:h2:mem:list_users_" + System.nanoTime()
                + ";MODE=MySQL;DB_CLOSE_DELAY=-1");
        MybatisConfiguration configuration = new MybatisConfiguration();
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        configuration.addInterceptor(interceptor);
        configuration.setEnvironment(
                new Environment("test", new JdbcTransactionFactory(), dataSource));
        configuration.addMapper(UserMapper.class);
        configuration.addMapper(UserAuthIdentityMapper.class);
        SqlSessionFactory sqlSessionFactory = new SqlSessionFactoryBuilder().build(configuration);
        sqlSession = sqlSessionFactory.openSession(true);
        connection = sqlSession.getConnection();
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE `user` (
                        id BIGINT PRIMARY KEY,
                        email VARCHAR(128),
                        password VARCHAR(255),
                        nickname VARCHAR(64),
                        avatar VARCHAR(512),
                        role INT,
                        status INT,
                        membership_status VARCHAR(16),
                        membership_granted_at DATETIME,
                        membership_source VARCHAR(32),
                        membership_origin_type VARCHAR(32),
                        membership_origin_id BIGINT,
                        membership_expires_at DATETIME,
                        terms_accepted_at DATETIME,
                        privacy_accepted_at DATETIME,
                        terms_version VARCHAR(32),
                        privacy_version VARCHAR(32),
                        ai_processing_disclosure_version VARCHAR(32),
                        account_deleted_at DATETIME,
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """);
            statement.execute("""
                    CREATE TABLE user_auth_identity (
                        id BIGINT PRIMARY KEY,
                        user_id BIGINT NOT NULL,
                        provider VARCHAR(32) NOT NULL,
                        principal VARCHAR(191) NOT NULL,
                        credential_hash VARCHAR(255),
                        verified_at DATETIME,
                        status INT,
                        last_login_at DATETIME,
                        subscribed BOOLEAN,
                        subscribed_at DATETIME,
                        unsubscribed_at DATETIME,
                        subscription_updated_at DATETIME,
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """);
        }
        membershipService = new MembershipServiceImpl(
                null, sqlSession.getMapper(UserMapper.class),
                sqlSession.getMapper(UserAuthIdentityMapper.class), null, null, null, null);
    }

    @AfterEach
    void tearDown() {
        if (sqlSession != null) {
            sqlSession.close();
        }
    }

    @Test
    void keywordMatchesEmailIgnoringSurroundingWhitespace() throws SQLException {
        insertUser(1L, "alice@example.com", "小艾", "FREE", "2026-08-01 10:00:00");
        insertUser(2L, "bob@example.com", "小波", "FREE", "2026-08-02 10:00:00");

        MarketplacePageDTO<UserAdminDTO> result =
                membershipService.listUsers(1, 20, "  alice  ", null);

        assertEquals(1, result.getTotal());
        assertEquals(1, result.getTotalPages());
        assertEquals("alice@example.com", result.getRecords().get(0).getEmail());
    }

    @Test
    void keywordMatchesNickname() throws SQLException {
        insertUser(1L, "alice@example.com", "小艾", "FREE", "2026-08-01 10:00:00");
        insertUser(2L, "bob@example.com", "小波", "FREE", "2026-08-02 10:00:00");

        MarketplacePageDTO<UserAdminDTO> result =
                membershipService.listUsers(1, 20, "小波", null);

        assertEquals(1, result.getTotal());
        assertEquals("bob@example.com", result.getRecords().get(0).getEmail());
    }

    @Test
    void keywordStillMatchesNicknameWhenAccountHasNoEmail() throws SQLException {
        insertUser(1L, null, "扫码用户七号", "ACTIVE", "2026-08-01 10:00:00");
        insertUser(2L, "bob@example.com", "小波", "FREE", "2026-08-02 10:00:00");

        MarketplacePageDTO<UserAdminDTO> result =
                membershipService.listUsers(1, 20, "扫码用户", null);

        assertEquals(1, result.getTotal());
        assertEquals(1L, result.getRecords().get(0).getId());
        assertNull(result.getRecords().get(0).getEmail());
        assertEquals("扫码用户七号", result.getRecords().get(0).getNickname());
    }

    @Test
    void wechatAccountIncludesStableIdentifierAndLoginState() throws SQLException {
        insertUser(7L, null, "微信用户", "FREE", "2026-08-01 10:00:00");
        insertIdentity(71L, 7L, "WECHAT_SERVICE", "wx-app:openid-7",
                "2026-08-08 18:30:00", true);

        UserAdminDTO user = membershipService.listUsers(1, 20, null, null)
                .getRecords().get(0);

        assertEquals("WECHAT", user.getAccountType());
        assertTrue(user.getWechatIdentifier().matches("WX-[0-9A-F]{8}"));
        assertEquals(true, user.getWechatSubscribed());
        assertEquals("2026-08-08 18:30:00", user.getLastLoginAt());
    }

    @Test
    void keywordMatchesExactUserId() throws SQLException {
        insertUser(7L, null, "微信用户", "FREE", "2026-08-01 10:00:00");
        insertUser(17L, null, "微信用户", "FREE", "2026-08-02 10:00:00");

        MarketplacePageDTO<UserAdminDTO> result =
                membershipService.listUsers(1, 20, "7", null);

        assertEquals(1, result.getTotal());
        assertEquals(7L, result.getRecords().get(0).getId());
    }

    @Test
    void membershipStatusFilterNarrowsResults() throws SQLException {
        insertUser(1L, "a@example.com", "甲", "ACTIVE", "2026-08-01 10:00:00");
        insertUser(2L, "b@example.com", "乙", "FREE", "2026-08-02 10:00:00");
        insertUser(3L, "c@example.com", "丙", "ACTIVE", "2026-08-03 10:00:00");

        MarketplacePageDTO<UserAdminDTO> active =
                membershipService.listUsers(1, 20, null, "ACTIVE");
        MarketplacePageDTO<UserAdminDTO> free =
                membershipService.listUsers(1, 20, null, "FREE");

        assertEquals(2, active.getTotal());
        assertTrue(active.getRecords().stream()
                .allMatch(user -> "ACTIVE".equals(user.getMembershipStatus())));
        assertEquals(1, free.getTotal());
        assertEquals("b@example.com", free.getRecords().get(0).getEmail());
    }

    @Test
    void expiredOrMissingStatusRowsAreFilteredByEffectiveMembership() throws SQLException {
        insertUser(1L, "permanent@example.com", "永久会员", "ACTIVE", "2026-08-01 10:00:00");
        insertUser(2L, "expired@example.com", "过期会员", "ACTIVE",
                "2026-08-01 10:00:00", "2026-08-01 10:00:00");
        insertUser(3L, "free@example.com", "免费用户", "FREE", "2026-08-01 10:00:00");
        insertUser(4L, "legacy@example.com", "老数据", null, "2026-08-01 10:00:00");

        MarketplacePageDTO<UserAdminDTO> active =
                membershipService.listUsers(1, 20, null, "ACTIVE");
        MarketplacePageDTO<UserAdminDTO> free =
                membershipService.listUsers(1, 20, null, "FREE");

        assertEquals(1, active.getTotal());
        assertEquals("permanent@example.com", active.getRecords().get(0).getEmail());
        assertEquals(3, free.getTotal());
        assertTrue(free.getRecords().stream()
                .anyMatch(user -> "expired@example.com".equals(user.getEmail())));
        assertTrue(free.getRecords().stream()
                .anyMatch(user -> "legacy@example.com".equals(user.getEmail())));
        assertTrue(free.getRecords().stream()
                .allMatch(user -> "FREE".equals(user.getMembershipStatus())));
    }

    @Test
    void blankFiltersDoNotNarrowResults() throws SQLException {
        insertUser(1L, "a@example.com", "甲", "ACTIVE", "2026-08-01 10:00:00");
        insertUser(2L, "b@example.com", "乙", "FREE", "2026-08-02 10:00:00");

        MarketplacePageDTO<UserAdminDTO> result =
                membershipService.listUsers(1, 20, "   ", "  ");

        assertEquals(2, result.getTotal());
    }

    @Test
    void paginationReportsTotalAndTotalPagesInCreationOrder() throws SQLException {
        for (long id = 1; id <= 25; id++) {
            insertUser(id, "user" + id + "@example.com", "用户" + id, "FREE",
                    String.format("2026-08-01 10:%02d:00", id));
        }

        MarketplacePageDTO<UserAdminDTO> firstPage =
                membershipService.listUsers(1, 10, null, null);
        MarketplacePageDTO<UserAdminDTO> lastPage =
                membershipService.listUsers(3, 10, null, null);

        assertEquals(25, firstPage.getTotal());
        assertEquals(3, firstPage.getTotalPages());
        assertEquals(10, firstPage.getRecords().size());
        assertEquals(25L, firstPage.getRecords().get(0).getId());
        assertEquals(16L, firstPage.getRecords().get(9).getId());
        assertEquals(5, lastPage.getRecords().size());
        assertEquals(3, lastPage.getPage());
        assertEquals(0, membershipService.listUsers(1, 20, "不存在的用户", null).getTotalPages());
    }

    @Test
    void outOfRangePageAndSizeAreClamped() throws SQLException {
        insertUser(1L, "a@example.com", "甲", "FREE", "2026-08-01 10:00:00");

        MarketplacePageDTO<UserAdminDTO> oversized =
                membershipService.listUsers(0, 500, null, null);
        MarketplacePageDTO<UserAdminDTO> undersized =
                membershipService.listUsers(-3, 0, null, null);

        assertEquals(1, oversized.getPage());
        assertEquals(100, oversized.getSize());
        assertEquals(1, undersized.getPage());
        assertEquals(1, undersized.getSize());
    }

    @Test
    void invalidMembershipStatusFilterIsRejected() throws SQLException {
        insertUser(1L, "a@example.com", "甲", "FREE", "2026-08-01 10:00:00");

        BusinessException exception = assertThrows(BusinessException.class,
                () -> membershipService.listUsers(1, 20, null, "VIP"));

        assertEquals(ResultCode.BAD_REQUEST.getCode(), exception.getCode());
    }

    private void insertUser(long id, String email, String nickname,
                            String membershipStatus, String createdAt) throws SQLException {
        insertUser(id, email, nickname, membershipStatus, null, createdAt);
    }

    private void insertUser(long id, String email, String nickname, String membershipStatus,
                            String membershipExpiresAt, String createdAt) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO `user`
                    (id, email, nickname, role, status, membership_status,
                     membership_expires_at, created_at, updated_at)
                VALUES (?, ?, ?, 0, 1, ?, ?, ?, ?)
                """)) {
            statement.setLong(1, id);
            statement.setString(2, email);
            statement.setString(3, nickname);
            statement.setString(4, membershipStatus);
            statement.setString(5, membershipExpiresAt);
            statement.setString(6, createdAt);
            statement.setString(7, createdAt);
            statement.executeUpdate();
        }
    }

    private void insertIdentity(long id, long userId, String provider, String principal,
                                String lastLoginAt, boolean subscribed) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("""
                INSERT INTO user_auth_identity
                    (id, user_id, provider, principal, status, last_login_at, subscribed,
                     created_at, updated_at)
                VALUES (?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """)) {
            statement.setLong(1, id);
            statement.setLong(2, userId);
            statement.setString(3, provider);
            statement.setString(4, principal);
            statement.setString(5, lastLoginAt);
            statement.setBoolean(6, subscribed);
            statement.executeUpdate();
        }
    }
}
