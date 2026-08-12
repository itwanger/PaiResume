package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumePhoto;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ResumePhotoMapper extends BaseMapper<ResumePhoto> {
    @Select("SELECT * FROM resume_photo WHERE photo_no=#{photoNo} FOR UPDATE")
    ResumePhoto selectByPhotoNoForUpdate(@Param("photoNo") String photoNo);

    @Select("SELECT * FROM resume_photo WHERE active_user_key=#{activeUserKey} LIMIT 1 FOR UPDATE")
    ResumePhoto selectActiveForUpdate(@Param("activeUserKey") String activeUserKey);
}
