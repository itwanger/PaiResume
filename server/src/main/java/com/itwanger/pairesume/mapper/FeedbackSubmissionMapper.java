package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.FeedbackSubmission;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface FeedbackSubmissionMapper extends BaseMapper<FeedbackSubmission> {
    @Select("SELECT * FROM feedback_submission WHERE id = #{id} FOR UPDATE")
    FeedbackSubmission selectByIdForUpdate(@Param("id") Long id);
}
