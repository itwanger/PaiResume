package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewFollowChallenge;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ResumeReviewFollowChallengeMapper extends BaseMapper<ResumeReviewFollowChallenge> {
    @Select("SELECT * FROM resume_review_follow_challenge WHERE active_user_key=#{key} LIMIT 1")
    ResumeReviewFollowChallenge selectActive(@Param("key") String key);
    @Select("SELECT * FROM resume_review_follow_challenge WHERE challenge_code=#{code} FOR UPDATE")
    ResumeReviewFollowChallenge selectByCodeForUpdate(@Param("code") String code);
    @Select("SELECT * FROM resume_review_follow_challenge WHERE bridge_event_hash=#{eventHash} LIMIT 1")
    ResumeReviewFollowChallenge selectByEventHash(@Param("eventHash") String eventHash);
}
