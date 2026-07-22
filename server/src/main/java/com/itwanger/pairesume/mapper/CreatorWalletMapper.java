package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.CreatorWallet;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CreatorWalletMapper extends BaseMapper<CreatorWallet> {
    @Select("SELECT * FROM creator_wallet WHERE user_id = #{userId} FOR UPDATE")
    CreatorWallet selectByUserIdForUpdate(@Param("userId") Long userId);

    @Insert("INSERT IGNORE INTO creator_wallet "
            + "(user_id, held_balance_cents, pending_balance_cents, available_balance_cents, "
            + "debt_balance_cents, lifetime_earned_cents, lifetime_refunded_cents, paid_out_cents, "
            + "version, created_at, updated_at) "
            + "VALUES (#{userId}, 0, 0, 0, 0, 0, 0, 0, 0, NOW(), NOW())")
    int ensureWallet(@Param("userId") Long userId);
}
