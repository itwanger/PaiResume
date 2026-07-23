package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewMailOutbox;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface ResumeReviewMailOutboxMapper extends BaseMapper<ResumeReviewMailOutbox> {
    @Select("SELECT id FROM resume_review_mail_outbox WHERE "
            + "((outbox_status IN ('PENDING','FAILED') AND next_attempt_at<=NOW()) "
            + "OR (outbox_status='SENDING' AND updated_at<DATE_SUB(NOW(), INTERVAL 15 MINUTE))) "
            + "ORDER BY next_attempt_at,id LIMIT 20")
    List<Long> selectDueIds();
    @Select("SELECT * FROM resume_review_mail_outbox WHERE id=#{id} FOR UPDATE")
    ResumeReviewMailOutbox selectByIdForUpdate(@Param("id") Long id);
    @Select("SELECT * FROM resume_review_mail_outbox WHERE request_id=#{requestId} FOR UPDATE")
    ResumeReviewMailOutbox selectByRequestForUpdate(@Param("requestId") Long requestId);
    @Select("SELECT * FROM resume_review_mail_outbox WHERE request_id=#{requestId} LIMIT 1")
    ResumeReviewMailOutbox selectByRequest(@Param("requestId") Long requestId);
    @Update("UPDATE resume_review_mail_outbox SET outbox_status='SENDING', attempt_count=attempt_count+1, updated_at=NOW() "
            + "WHERE id=#{id} AND ((outbox_status IN ('PENDING','FAILED') AND next_attempt_at<=NOW()) "
            + "OR (outbox_status='SENDING' AND updated_at<DATE_SUB(NOW(), INTERVAL 15 MINUTE)))")
    int claim(@Param("id") Long id);
}
