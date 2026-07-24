package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewUpload;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ResumeReviewUploadMapper extends BaseMapper<ResumeReviewUpload> {

    @Select("SELECT * FROM resume_review_upload WHERE upload_no=#{uploadNo} FOR UPDATE")
    ResumeReviewUpload selectByUploadNoForUpdate(@Param("uploadNo") String uploadNo);

    @Select("SELECT * FROM resume_review_upload WHERE active_user_key=#{activeUserKey} LIMIT 1 FOR UPDATE")
    ResumeReviewUpload selectActiveForUpdate(@Param("activeUserKey") String activeUserKey);
}
