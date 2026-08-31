package com.itwanger.pairesume.dto;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumeStyleUpdateDTOTest {

    @Test
    void supportedTemplatesAreAcceptedByStyleValidation() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            ResumeStyleUpdateDTO dto = new ResumeStyleUpdateDTO();
            dto.setPageMode("standard");
            dto.setTemplateId("technical-black");
            dto.setDensity("normal");
            dto.setAccentPreset("auto");
            dto.setHeadingStyle("auto");

            assertTrue(validator.validate(dto).isEmpty());

            dto.setTemplateId("vibe-resume");
            assertTrue(validator.validate(dto).isEmpty());

            dto.setTemplateId("campus-black");
            assertTrue(validator.validate(dto).isEmpty());

            dto.setTemplateId("unknown-template");
            assertFalse(validator.validate(dto).isEmpty());
        }
    }
}
