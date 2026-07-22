package com.itwanger.pairesume.service.impl;

import com.itwanger.pairesume.entity.ResumeMarketListingRevision;
import com.itwanger.pairesume.entity.ResumeViewOrder;

record MarketplaceOrderDecision(
        ResumeViewOrder order,
        ResumeMarketListingRevision revision
) {
}
