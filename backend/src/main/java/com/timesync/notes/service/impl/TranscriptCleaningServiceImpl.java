package com.timesync.notes.service.impl;

import com.timesync.notes.model.ChapterDiscoveryResult;

import com.timesync.notes.dto.request.ExtractVideoRequest;
import com.timesync.notes.dto.request.ImportTranscriptRequest;
import com.timesync.notes.dto.request.RefineTranscriptRequest;
import com.timesync.notes.dto.response.ChapterDto;
import com.timesync.notes.dto.response.TranscriptResponse;
import com.timesync.notes.dto.response.TranscriptSegmentDto;
import com.timesync.notes.entity.CleaningStage;
import com.timesync.notes.entity.ContentEligibility;
import com.timesync.notes.entity.NoteSource;
import com.timesync.notes.entity.TranscriptAvailability;
import com.timesync.notes.entity.AiProcessingStatus;
import com.timesync.notes.exception.YoutubeBusyException;
import com.timesync.notes.exception.UnprocessableVideoException;
import com.timesync.notes.exception.UpstreamRateLimitException;
import com.timesync.notes.exception.UpstreamServiceUnavailableException;
import com.timesync.notes.guardrail.EducationalContentClassifier;
import com.timesync.notes.guardrail.ContentPolicyDecision;
import com.timesync.notes.guardrail.ContentReasonCode;
import com.timesync.notes.exception.NonEducationalContentException;
import com.timesync.notes.model.ExtractedTranscript;
import com.timesync.notes.service.note.TranscriptDraftFormatter;
import com.timesync.notes.service.AiNoteJobService;
import com.timesync.notes.service.TranscriptCleaningService;
import com.timesync.notes.service.VideoExtractionService;
import com.timesync.notes.strategy.RegexCleaningStrategy;
import com.timesync.notes.integration.youtube.YoutubeUrlParser;
import com.timesync.notes.util.PastedTranscriptParser;
import com.timesync.notes.util.YoutubeTranscriptPasteNormalizer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import com.timesync.notes.integration.youtube.YoutubeSingleFlight;
import com.timesync.notes.integration.youtube.YoutubeTranscriptCache;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class TranscriptCleaningServiceImpl implements TranscriptCleaningService {

    private final VideoExtractionService extractionService;
    private final RegexCleaningStrategy regexCleaningStrategy;
    private final EducationalContentClassifier educationalContentClassifier;
    private final AiNoteJobService aiNoteJobService;
    private final PastedTranscriptParser pastedTranscriptParser;
    private final TranscriptDraftFormatter transcriptDraftFormatter;
    private final YoutubeSingleFlight singleFlight;
    private final YoutubeTranscriptCache transcriptCache;

    @Override
    public TranscriptResponse extractAndProcess(ExtractVideoRequest request) {
        String videoId = YoutubeUrlParser.extractVideoId(request.url());
        return singleFlight.execute(videoId, () -> transcriptCache.getOrExtract(videoId, () -> extractSource(videoId)));
    }

    private TranscriptResponse extractSource(String videoId) {

        String title = extractionService.getVideoTitle(videoId);
        String channelName = extractionService.getVideoChannelName(videoId);
        String categoryId = extractionService.getVideoCategoryId(videoId);
        String duration = extractionService.getVideoDuration(videoId);

        // Tier 1: cheap metadata guardrail before transcript extraction.
        ContentEligibility metadataEligibility = precheck(videoId,
                title,
                channelName,
                categoryId
        );

        var chapterResult = safeDiscoverChapters(videoId);
        List<ChapterDto> chapters = chapterResult.chapters();

        ExtractedTranscript extractedTranscript;
        try {
            extractedTranscript = extractionService.extractTranscript(videoId, "Original");
        } catch (UnprocessableVideoException ex) {
            if (!"CAPTIONS_UNAVAILABLE".equals(ex.getErrorCode())) {
                throw ex;
            }

            log.info("Captions are unavailable for video {}. Returning metadata-only workspace.", videoId);
            logDecision(videoId, ContentPolicyDecision.unverified(ContentReasonCode.TRANSCRIPT_UNAVAILABLE));
            return createMetadataOnlyResponse(videoId, title, channelName, duration, chapters).withChapterAvailability(chapterResult.availability());
        } catch (UpstreamServiceUnavailableException ex) {
            if ("YOUTUBE_BOT_CHECK".equals(ex.getErrorCode())) {
                log.warn("YouTube bot-check blocked caption discovery. operation=WATCH_PAGE, scope=WATCH_PAGE, videoId={}. Opening a workspace for manual transcript import; transcript remains unverified.", videoId);
                ContentPolicyDecision decision = ContentPolicyDecision.unverified(ContentReasonCode.TRANSCRIPT_UNAVAILABLE);
                logDecision(videoId, decision);
                return createMetadataOnlyResponse(videoId, title, channelName, duration, chapters)
                        .withChapterAvailability(chapterResult.availability())
                        .withContentPolicy(decision);
            }

            log.warn("Transcript extraction is temporarily unavailable for video {}. Cause: {}",
                    videoId, ex.getClass().getSimpleName());
            throw ex;
        } catch (UpstreamRateLimitException ex) {
            log.warn("YouTube transcript access was rate-limited for video {}. retryAfterSeconds={}",
                    videoId, ex.getRetryAfterSeconds());
            throw ex;
        }

        // Tier 2: semantic guardrail over normalized transcript evidence.
        String sanitizedTranscript = regexCleaningStrategy.clean(
                extractedTranscript.content(),
                extractedTranscript.languageCode(),
                title
        );

        log.debug("Caption cleaning result. videoId={}, parsedSegments={}, sourceCharacters={}, cleanedCharacters={}, reason={}",
                videoId, extractedTranscript.segments().size(), extractedTranscript.content().length(),
                sanitizedTranscript == null ? 0 : sanitizedTranscript.length(),
                sanitizedTranscript == null || sanitizedTranscript.isBlank() ? "POST_PARSE_EMPTY" : "OK");
        ContentPolicyDecision decision = verifyContent(videoId,
                title,
                channelName,
                categoryId,
                sanitizedTranscript,
                extractedTranscript.languageCode(),
                metadataEligibility
        );

        return processTranscript(
                videoId,
                title,
                channelName,
                duration,
                chapters,
                extractedTranscript,
                NoteSource.CAPTIONS,
                TranscriptAvailability.AVAILABLE,
                null
        ).withChapterAvailability(chapterResult.availability()).withContentPolicy(decision);
    }

    /** Workspace availability does not establish semantic or AI eligibility. */
    private TranscriptResponse createMetadataOnlyResponse(
            String videoId, String title, String channelName, String duration, List<ChapterDto> chapters) {
        List<ChapterDto> nativeChapters = chapters == null ? List.of() : List.copyOf(chapters);
        return new TranscriptResponse(
                videoId, title, channelName,
                "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg",
                "", List.of(), duration, "", CleaningStage.METADATA_FALLBACK,
                NoteSource.METADATA,
                "Transcript unavailable. Import a transcript to enable AI refinement after semantic verification.",
                nativeChapters, nativeChapters.isEmpty(), false,
                TranscriptAvailability.UNAVAILABLE, "", "Original", false, null,
                false, "", List.of(), AiProcessingStatus.NOT_APPLICABLE, null,
                "Import a transcript to enable AI refinement."
        );
    }

    private TranscriptResponse processTranscript(
            String videoId,
            String title,
            String channelName,
            String duration,
            List<ChapterDto> discoveredChapters,
            ExtractedTranscript extractedTranscript,
            NoteSource noteSource,
            TranscriptAvailability availability,
            Boolean editableChaptersOverride) {

        List<ChapterDto> chapters = discoveredChapters;
        String rawTranscript = extractedTranscript.content();
        String thumbnailUrl = "https://img.youtube.com/vi/" + videoId + "/hqdefault.jpg";

        boolean hasNativeChapters = chapters != null && !chapters.isEmpty();

        CleaningStage finalStage = CleaningStage.REGEX_SANITIZED;
        String finalText = transcriptDraftFormatter.format(
                title,
                channelName,
                duration,
                extractedTranscript.languageCode(),
                extractedTranscript.segments()
        );

        boolean editableChapters = editableChaptersOverride == null
                ? !hasNativeChapters
                : editableChaptersOverride;

        return new TranscriptResponse(
                videoId,
                title,
                channelName,
                thumbnailUrl,
                rawTranscript,
                extractedTranscript.segments(),
                duration,
                finalText,
                finalStage,
                noteSource,
                "",
                chapters == null ? List.of() : List.copyOf(chapters),
                editableChapters,
                false,
                availability,
                extractedTranscript.languageCode(),
                "Original",
                false,
                null,
                extractedTranscript.autoGenerated(),
                extractedTranscript.captionTrackName(),
                extractedTranscript.availableCaptionTracks(),
                AiProcessingStatus.NOT_REQUESTED,
                null,
                "Original-language transcript draft is ready."
        );
    }

    @Override
    public TranscriptResponse importTranscript(ImportTranscriptRequest request) {
        SourceContext context = timedImportStage(request.videoId(), "SOURCE_CONTEXT",
                () -> sourceContext(request.videoId(), request.chapters()));

        PastedTranscriptParser.ParsedTranscript parsed = timedImportStage(request.videoId(), "PARSE", () -> pastedTranscriptParser.parse(
                YoutubeTranscriptPasteNormalizer.normalize(request.transcript()),
                context.chapters()
        ));

        ExtractedTranscript imported = new ExtractedTranscript(
                parsed.content(),
                parsed.segments(),
                parsed.languageCode(),
                false,
                "User-provided YouTube transcript",
                List.of()
        );

        // Import only prepares source evidence. refineTranscript verifies it before submitting an AI job.
        ContentPolicyDecision decision = ContentPolicyDecision.unverified(ContentReasonCode.METADATA_INCONCLUSIVE);
        return timedImportStage(request.videoId(), "FORMAT", () -> processTranscript(
                request.videoId(),
                context.title(),
                context.channelName(),
                context.duration(),
                context.chapters(),
                imported,
                NoteSource.USER_PROVIDED,
                TranscriptAvailability.USER_PROVIDED,
                request.editableChapters()
        ).withContentPolicy(decision));
    }

    private <T> T timedImportStage(String videoId, String stage, java.util.function.Supplier<T> work) {
        long started = System.nanoTime();
        boolean succeeded = false;
        log.info("Transcript import stage started. videoId={}, stage={}", videoId, stage);
        try {
            T result = work.get();
            succeeded = true;
            return result;
        } finally {
            log.info("Transcript import stage finished. videoId={}, stage={}, elapsedMs={}, succeeded={}",
                    videoId, stage, (System.nanoTime() - started) / 1_000_000, succeeded);
        }
    }

    @Override
    public TranscriptResponse refineTranscript(RefineTranscriptRequest request) {
        SourceContext context = sourceContext(request.videoId(), request.chapters());

        List<TranscriptSegmentDto> segments = normalizeSegments(
                request.transcriptSegments(),
                request.transcript()
        );

        String transcriptLanguage = request.transcriptLanguage() == null
                || request.transcriptLanguage().isBlank()
                ? "und"
                : request.transcriptLanguage().trim();

        ExtractedTranscript transcript = new ExtractedTranscript(
                request.transcript(),
                segments,
                transcriptLanguage,
                false,
                "Workspace transcript",
                List.of()
        );

        TranscriptResponse source = processTranscript(
                request.videoId(),
                context.title(),
                context.channelName(),
                context.duration(),
                context.chapters(),
                transcript,
                NoteSource.USER_PROVIDED,
                TranscriptAvailability.USER_PROVIDED,
                request.editableChapters()
        );

        String sanitized = regexCleaningStrategy.clean(
                source.content(),
                source.transcriptLanguage(),
                source.title()
        );

        // Semantic eligibility must pass before AI note generation is queued.
        ContentPolicyDecision decision = verifyContent(request.videoId(),
                context.title(),
                context.channelName(),
                context.categoryId(),
                sanitized,
                source.transcriptLanguage(),
                context.metadataEligibility()
        );
        source = source.withContentPolicy(decision);

        TranscriptResponse targetBase = new TranscriptResponse(
                source.videoId(),
                source.title(),
                source.channelName(),
                source.thumbnailUrl(),
                source.content(),
                source.transcriptSegments(),
                source.duration(),
                source.cleanedTranscript(),
                source.cleaningStage(),
                source.noteSource(),
                source.sourceDisclaimer(),
                source.chapters(),
                source.isEditableChapters(),
                source.cachedResponse(),
                source.transcriptAvailability(),
                source.transcriptLanguage(),
                request.targetLanguage(),
                true,
                source.retryAfterSeconds(),
                source.autoGeneratedCaptions(),
                source.selectedCaptionTrackName(),
                source.availableCaptionTracks(),
                source.aiStatus(),
                source.aiJobId(),
                source.aiMessage()
        );

        targetBase = targetBase.withContentPolicy(decision);
        AiNoteJobService.Submission submission = aiNoteJobService.submit(targetBase, sanitized, request.targetLanguage());
        return copyWithAiSubmission(targetBase, submission);
    }

    private SourceContext sourceContext(
            String videoId,
            List<ChapterDto> workspaceChapters) {

        String title = extractionService.getVideoTitle(videoId);
        String channelName = extractionService.getVideoChannelName(videoId);
        String categoryId = extractionService.getVideoCategoryId(videoId);
        String duration = extractionService.getVideoDuration(videoId);

        ContentEligibility metadataEligibility = precheck(videoId,
                title,
                channelName,
                categoryId
        );

        List<ChapterDto> chapters = workspaceChapters == null
                ? safeExtractChapters(videoId)
                : workspaceChapters.stream()
                .filter(chapter -> chapter != null
                        && chapter.title() != null
                        && !chapter.title().isBlank())
                .sorted(Comparator.comparingLong(ChapterDto::startTimestampSeconds))
                .toList();

        return new SourceContext(
                title,
                channelName,
                categoryId,
                duration,
                List.copyOf(chapters),
                metadataEligibility
        );
    }

    private List<TranscriptSegmentDto> normalizeSegments(
            List<TranscriptSegmentDto> requestedSegments,
            String transcript) {

        if (requestedSegments == null || requestedSegments.isEmpty()) {
            return List.of(new TranscriptSegmentDto(0, 0, transcript));
        }

        List<TranscriptSegmentDto> normalized = requestedSegments.stream()
                .filter(segment -> segment != null
                        && segment.text() != null
                        && !segment.text().isBlank())
                .map(segment -> new TranscriptSegmentDto(
                        Math.max(0, segment.startSeconds()),
                        Math.max(0, segment.durationSeconds()),
                        segment.text().trim()
                ))
                .sorted(Comparator.comparingDouble(TranscriptSegmentDto::startSeconds))
                .toList();

        return normalized.isEmpty()
                ? List.of(new TranscriptSegmentDto(0, 0, transcript))
                : List.copyOf(normalized);
    }

    private record SourceContext(
            String title,
            String channelName,
            String categoryId,
            String duration,
            List<ChapterDto> chapters,
            ContentEligibility metadataEligibility) {
    }

    private TranscriptResponse copyWithAiSubmission(
            TranscriptResponse base,
            AiNoteJobService.Submission submission) {

        return new TranscriptResponse(
                base.videoId(),
                base.title(),
                base.channelName(),
                base.thumbnailUrl(),
                base.content(),
                base.transcriptSegments(),
                base.duration(),
                base.cleanedTranscript(),
                base.cleaningStage(),
                base.noteSource(),
                base.sourceDisclaimer(),
                base.chapters(),
                base.isEditableChapters(),
                base.cachedResponse(),
                base.transcriptAvailability(),
                base.transcriptLanguage(),
                base.targetLanguage(),
                true,
                submission.retryAfterSeconds(),
                base.autoGeneratedCaptions(),
                base.selectedCaptionTrackName(),
                base.availableCaptionTracks(),
                submission.status(),
                submission.jobId(),
                submission.message()
        ).withChapterAvailability(base.chapterAvailability()).withContentPolicy(base.contentPolicy());
    }

    private ContentEligibility precheck(String videoId, String title, String channel, String category) {
        try {
            ContentEligibility result = educationalContentClassifier.validateVideoMetadata(title, channel, category);
            logDecision(videoId, ContentPolicyDecision.unverified(ContentReasonCode.METADATA_INCONCLUSIVE));
            return result;
        } catch (NonEducationalContentException ex) {
            logDecision(videoId, ex.getDecision());
            throw ex;
        }
    }

    private ContentPolicyDecision verifyContent(String videoId, String title, String channel, String category,
            String transcript, String language, ContentEligibility metadata) {
        long started = System.nanoTime();
        boolean succeeded = false;
        log.info("Transcript verification started. videoId={}", videoId);
        try {
            var decision = educationalContentClassifier.validateEducationalContent(title, channel, category, transcript, language, metadata);
            logDecision(videoId, decision);
            succeeded = true;
            return decision;
        } catch (NonEducationalContentException ex) {
            logDecision(videoId, ex.getDecision());
            throw ex;
        } finally {
            log.info("Transcript verification finished. videoId={}, elapsedMs={}, succeeded={}",
                    videoId, (System.nanoTime() - started) / 1_000_000, succeeded);
        }
    }

    private void logDecision(String videoId, ContentPolicyDecision decision) {
        if (decision != null) log.info("Content guardrail decision. videoId={}, eligibility={}, reasonCode={}, verification={}",
                videoId, decision.eligibility(), decision.reasonCode(), decision.verificationLevel());
    }

    private ChapterDiscoveryResult safeDiscoverChapters(String videoId) {
        try {
            var result = extractionService.discoverChapters(videoId);
            return result != null ? result : ChapterDiscoveryResult.found(extractionService.extractChapters(videoId));
        } catch (RuntimeException ex) {
            log.warn("Chapter discovery temporarily unavailable. operation=CHAPTER_DISCOVERY, scope=WATCH_PAGE, videoId={}, errorType={}",
                    videoId, ex.getClass().getSimpleName());
            return ChapterDiscoveryResult.unavailable();
        }
    }

    private List<ChapterDto> safeExtractChapters(String videoId) {
        try {
            List<ChapterDto> chapters = extractionService.extractChapters(videoId);
            return chapters == null ? List.of() : List.copyOf(chapters);
        } catch (UpstreamRateLimitException | YoutubeBusyException | UpstreamServiceUnavailableException | org.springframework.web.client.ResourceAccessException
                 | org.springframework.web.client.HttpServerErrorException ex) {
            log.warn("Chapter discovery unavailable. operation=CHAPTER_DISCOVERY, scope=WATCH_PAGE, videoId={}, error={}. Continuing without native chapters.",
                    videoId, ex.getClass().getSimpleName());
            return List.of();
        } catch (RuntimeException ex) {
            log.warn(
                    "Chapter discovery failed for video {} and will not block note creation: {}",
                    videoId,
                    ex.getClass().getSimpleName()
            );
            return List.of();
        }
    }

}
