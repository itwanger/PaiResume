package com.itwanger.pairesume.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.itwanger.pairesume.entity.ResumeMarketListing;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface ResumeMarketListingMapper extends BaseMapper<ResumeMarketListing> {
    @Update("""
            UPDATE resume_market_listing
            SET view_count = view_count + 1,
                updated_at = updated_at
            WHERE id = #{listingId}
            """)
    int incrementViewCount(@Param("listingId") Long listingId);

    @Select("SELECT * FROM resume_market_listing WHERE id = #{id} FOR UPDATE")
    ResumeMarketListing selectByIdForUpdate(@Param("id") Long id);

    @Select("""
            SELECT listing_revision_id
            FROM resume_view_entitlement
            WHERE listing_id = #{listingId}
              AND buyer_user_id = #{buyerUserId}
              AND entitlement_status = 'ACTIVE'
            LIMIT 1
            """)
    Long selectActiveEntitlementRevisionId(
            @Param("listingId") Long listingId,
            @Param("buyerUserId") Long buyerUserId
    );

    @Select("""
            <script>
            SELECT l.id
            FROM resume_market_listing l
            JOIN resume_market_listing_revision r ON r.id = l.current_revision_id
            WHERE l.publication_status = 'PUBLISHED'
              AND l.moderation_status = 'APPROVED'
              <if test='accessType != null and accessType != ""'>
                AND l.access_type = #{accessType}
              </if>
              <if test='query != null and query != ""'>
                AND (
                    r.title_snapshot LIKE CONCAT('%', #{query}, '%')
                    OR l.summary LIKE CONCAT('%', #{query}, '%')
                    OR CAST(l.tags AS CHAR) LIKE CONCAT('%', #{query}, '%')
                )
              </if>
            ORDER BY r.created_at DESC, l.id DESC
            LIMIT #{size} OFFSET #{offset}
            </script>
            """)
    List<Long> selectPublishedListingIds(
            @Param("offset") long offset,
            @Param("size") long size,
            @Param("query") String query,
            @Param("accessType") String accessType
    );

    @Select("""
            <script>
            SELECT COUNT(*)
            FROM resume_market_listing l
            JOIN resume_market_listing_revision r ON r.id = l.current_revision_id
            WHERE l.publication_status = 'PUBLISHED'
              AND l.moderation_status = 'APPROVED'
              <if test='accessType != null and accessType != ""'>
                AND l.access_type = #{accessType}
              </if>
              <if test='query != null and query != ""'>
                AND (
                    r.title_snapshot LIKE CONCAT('%', #{query}, '%')
                    OR l.summary LIKE CONCAT('%', #{query}, '%')
                    OR CAST(l.tags AS CHAR) LIKE CONCAT('%', #{query}, '%')
                )
              </if>
            </script>
            """)
    long countPublishedListings(
            @Param("query") String query,
            @Param("accessType") String accessType
    );
}
