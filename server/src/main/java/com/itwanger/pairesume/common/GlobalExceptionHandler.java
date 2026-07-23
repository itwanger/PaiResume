package com.itwanger.pairesume.common;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        var message = e.getBindingResult().getFieldErrors().stream()
            .map(f -> f.getField() + ": " + f.getDefaultMessage())
            .reduce((a, b) -> a + "; " + b)
            .orElse("参数校验失败");
        return Result.error(400, message);
    }

    @ExceptionHandler(AuthenticationException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public Result<Void> handleAuth(AuthenticationException e) {
        return Result.error(ResultCode.UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public Result<Void> handleAccessDenied(AccessDeniedException e) {
        return Result.error(ResultCode.FORBIDDEN);
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusiness(BusinessException e) {
        HttpStatus status = businessStatus(e.getCode());
        var response = ResponseEntity.status(status);
        if (status == HttpStatus.TOO_MANY_REQUESTS) {
            long retryAfter = e.getCode() == ResultCode.LOGIN_TOO_MANY_ATTEMPTS.getCode()
                    || e.getCode() == ResultCode.VIP_INVITE_RATE_LIMITED.getCode()
                    ? 900L : 60L;
            response.header(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfter));
        }
        return response.body(Result.error(e.getCode(), e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public Result<Void> handleException(Exception e) {
        log.error("Unexpected error: errorType={}", e.getClass().getSimpleName());
        return Result.error(ResultCode.INTERNAL_ERROR);
    }

    private HttpStatus businessStatus(int code) {
        if (code == ResultCode.INTERNAL_ERROR.getCode()) {
            return HttpStatus.INTERNAL_SERVER_ERROR;
        }
        if (code == ResultCode.EMAIL_EXISTS.getCode()) {
            return HttpStatus.CONFLICT;
        }
        if (code == ResultCode.LOGIN_FAILED.getCode()
                || code == ResultCode.WECHAT_CHALLENGE_INVALID.getCode()
                || code == ResultCode.WECHAT_BRIDGE_SIGNATURE_INVALID.getCode()
                || code == ResultCode.RESUME_REVIEW_FOLLOW_BRIDGE_INVALID.getCode()
                || code == ResultCode.REFRESH_TOKEN_INVALID.getCode()
                || code == ResultCode.REFRESH_TOKEN_EXPIRED.getCode()
                || code == ResultCode.UNAUTHORIZED.getCode()) {
            return HttpStatus.UNAUTHORIZED;
        }
        if (code == ResultCode.ACCOUNT_LOCKED.getCode()
                || code == ResultCode.FORBIDDEN.getCode()
                || code == ResultCode.LEGAL_CONSENT_REQUIRED.getCode()
                || code == ResultCode.WECHAT_REAUTH_REQUIRED.getCode()
                || code == ResultCode.MARKET_ORDER_FORBIDDEN.getCode()
                || code == ResultCode.MEMBERSHIP_ORDER_FORBIDDEN.getCode()
                || code == ResultCode.RESUME_REVIEW_FORBIDDEN.getCode()
                || code == ResultCode.VIP_INVITE_CLAIM_FORBIDDEN.getCode()
                || code == ResultCode.MEMBERSHIP_REQUIRED.getCode()
                || code == ResultCode.AI_MEMBERSHIP_REQUIRED.getCode()
                || code == ResultCode.SHOWCASE_MEMBERSHIP_REQUIRED.getCode()) {
            return HttpStatus.FORBIDDEN;
        }
        if (code == ResultCode.SEND_CODE_TOO_FREQUENT.getCode()
                || code == ResultCode.SEND_CODE_LIMIT_EXCEEDED.getCode()
                || code == ResultCode.LOGIN_TOO_MANY_ATTEMPTS.getCode()
                || code == ResultCode.WECHAT_CHALLENGE_RATE_LIMITED.getCode()
                || code == ResultCode.VIP_INVITE_RATE_LIMITED.getCode()
                || code == ResultCode.MARKET_REPORT_RATE_LIMITED.getCode()) {
            return HttpStatus.TOO_MANY_REQUESTS;
        }
        if (code == ResultCode.MAIL_NOT_CONFIGURED.getCode()
                || code == ResultCode.MAIL_SEND_FAILED.getCode()
                || code == ResultCode.WECHAT_LOGIN_NOT_ENABLED.getCode()
                || code == ResultCode.WECHAT_GATEWAY_UNAVAILABLE.getCode()
                || code == ResultCode.PAYMENT_NOT_ENABLED.getCode()
                || code == ResultCode.RESUME_REVIEW_PAID_NOT_ENABLED.getCode()
                || code == ResultCode.MARKETPLACE_DISABLED.getCode()) {
            return HttpStatus.SERVICE_UNAVAILABLE;
        }
        if (code == ResultCode.USER_NOT_FOUND.getCode()
                || code == ResultCode.VIP_INVITE_REDEMPTION_NOT_FOUND.getCode()
                || code == ResultCode.MARKET_LISTING_NOT_FOUND.getCode()
                || code == ResultCode.MARKET_ORDER_NOT_FOUND.getCode()
                || code == ResultCode.MEMBERSHIP_ORDER_NOT_FOUND.getCode()
                || code == ResultCode.RESUME_REVIEW_NOT_FOUND.getCode()
                || code == ResultCode.MARKET_REPORT_NOT_FOUND.getCode()
                || code == ResultCode.MARKET_APPEAL_NOT_FOUND.getCode()
                || code == ResultCode.CREATOR_EARNING_NOT_FOUND.getCode()) {
            return HttpStatus.NOT_FOUND;
        }
        if (code == ResultCode.MARKET_ALREADY_UNLOCKED.getCode()
                || code == ResultCode.ACCOUNT_DELETION_BLOCKED.getCode()
                || code == ResultCode.WECHAT_IDENTITY_CONFLICT.getCode()
                || code == ResultCode.WECHAT_CHALLENGE_CONSUMED.getCode()
                || code == ResultCode.RESUME_REVIEW_ACTIVE_EXISTS.getCode()
                || code == ResultCode.RESUME_REVIEW_FOLLOW_REWARD_EXISTS.getCode()
                || code == ResultCode.RESUME_REVIEW_REFUND_REFERENCE_CONFLICT.getCode()
                || code == ResultCode.CREATOR_EARNING_ALREADY_SETTLED.getCode()
                || code == ResultCode.MARKET_GOVERNANCE_ALREADY_HANDLED.getCode()
                || code == ResultCode.PAYMENT_REFUND_REFERENCE_CONFLICT.getCode()) {
            return HttpStatus.CONFLICT;
        }
        if (code == ResultCode.PAYMENT_ORDER_EXPIRED.getCode()
                || code == ResultCode.WECHAT_CHALLENGE_EXPIRED.getCode()) {
            return HttpStatus.GONE;
        }
        return HttpStatus.BAD_REQUEST;
    }
}
