package com.itwanger.pairesume.common;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void pdfMembershipRequirementUsesForbiddenStatus() {
        var response = handler.handleBusiness(new BusinessException(ResultCode.MEMBERSHIP_REQUIRED));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(ResultCode.MEMBERSHIP_REQUIRED.getCode(), response.getBody().getCode());
    }

    @Test
    void showcaseMembershipRequirementUsesForbiddenStatus() {
        var response = handler.handleBusiness(new BusinessException(ResultCode.SHOWCASE_MEMBERSHIP_REQUIRED));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(ResultCode.SHOWCASE_MEMBERSHIP_REQUIRED.getCode(), response.getBody().getCode());
    }

    @Test
    void aiMembershipRequirementUsesForbiddenStatus() {
        var response = handler.handleBusiness(new BusinessException(ResultCode.AI_MEMBERSHIP_REQUIRED));

        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(ResultCode.AI_MEMBERSHIP_REQUIRED.getCode(), response.getBody().getCode());
    }

    @Test
    void inviteAttemptLimitUsesTooManyRequestsStatus() {
        var response = handler.handleBusiness(new BusinessException(ResultCode.VIP_INVITE_RATE_LIMITED));

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, response.getStatusCode());
        assertEquals("900", response.getHeaders().getFirst("Retry-After"));
        assertEquals(ResultCode.VIP_INVITE_RATE_LIMITED.getCode(), response.getBody().getCode());
    }

    @Test
    void marketplaceResourcesUseNotFoundStatus() {
        assertEquals(HttpStatus.NOT_FOUND,
                handler.handleBusiness(new BusinessException(ResultCode.MARKET_LISTING_NOT_FOUND)).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND,
                handler.handleBusiness(new BusinessException(ResultCode.MARKET_ORDER_NOT_FOUND)).getStatusCode());
        assertEquals(HttpStatus.NOT_FOUND,
                handler.handleBusiness(new BusinessException(ResultCode.CREATOR_EARNING_NOT_FOUND)).getStatusCode());
    }

    @Test
    void marketplaceOrderOwnershipUsesForbiddenStatus() {
        assertEquals(HttpStatus.FORBIDDEN,
                handler.handleBusiness(new BusinessException(ResultCode.MARKET_ORDER_FORBIDDEN)).getStatusCode());
    }

    @Test
    void inviteClaimOwnershipUsesForbiddenStatus() {
        assertEquals(HttpStatus.FORBIDDEN,
                handler.handleBusiness(
                        new BusinessException(ResultCode.VIP_INVITE_CLAIM_FORBIDDEN)
                ).getStatusCode());
    }

    @Test
    void disabledPaymentUsesServiceUnavailableStatus() {
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                handler.handleBusiness(new BusinessException(ResultCode.PAYMENT_NOT_ENABLED)).getStatusCode());
    }

    @Test
    void invalidPaymentNotificationNeverReturnsSuccessStatus() {
        assertEquals(HttpStatus.BAD_REQUEST,
                handler.handleBusiness(new BusinessException(ResultCode.PAYMENT_NOTIFICATION_INVALID)).getStatusCode());
    }

    @Test
    void reusedRefundReferenceUsesConflictStatus() {
        assertEquals(HttpStatus.CONFLICT,
                handler.handleBusiness(
                        new BusinessException(ResultCode.PAYMENT_REFUND_REFERENCE_CONFLICT)).getStatusCode());
    }
}
