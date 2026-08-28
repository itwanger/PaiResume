package com.itwanger.pairesume.payment;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Generates provider-facing merchant order numbers that satisfy WeChat Pay's
 * 32-character {@code out_trade_no} limit.
 */
public final class PaymentOrderNoGenerator {
    public static final int MAX_LENGTH = 32;
    private static final Pattern PREFIX_PATTERN = Pattern.compile("[A-Z0-9]{1,8}");
    private static final Pattern PROVIDER_ORDER_NO_PATTERN =
            Pattern.compile("[A-Za-z0-9_|*-]{6,32}");

    private PaymentOrderNoGenerator() {
    }

    public static String generate(String prefix) {
        if (prefix == null || !PREFIX_PATTERN.matcher(prefix).matches()) {
            throw new IllegalArgumentException("Payment order prefix must contain 1-8 uppercase letters or digits");
        }
        String uuidHex = UUID.randomUUID().toString().replace("-", "");
        return prefix + uuidHex.substring(0, MAX_LENGTH - prefix.length());
    }

    public static String requireProviderCompatible(String orderNo) {
        if (orderNo == null || !PROVIDER_ORDER_NO_PATTERN.matcher(orderNo).matches()) {
            throw new IllegalArgumentException(
                    "Payment order number must contain 6-32 provider-supported characters");
        }
        return orderNo;
    }
}
