package com.itwanger.pairesume.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("user_auth_identity")
public class UserAuthIdentity {
    @TableId(type = IdType.AUTO)
    private Long id;

    private Long userId;

    private String provider;

    private String principal;

    private String credentialHash;

    private LocalDateTime verifiedAt;

    private Integer status;

    private LocalDateTime lastLoginAt;

    /** 派聪明服务号当前关注状态；仅由签名桥接事件更新。 */
    private Boolean subscribed;

    private LocalDateTime subscribedAt;

    private LocalDateTime unsubscribedAt;

    private LocalDateTime subscriptionUpdatedAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
