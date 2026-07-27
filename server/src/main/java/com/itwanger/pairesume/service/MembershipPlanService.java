package com.itwanger.pairesume.service;

import com.itwanger.pairesume.dto.MembershipPlanDTO;
import com.itwanger.pairesume.dto.UpdateMembershipPlanDTO;
import com.itwanger.pairesume.entity.MembershipPlan;

import java.util.List;

public interface MembershipPlanService {
    List<MembershipPlanDTO> listPlans();

    MembershipPlan requirePurchasable(String planCode);

    MembershipPlanDTO updatePlan(String planCode, UpdateMembershipPlanDTO dto, Long adminUserId);
}
