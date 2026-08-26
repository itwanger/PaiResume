package com.itwanger.pairesume.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class AccountProfileUpdateDTO {
    @NotBlank
    @Size(max = 64)
    private String nickname;

    @Positive
    private Long avatarPhotoId;

    private boolean removeAvatar;
}
