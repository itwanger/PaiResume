package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeReviewQuotaIdentity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import java.util.List;

@Mapper
public interface ResumeReviewQuotaIdentityMapper extends BaseMapper<ResumeReviewQuotaIdentity> {
    @Select("<script>SELECT * FROM resume_review_quota_identity WHERE identity_hash IN "
            + "<foreach collection='hashes' item='hash' open='(' separator=',' close=')'>#{hash}</foreach> "
            + "ORDER BY created_at,identity_hash LIMIT 1</script>")
    ResumeReviewQuotaIdentity selectAny(@Param("hashes") List<String> hashes);
}
