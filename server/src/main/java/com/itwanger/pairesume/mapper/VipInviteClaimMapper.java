package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.VipInviteClaim;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.ResultMap;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface VipInviteClaimMapper extends BaseMapper<VipInviteClaim> {

    @Select("SELECT * FROM vip_invite_claim WHERE token_hash = #{tokenHash} LIMIT 1 FOR UPDATE")
    @Results(
            id = "vipInviteClaimResultMap",
            value = {
                    @Result(column = "id", property = "id", id = true),
                    @Result(column = "token_hash", property = "tokenHash"),
                    @Result(column = "invite_code_id", property = "inviteCodeId"),
                    @Result(column = "challenge_id_hash", property = "challengeIdHash"),
                    @Result(column = "user_id", property = "userId"),
                    @Result(column = "redemption_id", property = "redemptionId"),
                    @Result(column = "status", property = "claimStatus"),
                    @Result(column = "failure_code", property = "failureCode"),
                    @Result(column = "expires_at", property = "expiresAt"),
                    @Result(column = "bound_at", property = "boundAt"),
                    @Result(column = "completed_at", property = "completedAt"),
                    @Result(column = "created_at", property = "createdAt"),
                    @Result(column = "updated_at", property = "updatedAt")
            }
    )
    VipInviteClaim selectByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

    @Select("SELECT * FROM vip_invite_claim WHERE id = #{id} LIMIT 1 FOR UPDATE")
    @ResultMap("vipInviteClaimResultMap")
    VipInviteClaim selectByIdForUpdate(@Param("id") Long id);

    @Update("""
            UPDATE vip_invite_claim
            SET challenge_id_hash = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = #{id}
              AND challenge_id_hash = #{challengeIdHash}
              AND user_id IS NULL
              AND status = 'AWAITING_IDENTITY'
            """)
    int releaseChallenge(
            @Param("id") Long id,
            @Param("challengeIdHash") String challengeIdHash
    );

    @Update("""
            UPDATE vip_invite_claim
            SET status = 'EXPIRED',
                failure_code = COALESCE(failure_code, 'CLAIM_EXPIRED'),
                completed_at = COALESCE(completed_at, #{now}),
                updated_at = CURRENT_TIMESTAMP
            WHERE status IN ('AWAITING_IDENTITY', 'PENDING_CONSENT', 'PENDING_REDEMPTION')
              AND expires_at <= #{now}
            LIMIT #{batchSize}
            """)
    int expirePendingBatch(
            @Param("now") java.time.LocalDateTime now,
            @Param("batchSize") int batchSize
    );

    @Delete("""
            DELETE FROM vip_invite_claim
            WHERE status IN ('EXPIRED', 'FAILED')
              AND updated_at < #{cutoff}
            LIMIT #{batchSize}
            """)
    int deleteTerminalBatch(
            @Param("cutoff") java.time.LocalDateTime cutoff,
            @Param("batchSize") int batchSize
    );
}
