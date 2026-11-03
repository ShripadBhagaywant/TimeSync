package com.timesync.notes.guardrail;
import com.timesync.notes.entity.ContentEligibility;
import static com.timesync.notes.guardrail.ContentReasonCode.*;

public final class MetadataContentPolicy {
 private final MetadataSignalExtractor extractor = new MetadataSignalExtractor();
 public ContentPolicyDecision evaluate(String title, String channel, String category) {
  var s = extractor.extract(title, channel, category == null ? "" : category.trim());
  // Learning signals defer to semantic verification; they never grant approval.
  // "Explained" in a plot summary alone does not establish instructional purpose.
  boolean protection = s.technical() || s.academic() || (s.instructional() && !s.plotSummary());
  if (protection) return ContentPolicyDecision.unverified(METADATA_INCONCLUSIVE);
  ContentReasonCode reason = null;
  if (s.media() && (s.review() || s.spoiler() || s.plotSummary() || s.reaction())) reason = ENTERTAINMENT_MEDIA_REVIEW;
  else if (s.trailer() && (s.media() || s.entertainmentCategory())) reason = MOVIE_TRAILER;
  else if (s.sports() && (s.reaction() || s.highlights())) reason = SPORTS_REACTION_ENTERTAINMENT;
  else if (s.gaming() && (s.reaction() || s.highlights())) reason = GAMING_ENTERTAINMENT;
  else if (s.music() && (s.musicVideo() || s.musicChannel())) reason = MUSIC_CONTENT;
  else if (s.celebrity() && s.reaction()) reason = CELEBRITY_ENTERTAINMENT;
  else if (s.vlog()) reason = VLOG_CONTENT;
  else if (s.promotional()) reason = PROMOTIONAL_PRIMARY_PURPOSE;
  return reason == null ? ContentPolicyDecision.unverified(METADATA_INCONCLUSIVE)
   : new ContentPolicyDecision(ContentEligibility.ENTERTAINMENT, VerificationLevel.METADATA_VERIFIED,
     reason, "The video's primary purpose appears to be entertainment or promotion.");
 }
}
