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

    /** 会员来源: ADMIN_GRANTED/PAYMENT */
    private String membershipSource;

    /** 会员到期时间，永久会员为空 */
    private LocalDateTime membershipExpiresAt;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
