package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.UserAuthIdentity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

import java.time.LocalDateTime;

@Mapper
public interface UserAuthIdentityMapper extends BaseMapper<UserAuthIdentity> {

    @Update("""
            UPDATE user_auth_identity
            SET subscribed = #{subscribed},
                subscribed_at = CASE WHEN #{subscribed} = 1 THEN #{eventAt} ELSE subscribed_at END,
                unsubscribed_at = CASE WHEN #{subscribed} = 0 THEN #{eventAt} ELSE NULL END,
                subscription_updated_at = #{eventAt},
                updated_at = CURRENT_TIMESTAMP
            WHERE provider = 'WECHAT_SERVICE'
              AND principal = #{principal}
              AND status = 1
              AND (subscription_updated_at IS NULL OR subscription_updated_at <= #{eventAt})
            """)
    int updateSubscriptionIfNewer(
            @Param("principal") String principal,
            @Param("subscribed") boolean subscribed,
            @Param("eventAt") LocalDateTime eventAt
    );
}
