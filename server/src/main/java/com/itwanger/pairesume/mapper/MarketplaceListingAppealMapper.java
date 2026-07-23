package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.MarketplaceListingAppeal;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface MarketplaceListingAppealMapper extends BaseMapper<MarketplaceListingAppeal> {
    @Select("SELECT COUNT(*) FROM marketplace_listing_appeal "
            + "WHERE listing_id = #{listingId} AND appeal_status = 'OPEN'")
    long countOpenByListingId(@Param("listingId") Long listingId);

    @Select("SELECT * FROM marketplace_listing_appeal WHERE id = #{id} FOR UPDATE")
    MarketplaceListingAppeal selectByIdForUpdate(@Param("id") Long id);
}
