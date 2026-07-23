package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.MarketplaceListingReport;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.LocalDateTime;

@Mapper
public interface MarketplaceListingReportMapper extends BaseMapper<MarketplaceListingReport> {
    @Select("SELECT COUNT(*) FROM marketplace_listing_report "
            + "WHERE reporter_ip_hash = #{ipHash} AND created_at >= #{since}")
    long countRecentByIpHash(@Param("ipHash") String ipHash,
                             @Param("since") LocalDateTime since);

    @Select("SELECT COUNT(*) FROM marketplace_listing_report "
            + "WHERE fingerprint = #{fingerprint} AND created_at >= #{since}")
    long countRecentByFingerprint(@Param("fingerprint") String fingerprint,
                                  @Param("since") LocalDateTime since);

    @Select("SELECT * FROM marketplace_listing_report WHERE id = #{id} FOR UPDATE")
    MarketplaceListingReport selectByIdForUpdate(@Param("id") Long id);
}
