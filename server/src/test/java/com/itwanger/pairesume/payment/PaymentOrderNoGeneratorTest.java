package com.itwanger.pairesume.payment;

import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PaymentOrderNoGeneratorTest {
    @Test
    void generatesUniqueProviderCompatibleNumbersForEveryPaymentFlow() {
        Set<String> generated = new HashSet<>();

        for (String prefix : new String[]{"PO", "PM", "PR", "PS"}) {
            for (int index = 0; index < 100; index++) {
                String orderNo = PaymentOrderNoGenerator.generate(prefix);
                assertTrue(orderNo.startsWith(prefix));
                assertEquals(32, orderNo.length());
                assertEquals(orderNo, PaymentOrderNoGenerator.requireProviderCompatible(orderNo));
                assertTrue(generated.add(orderNo));
            }
        }
    }

    @Test
    void rejectsOrderNumbersOutsideProviderContract() {
        assertThrows(IllegalArgumentException.class,
                () -> PaymentOrderNoGenerator.requireProviderCompatible("PO" + "a".repeat(32)));
        assertThrows(IllegalArgumentException.class,
                () -> PaymentOrderNoGenerator.requireProviderCompatible("bad order"));
    }
}
