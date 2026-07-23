package com.itwanger.pairesume.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "app.marketplace")
public class MarketplaceFeatureProperties {
    /** User-submitted marketplace content stays fail-closed until operations enables it. */
    private boolean enabled = false;
    private int reportDailyIpLimit = 10;
    private int reportDuplicateWindowHours = 24;
}
