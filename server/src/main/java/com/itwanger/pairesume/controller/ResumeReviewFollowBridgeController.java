package com.itwanger.pairesume.controller;

import com.itwanger.pairesume.service.ResumeReviewService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/public/resume-reviews")
@RequiredArgsConstructor
public class ResumeReviewFollowBridgeController {
    private final ResumeReviewService service;

    @PostMapping("/follow-events")
    public ResponseEntity<Void> followEvent(
            @RequestHeader("X-Review-Timestamp") String timestamp,
            @RequestHeader("X-Review-Nonce") String nonce,
            @RequestHeader("X-Review-Signature") String signature,
            @RequestBody String rawBody) {
        service.handleFollowBridgeEvent(timestamp, nonce, signature, rawBody);
        return ResponseEntity.noContent().build();
    }
}
