package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.VipInviteRedemption;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface VipInviteRedemptionMapper extends BaseMapper<VipInviteRedemption> {
    @Select("SELECT * FROM vip_invite_redemption WHERE id = #{redemptionId} AND invite_code_id = #{inviteId} LIMIT 1 FOR UPDATE")
    VipInviteRedemption selectByIdForUpdate(
            @Param("inviteId") Long inviteId,
            @Param("redemptionId") Long redemptionId
    );
}
