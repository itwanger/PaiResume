package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.CreatorEarning;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface CreatorEarningMapper extends BaseMapper<CreatorEarning> {
    @Select("SELECT * FROM creator_earning WHERE id = #{id} FOR UPDATE")
    CreatorEarning selectByIdForUpdate(@Param("id") Long id);

    @Select("SELECT * FROM creator_earning WHERE order_id = #{orderId} LIMIT 1")
    CreatorEarning selectByOrderId(@Param("orderId") Long orderId);

    @Select("SELECT * FROM creator_earning WHERE order_id = #{orderId} FOR UPDATE")
    CreatorEarning selectByOrderIdForUpdate(@Param("orderId") Long orderId);

    @Select("SELECT e.id FROM creator_earning e INNER JOIN resume_view_order o ON o.id = e.order_id "
            + "WHERE e.earning_status = 'HOLDING' AND e.available_at <= NOW() "
            + "AND o.order_status = 'PAID' AND o.provider_reconciled_at >= e.available_at "
            + "ORDER BY e.available_at ASC, e.id ASC LIMIT 100")
    List<Long> selectDueHoldingCandidateIds();
}
