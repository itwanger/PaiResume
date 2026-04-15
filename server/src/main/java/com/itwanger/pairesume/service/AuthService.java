package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.*;

public interface AuthService {
    /** 注册 */
    TokenDTO register(RegisterDTO dto);

    /** 登录 */
    TokenDTO login(LoginDTO dto);

    /** 刷新 Token */
    TokenDTO refreshToken(String refreshToken);

    /** 获取当前用户信息 */
    UserInfoDTO getCurrentUserInfo(Long userId);

    /** 登出 */
    void logout(Long userId, String accessToken);

    /** 发送邮箱验证码 */
    void sendVerificationCode(String email);

    /** 校验验证码 */
    boolean verifyCode(String email, String code);
}
