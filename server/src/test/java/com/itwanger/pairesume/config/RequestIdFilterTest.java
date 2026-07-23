package com.itwanger.pairesume.config;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.junit.jupiter.api.Assertions.*;

class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @Test
    void preservesSafeProxyRequestIdAndClearsMdc() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(RequestIdFilter.HEADER_NAME, "proxy-request-123");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals("proxy-request-123", response.getHeader(RequestIdFilter.HEADER_NAME));
        assertNull(MDC.get("requestId"));
    }

    @Test
    void replacesUnsafeRequestId() throws Exception {
        var request = new MockHttpServletRequest();
        request.addHeader(RequestIdFilter.HEADER_NAME, "bad value\nforged");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        String requestId = response.getHeader(RequestIdFilter.HEADER_NAME);
        assertNotNull(requestId);
        assertNotEquals("bad value\nforged", requestId);
        assertTrue(requestId.matches("[0-9a-f-]{36}"));
    }
}
