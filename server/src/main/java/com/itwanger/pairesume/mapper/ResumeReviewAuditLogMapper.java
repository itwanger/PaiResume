package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewAuditLog;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ResumeReviewAuditLogMapper extends BaseMapper<ResumeReviewAuditLog> {
    @Select("SELECT * FROM resume_review_audit_log WHERE request_no=#{requestNo} ORDER BY created_at,id")
    List<ResumeReviewAuditLog> selectByRequestNo(@Param("requestNo") String requestNo);
}
