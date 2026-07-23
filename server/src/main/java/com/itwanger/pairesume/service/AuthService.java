package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.*;

import java.time.LocalDateTime;

public interface AuthService {
    /** 注册 */
    TokenDTO register(RegisterDTO dto, String clientIp);

    /** 登录 */
    TokenDTO login(LoginDTO dto, String clientIp);

    /** 刷新 Token */
    TokenDTO refreshToken(String refreshToken);

    /** 获取当前用户信息 */
    UserInfoDTO getCurrentUserInfo(Long userId);

    /** 登出 */
    void logout(Long userId, String accessToken);

    /** 发送邮箱验证码 */
    void sendVerificationCode(String email, String clientIp);

    /** 请求重置密码；无论邮箱是否存在都返回相同结果，避免账号枚举 */
    void requestPasswordReset(String email, String clientIp);

    /** 使用一次性验证码重置密码并撤销全部旧会话 */
    void resetPassword(PasswordResetConfirmDTO dto);

    /** 记录当前版本服务条款、隐私政策及 AI 处理说明的明确同意 */
    UserInfoDTO acceptLegalConsent(Long userId, LegalConsentDTO dto);

    /** 注销当前账号并撤销全部会话 */
    void deleteAccount(Long userId, AccountDeletionDTO dto);

    /** 由签名微信事件确认后登录或创建派聪明扫码账号。 */
    TokenDTO loginOrRegisterPaicongming(String appId, String openId, LocalDateTime subscribedAt);

    /** 将派聪明微信身份绑定到当前已登录账号。 */
    UserInfoDTO bindPaicongming(Long userId, String appId, String openId, LocalDateTime subscribedAt);

    /** 只接受签名桥接事件更新派聪明关注状态。 */
    void recordPaicongmingSubscription(String appId, String openId, boolean subscribed, LocalDateTime eventAt);

    /** 校验本次可信扫码对应的微信身份确实已绑定当前账号。 */
    void verifyPaicongmingReauth(Long userId, String appId, String openId);
}
