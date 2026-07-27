package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.MembershipPlan;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MembershipPlanMapper extends BaseMapper<MembershipPlan> {
    @Select("SELECT * FROM membership_plan WHERE plan_code = #{planCode} FOR UPDATE")
    MembershipPlan selectByCodeForUpdate(@Param("planCode") String planCode);
}
