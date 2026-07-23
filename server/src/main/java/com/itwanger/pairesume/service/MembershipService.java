package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.CouponQuoteDTO;
import com.itwanger.pairesume.dto.UserAdminDTO;

import java.util.List;

public interface MembershipService {
    CouponQuoteDTO quote(Long userId, String couponCode);

    boolean isActiveMember(Long userId);

    void requireAiAccess(Long userId);

    List<UserAdminDTO> listUsers();

    UserAdminDTO grantMembership(Long userId, Long adminUserId, String reason);

    UserAdminDTO extendMembership(Long userId, int days, Long adminUserId, String reason);

    UserAdminDTO revokeMembership(Long userId, Long adminUserId, String reason);
}
