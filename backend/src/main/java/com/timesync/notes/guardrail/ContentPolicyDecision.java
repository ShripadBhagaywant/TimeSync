package com.timesync.notes.guardrail;
import com.timesync.notes.entity.ContentEligibility;
public record ContentPolicyDecision(ContentEligibility eligibility, VerificationLevel verificationLevel,
                                    ContentReasonCode reasonCode, String reason) {
 public static ContentPolicyDecision unverified(ContentReasonCode reasonCode) {
  return new ContentPolicyDecision(ContentEligibility.UNKNOWN, VerificationLevel.UNVERIFIED,
    reasonCode, "Content has not yet been verified.");
 }
 public static ContentPolicyDecision semantic(ContentEligibility eligibility) {
  ContentReasonCode reason = switch (eligibility) {
   case EDUCATIONAL -> ContentReasonCode.SEMANTIC_EDUCATIONAL;
   case INFORMATIONAL -> ContentReasonCode.SEMANTIC_INFORMATIONAL;
   case ENTERTAINMENT -> ContentReasonCode.SEMANTIC_ENTERTAINMENT;
   case UNKNOWN -> ContentReasonCode.SEMANTIC_UNKNOWN;
  };
  return new ContentPolicyDecision(eligibility, VerificationLevel.SEMANTIC_VERIFIED, reason,
   eligibility.isAllowed() ? "Content is eligible for educational notes."
    : "Content could not be verified as educational or informational.");
 }
}
