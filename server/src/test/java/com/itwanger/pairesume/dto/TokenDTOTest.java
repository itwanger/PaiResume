package com.itwanger.pairesume.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TokenDTOTest {

    @Test
    void refreshTokenIsNeverSerializedToTheBrowser() throws Exception {
        var userInfo = new UserInfoDTO(1L, "user@example.com", "", "", "USER", "FREE", null, null, false);
        var token = new TokenDTO("access-token", "refresh-token", 900L, userInfo);

        String json = new ObjectMapper().writeValueAsString(token);

        assertTrue(json.contains("access-token"));
        assertFalse(json.contains("refresh-token"));
        assertFalse(json.contains("refreshToken"));
    }
}
