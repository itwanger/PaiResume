package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@TableName("`user`")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String email;

    private String password;

    private String nickname;

    private String avatar;

    /** 角色: 0=普通用户, 1=管理员 */
    private Integer role;

    /** 状态: 0=禁用, 1=正常 */
    private Integer status;

    /** 会员状态: FREE/ACTIVE */
    private String membershipStatus;

    /** 会员开通时间 */
    private LocalDateTime membershipGrantedAt;

    /** 会员来源: ADMIN_GRANTED/VIP_INVITE/ADMIN_EXTENDED/PAYMENT */
    private String membershipSource;

    /** 当前权益根来源 */
    private String membershipOriginType;

    /** 当前权益根来源记录 ID */
    private Long membershipOriginId;

    /** 会员到期时间，永久会员为空 */
    private LocalDateTime membershipExpiresAt;

    /** 最近一次同意服务条款的时间 */
    private LocalDateTime termsAcceptedAt;

    /** 最近一次同意隐私政策的时间 */
    private LocalDateTime privacyAcceptedAt;

    private String termsVersion;

    private String privacyVersion;

    private String aiProcessingDisclosureVersion;

    /** 账号注销时间；注销后保留匿名主键用于订单审计 */
    private LocalDateTime accountDeletedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
