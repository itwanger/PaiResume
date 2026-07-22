package com.itwanger.pairesume.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class MarketplacePageDTO<T> {
    private List<T> records;
    private long total;
    private int page;
    private int size;
    private int totalPages;
}
