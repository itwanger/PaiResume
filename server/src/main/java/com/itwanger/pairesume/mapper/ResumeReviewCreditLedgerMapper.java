package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewCreditLedger;
import org.apache.ibatis.annotations.*;

@Mapper
public interface ResumeReviewCreditLedgerMapper extends BaseMapper<ResumeReviewCreditLedger> {
    @Select("SELECT * FROM resume_review_credit_ledger WHERE active_entitlement_key=#{key} LIMIT 1")
    ResumeReviewCreditLedger selectActiveEntitlement(@Param("key") String key);
    @Select("SELECT * FROM resume_review_credit_ledger WHERE request_id=#{requestId} FOR UPDATE")
    ResumeReviewCreditLedger selectByRequestForUpdate(@Param("requestId") Long requestId);
}
