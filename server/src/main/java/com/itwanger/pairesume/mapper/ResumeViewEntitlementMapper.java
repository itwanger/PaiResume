package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeViewEntitlement;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ResumeViewEntitlementMapper extends BaseMapper<ResumeViewEntitlement> {
    @Select("SELECT * FROM resume_view_entitlement WHERE listing_id = #{listingId} "
            + "AND buyer_user_id = #{buyerUserId} LIMIT 1")
    ResumeViewEntitlement selectByListingAndBuyer(@Param("listingId") Long listingId,
                                                  @Param("buyerUserId") Long buyerUserId);

    @Select("SELECT * FROM resume_view_entitlement WHERE listing_id = #{listingId} "
            + "AND buyer_user_id = #{buyerUserId} FOR UPDATE")
    ResumeViewEntitlement selectByListingAndBuyerForUpdate(@Param("listingId") Long listingId,
                                                           @Param("buyerUserId") Long buyerUserId);

    @Select("SELECT * FROM resume_view_entitlement WHERE source_order_id = #{orderId} FOR UPDATE")
    ResumeViewEntitlement selectBySourceOrderIdForUpdate(@Param("orderId") Long orderId);
}
