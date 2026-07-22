package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeViewOrder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

@Mapper
public interface ResumeViewOrderMapper extends BaseMapper<ResumeViewOrder> {
    @Select("SELECT * FROM resume_view_order WHERE order_no = #{orderNo} LIMIT 1")
    ResumeViewOrder selectByOrderNo(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM resume_view_order WHERE id = #{id} FOR UPDATE")
    ResumeViewOrder selectByIdForUpdate(@Param("id") Long id);

    @Select("SELECT * FROM resume_view_order WHERE order_no = #{orderNo} FOR UPDATE")
    ResumeViewOrder selectByOrderNoForUpdate(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM resume_view_order WHERE id = "
            + "(SELECT order_id FROM creator_earning WHERE id = #{earningId}) FOR UPDATE")
    ResumeViewOrder selectByEarningIdForUpdate(@Param("earningId") Long earningId);

    @Select("SELECT * FROM resume_view_order WHERE buyer_user_id = #{buyerUserId} "
            + "AND idempotency_key = #{idempotencyKey} LIMIT 1")
    ResumeViewOrder selectByIdempotencyKey(@Param("buyerUserId") Long buyerUserId,
                                           @Param("idempotencyKey") String idempotencyKey);

    @Select("SELECT * FROM resume_view_order WHERE active_order_key = #{activeOrderKey} LIMIT 1")
    ResumeViewOrder selectByActiveOrderKey(@Param("activeOrderKey") String activeOrderKey);

    @Select("SELECT * FROM resume_view_order WHERE provider = #{provider} "
            + "AND provider_transaction_id = #{transactionId} LIMIT 1")
    ResumeViewOrder selectByProviderTransaction(@Param("provider") String provider,
                                                @Param("transactionId") String transactionId);

    @Select("SELECT * FROM resume_view_order WHERE provider = #{provider} "
            + "AND refund_reference = #{refundReference} LIMIT 1")
    ResumeViewOrder selectByProviderRefundReference(@Param("provider") String provider,
                                                    @Param("refundReference") String refundReference);

    @Update("UPDATE resume_view_order SET order_status = 'PREPAYING', updated_at = NOW() "
            + "WHERE id = #{id} AND order_status = 'CREATED' AND code_url IS NULL")
    int claimPrepay(@Param("id") Long id);

    @Update("UPDATE resume_view_order SET last_checked_at = NOW(), updated_at = NOW() "
            + "WHERE id = #{id} AND order_status IN ('PREPAY_UNKNOWN', 'PENDING', 'EXPIRED') "
            + "AND (reconcile_lease_until IS NULL OR reconcile_lease_until < NOW()) "
            + "AND (last_checked_at IS NULL OR last_checked_at < DATE_SUB(NOW(), INTERVAL 3 SECOND))")
    int claimProviderQuery(@Param("id") Long id);

    @Update("UPDATE resume_view_order SET order_status = 'CLOSED', active_order_key = NULL, "
            + "closed_at = NOW(), updated_at = NOW() WHERE id = #{id} AND order_status = 'CREATED'")
    int cancelCreatedOrder(@Param("id") Long id);

    @Update("UPDATE resume_view_order SET order_status = 'PREPAY_UNKNOWN', updated_at = NOW() "
            + "WHERE id = #{id} AND order_status = 'PREPAYING' "
            + "AND updated_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)")
    int recoverStalePrepay(@Param("id") Long id);

    @Update("UPDATE resume_view_order SET sale_closed_at = #{closedAt}, sale_close_reason = #{reason}, "
            + "updated_at = NOW() WHERE listing_id = #{listingId} AND active_order_key IS NOT NULL "
            + "AND sale_closed_at IS NULL")
    int markAllOpenOrdersSaleClosed(@Param("listingId") Long listingId,
                                    @Param("closedAt") java.time.LocalDateTime closedAt,
                                    @Param("reason") String reason);

    @Update("UPDATE resume_view_order SET sale_closed_at = #{closedAt}, sale_close_reason = #{reason}, "
            + "updated_at = NOW() WHERE listing_id = #{listingId} AND active_order_key IS NOT NULL "
            + "AND sale_closed_at IS NULL AND listing_revision_id <> #{currentRevisionId}")
    int markOtherRevisionOrdersSaleClosed(@Param("listingId") Long listingId,
                                          @Param("currentRevisionId") Long currentRevisionId,
                                          @Param("closedAt") java.time.LocalDateTime closedAt,
                                          @Param("reason") String reason);

    @Select("SELECT * FROM resume_view_order WHERE sale_closed_at IS NOT NULL "
            + "AND active_order_key IS NOT NULL "
            + "ORDER BY COALESCE(last_checked_at, '1970-01-01 00:00:00') ASC, id ASC LIMIT 100")
    java.util.List<ResumeViewOrder> selectSaleClosedProviderOpenBatch();

    @Select("SELECT * FROM resume_view_order WHERE sale_closed_at IS NOT NULL "
            + "AND active_order_key IS NOT NULL "
            + "ORDER BY COALESCE(last_checked_at, '1970-01-01 00:00:00') ASC, id ASC LIMIT 200")
    java.util.List<ResumeViewOrder> selectOutstandingCloseWork();

    @Select("SELECT id FROM resume_view_order WHERE sale_closed_at IS NULL "
            + "AND active_order_key IS NOT NULL AND provider = #{provider} "
            + "AND (reconcile_lease_until IS NULL OR reconcile_lease_until < NOW()) "
            + "AND ((order_status = 'PREPAYING' "
            + "AND updated_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)) "
            + "OR (order_status IN ('PENDING', 'PREPAY_UNKNOWN', 'EXPIRED') "
            + "AND (last_checked_at IS NULL "
            + "OR last_checked_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)))) "
            + "ORDER BY COALESCE(last_checked_at, '1970-01-01 00:00:00') ASC, id ASC LIMIT 100")
    java.util.List<Long> selectOpenReconciliationCandidateIds(@Param("provider") String provider);

    @Update("UPDATE resume_view_order SET reconcile_lease_token = #{leaseToken}, "
            + "reconcile_lease_until = DATE_ADD(NOW(), INTERVAL 60 SECOND), last_checked_at = NOW(), "
            + "order_status = CASE WHEN order_status = 'PREPAYING' "
            + "THEN 'PREPAY_UNKNOWN' ELSE order_status END "
            + "WHERE id = #{id} AND sale_closed_at IS NULL "
            + "AND active_order_key IS NOT NULL AND provider = #{provider} "
            + "AND (reconcile_lease_until IS NULL OR reconcile_lease_until < NOW()) "
            + "AND ((order_status = 'PREPAYING' "
            + "AND updated_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)) "
            + "OR (order_status IN ('PENDING', 'PREPAY_UNKNOWN', 'EXPIRED') "
            + "AND (last_checked_at IS NULL "
            + "OR last_checked_at < DATE_SUB(NOW(), INTERVAL 30 SECOND))))")
    int claimOpenOrderReconciliation(@Param("id") Long id,
                                     @Param("provider") String provider,
                                     @Param("leaseToken") String leaseToken);

    @Select("SELECT o.id FROM resume_view_order o "
            + "INNER JOIN creator_earning e ON e.order_id = o.id "
            + "WHERE o.provider = #{provider} AND o.order_status = 'PAID' "
            + "AND e.earning_status = 'HOLDING' AND e.available_at IS NOT NULL "
            + "AND (o.reconcile_lease_until IS NULL OR o.reconcile_lease_until < NOW()) "
            + "AND ((e.available_at > NOW() AND (o.last_checked_at IS NULL "
            + "OR o.last_checked_at < #{reconcileBefore})) "
            + "OR (e.available_at <= NOW() AND (o.provider_reconciled_at IS NULL "
            + "OR o.provider_reconciled_at < e.available_at) AND (o.last_checked_at IS NULL "
            + "OR o.last_checked_at < #{dueRetryBefore}))) "
            + "ORDER BY e.available_at ASC, o.id ASC LIMIT 100")
    java.util.List<Long> selectHoldingPaidReconciliationCandidateIds(
            @Param("provider") String provider,
            @Param("reconcileBefore") java.time.LocalDateTime reconcileBefore,
            @Param("dueRetryBefore") java.time.LocalDateTime dueRetryBefore);

    @Update("UPDATE resume_view_order o INNER JOIN creator_earning e ON e.order_id = o.id "
            + "SET o.reconcile_lease_token = #{leaseToken}, "
            + "o.reconcile_lease_until = DATE_ADD(NOW(), INTERVAL 60 SECOND), "
            + "o.last_checked_at = NOW() WHERE o.id = #{id} AND o.provider = #{provider} "
            + "AND o.order_status = 'PAID' AND e.earning_status = 'HOLDING' "
            + "AND e.available_at IS NOT NULL "
            + "AND (o.reconcile_lease_until IS NULL OR o.reconcile_lease_until < NOW()) "
            + "AND ((e.available_at > NOW() AND (o.last_checked_at IS NULL "
            + "OR o.last_checked_at < #{reconcileBefore})) "
            + "OR (e.available_at <= NOW() AND (o.provider_reconciled_at IS NULL "
            + "OR o.provider_reconciled_at < e.available_at) AND (o.last_checked_at IS NULL "
            + "OR o.last_checked_at < #{dueRetryBefore})))")
    int claimHoldingPaidReconciliation(@Param("id") Long id,
                                       @Param("provider") String provider,
                                       @Param("reconcileBefore") java.time.LocalDateTime reconcileBefore,
                                       @Param("dueRetryBefore") java.time.LocalDateTime dueRetryBefore,
                                       @Param("leaseToken") String leaseToken);

    @Update("UPDATE resume_view_order SET reconcile_lease_until = DATE_ADD(NOW(), INTERVAL 60 SECOND) "
            + "WHERE id = #{id} AND reconcile_lease_token = #{leaseToken} "
            + "AND reconcile_lease_until >= NOW()")
    int renewReconciliationLease(@Param("id") Long id,
                                 @Param("leaseToken") String leaseToken);

    @Update("UPDATE resume_view_order SET reconcile_lease_token = NULL, reconcile_lease_until = NULL "
            + "WHERE id = #{id} AND reconcile_lease_token = #{leaseToken}")
    int releaseReconciliationLease(@Param("id") Long id,
                                   @Param("leaseToken") String leaseToken);

    @Update("UPDATE resume_view_order SET order_status = 'EXPIRED', closed_at = NOW(), updated_at = NOW() "
            + "WHERE id = #{id} AND reconcile_lease_token = #{leaseToken} "
            + "AND reconcile_lease_until >= NOW() "
            + "AND sale_closed_at IS NULL AND active_order_key IS NOT NULL "
            + "AND order_status = 'PENDING' AND expires_at <= NOW()")
    int expirePendingUnderReconciliationLease(@Param("id") Long id,
                                              @Param("leaseToken") String leaseToken);
}
