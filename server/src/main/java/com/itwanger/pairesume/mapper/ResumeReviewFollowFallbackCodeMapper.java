package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewFollowFallbackCode;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface ResumeReviewFollowFallbackCodeMapper extends BaseMapper<ResumeReviewFollowFallbackCode> {
    @Select("SELECT * FROM resume_review_follow_fallback_code WHERE code_hash=#{hash} FOR UPDATE")
    ResumeReviewFollowFallbackCode selectByHashForUpdate(@Param("hash") String hash);
    @Select("SELECT * FROM resume_review_follow_fallback_code ORDER BY created_at DESC LIMIT 200")
    List<ResumeReviewFollowFallbackCode> selectAdminList();
}
