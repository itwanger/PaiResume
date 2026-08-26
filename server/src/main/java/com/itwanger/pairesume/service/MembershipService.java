package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.dto.MarketplacePageDTO;
import com.itwanger.pairesume.dto.UserAdminDTO;

public interface MembershipService {
    CouponQuoteDTO quote(Long userId, String planCode, String couponCode);

    default CouponQuoteDTO quote(Long userId, String couponCode) {
        return quote(userId, "ANNUAL", couponCode);
    }

    boolean isActiveMember(Long userId);

    void requireAiAccess(Long userId);

    MarketplacePageDTO<UserAdminDTO> listUsers(int page, int size, String keyword, String membershipStatus);

    UserAdminDTO extendMembership(Long userId, int days, Long adminUserId, String reason);

    UserAdminDTO revokeMembership(Long userId, Long adminUserId, String reason);
}
