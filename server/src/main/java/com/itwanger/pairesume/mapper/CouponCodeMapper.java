package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.CouponCode;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CouponCodeMapper extends BaseMapper<CouponCode> {
    @Select("SELECT id, code, source_type, source_id, recipient_email, amount_cents, "
            + "status AS coupon_status, used_by_user_id, used_at, email_sent_at, "
            + "expires_at, created_at, updated_at FROM coupon_code "
            + "WHERE code = #{code} LIMIT 1 FOR UPDATE")
    CouponCode selectByCodeForUpdate(@Param("code") String code);
}
