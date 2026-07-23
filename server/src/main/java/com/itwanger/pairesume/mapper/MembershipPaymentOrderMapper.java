package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.MembershipPaymentOrder;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface MembershipPaymentOrderMapper extends BaseMapper<MembershipPaymentOrder> {
    @Select("SELECT * FROM membership_payment_order WHERE order_no = #{orderNo} LIMIT 1")
    MembershipPaymentOrder selectByOrderNo(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM membership_payment_order WHERE order_no = #{orderNo} FOR UPDATE")
    MembershipPaymentOrder selectByOrderNoForUpdate(@Param("orderNo") String orderNo);

    @Select("SELECT * FROM membership_payment_order WHERE id = #{id} FOR UPDATE")
    MembershipPaymentOrder selectByIdForUpdate(@Param("id") Long id);

    @Select("SELECT * FROM membership_payment_order WHERE user_id = #{userId} "
            + "AND idempotency_key = #{idempotencyKey} LIMIT 1")
    MembershipPaymentOrder selectByIdempotencyKey(@Param("userId") Long userId,
                                                   @Param("idempotencyKey") String idempotencyKey);

    @Select("SELECT * FROM membership_payment_order WHERE active_order_key = #{activeOrderKey} LIMIT 1")
    MembershipPaymentOrder selectByActiveOrderKey(@Param("activeOrderKey") String activeOrderKey);

    @Select("SELECT * FROM membership_payment_order WHERE provider = #{provider} "
            + "AND provider_transaction_id = #{transactionId} LIMIT 1")
    MembershipPaymentOrder selectByProviderTransaction(@Param("provider") String provider,
                                                        @Param("transactionId") String transactionId);

    @Select("SELECT * FROM membership_payment_order WHERE user_id = #{userId} "
            + "AND id <> #{orderId} AND order_status = 'PAID' "
            + "AND (created_at > #{createdAt} OR (created_at = #{createdAt} AND id > #{orderId})) "
            + "ORDER BY created_at ASC, id ASC LIMIT 1")
    MembershipPaymentOrder selectPaidReplacementAfter(@Param("userId") Long userId,
                                                       @Param("orderId") Long orderId,
                                                       @Param("createdAt") java.time.LocalDateTime createdAt);

    @Update("UPDATE membership_payment_order SET order_status = 'PREPAYING', updated_at = NOW() "
            + "WHERE id = #{id} AND order_status = 'CREATED' AND payable_amount_cents > 0 "
            + "AND code_url IS NULL AND expires_at > NOW()")
    int claimPrepay(@Param("id") Long id);

    @Update("UPDATE membership_payment_order SET last_checked_at = NOW(), updated_at = NOW() "
            + "WHERE id = #{id} AND order_status IN ('PREPAY_UNKNOWN','PENDING','EXPIRED','CANCELED') "
            + "AND (reconcile_lease_until IS NULL OR reconcile_lease_until < NOW()) "
            + "AND (last_checked_at IS NULL OR last_checked_at < DATE_SUB(NOW(), INTERVAL 3 SECOND))")
    int claimProviderQuery(@Param("id") Long id);

    @Update("UPDATE membership_payment_order SET order_status = 'PREPAY_UNKNOWN', updated_at = NOW() "
            + "WHERE id = #{id} AND order_status = 'PREPAYING' "
            + "AND updated_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)")
    int recoverStalePrepay(@Param("id") Long id);

    @Select("SELECT id FROM membership_payment_order WHERE active_order_key IS NOT NULL "
            + "AND provider = #{provider} AND payable_amount_cents > 0 "
            + "AND (reconcile_lease_until IS NULL OR reconcile_lease_until < NOW()) "
            + "AND ((order_status = 'PREPAYING' AND updated_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)) "
            + "OR (order_status IN ('PENDING','PREPAY_UNKNOWN','EXPIRED') "
            + "AND (last_checked_at IS NULL OR last_checked_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)))) "
            + "ORDER BY COALESCE(last_checked_at, '1970-01-01 00:00:00'), id LIMIT 100")
    List<Long> selectReconciliationCandidateIds(@Param("provider") String provider);

    @Select("SELECT id FROM membership_payment_order WHERE active_order_key IS NOT NULL "
            + "AND order_status = 'CREATED' AND expires_at <= NOW() ORDER BY expires_at, id LIMIT 100")
    List<Long> selectExpiredCreatedCandidateIds();

    @Update("UPDATE membership_payment_order SET order_status = 'CANCELED', active_order_key = NULL, "
            + "code_url = NULL, closed_at = NOW(), updated_at = NOW() "
            + "WHERE id = #{id} AND active_order_key IS NOT NULL "
            + "AND order_status = 'CREATED' AND expires_at <= NOW()")
    int cancelExpiredCreated(@Param("id") Long id);

    @Update("UPDATE membership_payment_order SET reconcile_lease_token = #{leaseToken}, "
            + "reconcile_lease_until = DATE_ADD(NOW(), INTERVAL 60 SECOND), last_checked_at = NOW(), "
            + "order_status = CASE WHEN order_status = 'PREPAYING' THEN 'PREPAY_UNKNOWN' ELSE order_status END "
            + "WHERE id = #{id} AND active_order_key IS NOT NULL AND provider = #{provider} "
            + "AND (reconcile_lease_until IS NULL OR reconcile_lease_until < NOW()) "
            + "AND ((order_status = 'PREPAYING' AND updated_at < DATE_SUB(NOW(), INTERVAL 30 SECOND)) "
            + "OR (order_status IN ('PENDING','PREPAY_UNKNOWN','EXPIRED') "
            + "AND (last_checked_at IS NULL OR last_checked_at < DATE_SUB(NOW(), INTERVAL 30 SECOND))))")
    int claimReconciliation(@Param("id") Long id,
                            @Param("provider") String provider,
                            @Param("leaseToken") String leaseToken);

    @Update("UPDATE membership_payment_order SET order_status = 'EXPIRED', updated_at = NOW() "
            + "WHERE id = #{id} AND reconcile_lease_token = #{leaseToken} "
            + "AND reconcile_lease_until >= NOW() AND active_order_key IS NOT NULL "
            + "AND order_status = 'PENDING' AND expires_at <= NOW()")
    int expirePendingUnderLease(@Param("id") Long id, @Param("leaseToken") String leaseToken);

    @Update("UPDATE membership_payment_order SET reconcile_lease_until = DATE_ADD(NOW(), INTERVAL 60 SECOND) "
            + "WHERE id = #{id} AND reconcile_lease_token = #{leaseToken} "
            + "AND reconcile_lease_until >= NOW()")
    int renewLease(@Param("id") Long id, @Param("leaseToken") String leaseToken);

    @Update("UPDATE membership_payment_order SET reconcile_lease_token = NULL, reconcile_lease_until = NULL "
            + "WHERE id = #{id} AND reconcile_lease_token = #{leaseToken}")
    int releaseLease(@Param("id") Long id, @Param("leaseToken") String leaseToken);

    @Update("UPDATE membership_payment_order SET order_status = 'CANCELED', active_order_key = NULL, "
            + "closed_at = NOW(), code_url = NULL, updated_at = NOW() "
            + "WHERE user_id = #{userId} AND id <> #{settledOrderId} "
            + "AND active_order_key IS NOT NULL AND order_status = 'CREATED'")
    int cancelOtherCreatedOrders(@Param("userId") Long userId,
                                 @Param("settledOrderId") Long settledOrderId);

    @Update("UPDATE membership_payment_order SET order_status = 'EXPIRED', updated_at = NOW() "
            + "WHERE user_id = #{userId} AND id <> #{settledOrderId} "
            + "AND active_order_key IS NOT NULL "
            + "AND order_status IN ('PREPAYING','PREPAY_UNKNOWN','PENDING')")
    int expireOtherProviderOrders(@Param("userId") Long userId,
                                  @Param("settledOrderId") Long settledOrderId);
}
