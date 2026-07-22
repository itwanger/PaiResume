package com.itwanger.pairesume.mapper;

import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumeViewOrderMapperContractTest {

    @Test
    void closeWorkerBatchRotatesPreviouslyCheckedPoisonOrdersBehindUntouchedWork() throws Exception {
        Select select = ResumeViewOrderMapper.class
                .getMethod("selectSaleClosedProviderOpenBatch")
                .getAnnotation(Select.class);
        String sql = String.join(" ", Arrays.asList(select.value()));

        assertTrue(sql.contains("COALESCE(last_checked_at"));
        assertTrue(sql.contains("LIMIT 100"));
    }

    @Test
    void ordinaryReconciliationOnlyScansInSaleProviderQueryableWork() throws Exception {
        Select select = ResumeViewOrderMapper.class
                .getMethod("selectOpenReconciliationCandidateIds", String.class)
                .getAnnotation(Select.class);
        String sql = String.join(" ", Arrays.asList(select.value()));

        assertTrue(sql.contains("sale_closed_at IS NULL"));
        assertTrue(sql.contains("active_order_key IS NOT NULL"));
        assertTrue(sql.contains("provider = #{provider}"));
        assertTrue(sql.contains("'PENDING', 'PREPAY_UNKNOWN', 'EXPIRED'"));
        assertTrue(sql.contains("order_status = 'PREPAYING'"));
        assertTrue(sql.contains("reconcile_lease_until"));
        assertTrue(sql.contains("LIMIT 100"));
    }

    @Test
    void reconciliationClaimIsAtomicAndPersistentAcrossNodes() throws Exception {
        Update update = ResumeViewOrderMapper.class
                .getMethod("claimOpenOrderReconciliation", Long.class, String.class, String.class)
                .getAnnotation(Update.class);
        String sql = String.join(" ", Arrays.asList(update.value()));

        assertTrue(sql.contains("reconcile_lease_token = #{leaseToken}"));
        assertTrue(sql.contains("reconcile_lease_until = DATE_ADD(NOW(), INTERVAL 60 SECOND)"));
        assertTrue(sql.contains("reconcile_lease_until IS NULL OR reconcile_lease_until < NOW()"));
        assertTrue(sql.contains("last_checked_at = NOW()"));
        assertTrue(sql.contains("WHEN order_status = 'PREPAYING' THEN 'PREPAY_UNKNOWN'"));
    }

    @Test
    void browserRefreshCannotBypassActiveScheduledReconciliationLease() throws Exception {
        Update update = ResumeViewOrderMapper.class
                .getMethod("claimProviderQuery", Long.class)
                .getAnnotation(Update.class);
        String sql = String.join(" ", Arrays.asList(update.value()));

        assertTrue(sql.contains("reconcile_lease_until IS NULL OR reconcile_lease_until < NOW()"));
    }
}
