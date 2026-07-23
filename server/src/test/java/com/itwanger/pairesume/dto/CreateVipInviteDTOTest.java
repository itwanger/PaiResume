package com.itwanger.pairesume.dto;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CreateVipInviteDTOTest {

    @Test
    void membershipDaysMustUseAnApprovedPlanetBenefitDuration() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            CreateVipInviteDTO dto = new CreateVipInviteDTO();

            dto.setMembershipDays(30);
            assertTrue(validator.validate(dto).isEmpty());

            dto.setMembershipDays(90);
            assertTrue(validator.validate(dto).isEmpty());

            dto.setMembershipDays(365);
            assertTrue(validator.validate(dto).isEmpty());

            dto.setMembershipDays(31);
            assertEquals(1, validator.validate(dto).size());

            dto.setMembershipDays(366);
            assertEquals(2, validator.validate(dto).size());
        }
    }
}
