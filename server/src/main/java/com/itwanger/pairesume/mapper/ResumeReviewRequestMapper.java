package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewRequest;
import org.apache.ibatis.annotations.*;
import java.util.List;

@Mapper
public interface ResumeReviewRequestMapper extends BaseMapper<ResumeReviewRequest> {
    @Select("SELECT * FROM resume_review_request WHERE request_no=#{requestNo} LIMIT 1")
    ResumeReviewRequest selectByRequestNo(@Param("requestNo") String requestNo);

    @Select("SELECT * FROM resume_review_request WHERE request_no=#{requestNo} FOR UPDATE")
    ResumeReviewRequest selectByRequestNoForUpdate(@Param("requestNo") String requestNo);

    @Select("SELECT * FROM resume_review_request WHERE user_id=#{userId} AND idempotency_key=#{key} LIMIT 1")
    ResumeReviewRequest selectIdempotent(@Param("userId") Long userId, @Param("key") String key);

    @Select("SELECT * FROM resume_review_request WHERE active_user_key=#{key} LIMIT 1")
    ResumeReviewRequest selectActive(@Param("key") String key);

    @Select("SELECT * FROM resume_review_request WHERE order_no=#{orderNo} FOR UPDATE")
    ResumeReviewRequest selectByOrderNoForUpdate(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM resume_review_request WHERE id=#{id} FOR UPDATE")
    ResumeReviewRequest selectByIdForUpdate(@Param("id") Long id);

    @Select("SELECT id FROM resume_review_request WHERE entitlement_type='PAID' "
            + "AND payment_status IN ('CREATED','PREPAY_UNKNOWN','PENDING') "
            + "AND payment_expires_at<=NOW() ORDER BY payment_expires_at,id LIMIT 100")
    List<Long> selectExpiredPaymentCandidateIds();

    @Select("SELECT * FROM resume_review_request WHERE provider=#{provider} AND provider_transaction_id=#{tx} LIMIT 1")
    ResumeReviewRequest selectByProviderTransaction(@Param("provider") String provider, @Param("tx") String tx);

    @Select("SELECT * FROM resume_review_request ORDER BY "
            + "CASE WHEN request_status='ACCEPTED' THEN 0 "
            + "WHEN request_status IN ('EMAIL_PENDING','EMAILED') THEN 1 ELSE 2 END, "
            + "CASE WHEN request_status='ACCEPTED' THEN accepted_at END, "
            + "CASE WHEN request_status IN ('EMAIL_PENDING','EMAILED') THEN priority_fee_cents END DESC, "
            + "CASE WHEN request_status IN ('EMAIL_PENDING','EMAILED') AND priority_fee_cents>0 THEN paid_at END, "
            + "CASE WHEN request_status IN ('EMAIL_PENDING','EMAILED') AND priority_fee_cents=0 THEN queued_at END, "
            + "created_at DESC, id DESC LIMIT 300")
    List<ResumeReviewRequest> selectAdminQueue();

    @Select("SELECT * FROM resume_review_request "
            + "WHERE request_status IN ('EMAILED','ACCEPTED') "
            + "ORDER BY CASE WHEN request_status='ACCEPTED' THEN 0 ELSE 1 END, "
            + "CASE WHEN request_status='ACCEPTED' THEN accepted_at END, "
            + "priority_fee_cents DESC, "
            + "CASE WHEN priority_fee_cents>0 THEN paid_at END, "
            + "CASE WHEN priority_fee_cents=0 THEN queued_at END, id LIMIT 300")
    List<ResumeReviewRequest> selectPublicQueue();

    @Select("SELECT COUNT(*) FROM resume_review_request r "
            + "LEFT JOIN resume_review_mail_outbox o ON o.request_id=r.id "
            + "WHERE r.request_status IN ('EMAILED','ACCEPTED','REFUND_REQUIRED') OR "
            + "(r.request_status='EMAIL_PENDING' AND o.outbox_status='FAILED')")
    long countAdminActionQueue();

    @Select("SELECT COUNT(*) FROM resume_review_request WHERE user_id=#{userId} AND request_status IN "
            + "('AWAITING_PAYMENT','EMAIL_PENDING','EMAILED','ACCEPTED','REFUND_REQUIRED')")
    int countAccountDeletionBlockers(@Param("userId") Long userId);

    @Update("UPDATE resume_review_request SET contact_email=CONCAT('deleted-review-', id, '@invalid.local'), "
            + "snapshot_json='{}', content_hash=SHA2('{}', 256), "
            + "pdf_object_key=NULL, pdf_object_etag=NULL, pdf_original_file_name=NULL, "
            + "pdf_size_bytes=NULL, pdf_sha256=NULL, updated_at=NOW() "
            + "WHERE user_id=#{userId} AND request_status IN ('COMPLETED','RETURNED','REFUNDED')")
    int anonymizeTerminalRequests(@Param("userId") Long userId);
}
