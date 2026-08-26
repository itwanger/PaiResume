package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.User;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Select("SELECT * FROM `user` WHERE id = #{id} LIMIT 1 FOR UPDATE")
    User selectByIdForUpdate(@Param("id") Long id);

    /**
     * Persist the complete membership state, including fields intentionally cleared to NULL.
     * BaseMapper#updateById skips null-valued fields by default, which would otherwise leave
     * stale expiration and origin data after revocation or an expiry correction.
     */
    @Update("""
            UPDATE `user`
            SET `membership_status` = #{membershipStatus},
                `membership_granted_at` = #{membershipGrantedAt,jdbcType=TIMESTAMP},
                `membership_source` = #{membershipSource,jdbcType=VARCHAR},
                `membership_origin_type` = #{membershipOriginType,jdbcType=VARCHAR},
                `membership_origin_id` = #{membershipOriginId,jdbcType=BIGINT},
                `membership_expires_at` = #{membershipExpiresAt,jdbcType=TIMESTAMP},
                `updated_at` = CURRENT_TIMESTAMP
            WHERE `id` = #{id}
            """)
    int updateMembership(User user);

}
