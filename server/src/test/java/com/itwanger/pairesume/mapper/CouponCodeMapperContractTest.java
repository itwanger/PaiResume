package com.itwanger.pairesume.mapper;

import org.apache.ibatis.annotations.Select;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.junit.jupiter.api.Assertions.assertTrue;

class CouponCodeMapperContractTest {

    @Test
    void lockedCouponQueryMapsDatabaseStatusToCouponStatusProperty() throws Exception {
        Select select = CouponCodeMapper.class
                .getMethod("selectByCodeForUpdate", String.class)
                .getAnnotation(Select.class);
        String sql = String.join(" ", Arrays.asList(select.value())).toLowerCase();

        assertTrue(sql.contains("status as coupon_status"));
        assertTrue(sql.contains("for update"));
    }
}
