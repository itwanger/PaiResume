package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.VipInviteCode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface VipInviteCodeMapper extends BaseMapper<VipInviteCode> {
    @Select("SELECT * FROM vip_invite_code WHERE code = #{code} LIMIT 1 FOR UPDATE")
    @Results(
            id = "vipInviteCodeResultMap",
            value = {
                    @Result(column = "id", property = "id", id = true),
                    @Result(column = "code", property = "code"),
                    @Result(column = "status", property = "inviteStatus"),
                    @Result(column = "remark", property = "remark"),
                    @Result(column = "created_by", property = "createdBy"),
                    @Result(column = "max_redemptions", property = "maxRedemptions"),
                    @Result(column = "redeemed_count", property = "redeemedCount"),
                    @Result(column = "membership_days", property = "membershipDays"),
                    @Result(column = "expires_at", property = "expiresAt"),
                    @Result(column = "invalidated_by", property = "invalidatedBy"),
                    @Result(column = "invalidated_at", property = "invalidatedAt"),
                    @Result(column = "invalidate_reason", property = "invalidateReason"),
                    @Result(column = "created_at", property = "createdAt"),
                    @Result(column = "updated_at", property = "updatedAt")
            }
    )
    VipInviteCode selectByCodeForUpdate(@Param("code") String code);

    @Select("SELECT * FROM vip_invite_code WHERE id = #{id} LIMIT 1 FOR UPDATE")
    @ResultMap("vipInviteCodeResultMap")
    VipInviteCode selectByIdForUpdate(@Param("id") Long id);
}
