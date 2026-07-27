package com.itwanger.pairesume.dto;

import com.itwanger.pairesume.controller.ResumeController;
import jakarta.validation.Valid;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ResumeCreateDTOTest {

    @Test
    void resumeTitleIsRequiredAndLimitedToDatabaseColumnLength() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            ResumeCreateDTO dto = new ResumeCreateDTO();

            assertEquals(1, validator.validate(dto).size());

            dto.setTitle("   ");
            assertEquals(1, validator.validate(dto).size());

            dto.setTitle("Java 后端求职简历");
            assertTrue(validator.validate(dto).isEmpty());

            dto.setTitle("简".repeat(129));
            assertEquals(1, validator.validate(dto).size());
        }
    }

    @Test
    void createEndpointActivatesBeanValidation() throws NoSuchMethodException {
        var method = ResumeController.class.getMethod("create", ResumeCreateDTO.class);

        assertTrue(method.getParameters()[0].isAnnotationPresent(Valid.class));
    }

    @Test
    void importedResumeAlsoRequiresAName() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            ResumeImportDTO dto = new ResumeImportDTO();

            dto.setTitle("   ");
            assertTrue(validator.validate(dto).stream()
                    .anyMatch(violation -> violation.getPropertyPath().toString().equals("title")));
        }
    }

    @Test
    void renamedResumeUsesTheSameDatabaseLengthLimit() {
        try (var factory = Validation.buildDefaultValidatorFactory()) {
            var validator = factory.getValidator();
            ResumeUpdateDTO dto = new ResumeUpdateDTO();

            dto.setTitle("简".repeat(129));
            assertEquals(1, validator.validate(dto).size());
        }
    }
}
