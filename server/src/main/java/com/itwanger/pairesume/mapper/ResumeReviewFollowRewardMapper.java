package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewFollowReward;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ResumeReviewFollowRewardMapper extends BaseMapper<ResumeReviewFollowReward> {
    @Select("SELECT * FROM resume_review_follow_reward WHERE user_id=#{userId} FOR UPDATE")
    ResumeReviewFollowReward selectByUserForUpdate(@Param("userId") Long userId);
    @Select("SELECT * FROM resume_review_follow_reward WHERE user_id=#{userId} LIMIT 1")
    ResumeReviewFollowReward selectByUser(@Param("userId") Long userId);
    @Select("SELECT * FROM resume_review_follow_reward WHERE quota_subject_hash=#{subjectHash} FOR UPDATE")
    ResumeReviewFollowReward selectBySubjectForUpdate(@Param("subjectHash") String subjectHash);
    @Select("SELECT * FROM resume_review_follow_reward WHERE quota_subject_hash=#{subjectHash} LIMIT 1")
    ResumeReviewFollowReward selectBySubject(@Param("subjectHash") String subjectHash);
}
