package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ShowcasePurchaseOrder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ShowcasePurchaseOrderMapper extends BaseMapper<ShowcasePurchaseOrder> {
    @Select("SELECT * FROM showcase_purchase_order WHERE order_no = #{orderNo} LIMIT 1")
    ShowcasePurchaseOrder selectByOrderNo(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM showcase_purchase_order WHERE order_no = #{orderNo} FOR UPDATE")
    ShowcasePurchaseOrder selectByOrderNoForUpdate(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM showcase_purchase_order WHERE purchase_token_hash = #{tokenHash} "
            + "AND idempotency_key = #{idempotencyKey} LIMIT 1")
    ShowcasePurchaseOrder selectByIdempotencyKey(@Param("tokenHash") String tokenHash,
                                                  @Param("idempotencyKey") String idempotencyKey);

    @Select("SELECT * FROM showcase_purchase_order WHERE active_order_key = #{activeOrderKey} LIMIT 1")
    ShowcasePurchaseOrder selectByActiveOrderKey(@Param("activeOrderKey") String activeOrderKey);
}
