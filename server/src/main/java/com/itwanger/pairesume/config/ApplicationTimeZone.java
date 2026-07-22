package com.itwanger.pairesume.config;

import java.time.ZoneId;
import java.util.TimeZone;

/**
 * PaiResume stores business timestamps as MySQL DATETIME values. Until those
 * columns are migrated to instants, the application must use one explicit
 * wall-clock zone on every node.
 */
public final class ApplicationTimeZone {
    public static final String ID = "Asia/Shanghai";
    public static final ZoneId ZONE_ID = ZoneId.of(ID);

    private ApplicationTimeZone() {
    }

    public static void enforce() {
        System.setProperty("user.timezone", ID);
        TimeZone.setDefault(TimeZone.getTimeZone(ZONE_ID));
    }
}
