package com.timesync.notes.util;

import com.timesync.notes.dto.response.TranscriptSegmentDto;
import com.timesync.notes.model.ExtractedTranscript;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javax.xml.parsers.DocumentBuilderFactory;
import org.w3c.dom.Element;
import org.xml.sax.InputSource;
import org.xml.sax.helpers.DefaultHandler;

/** Internal caption evidence result; never exposes payloads or parser exception messages. */
public final class SubtitlePayloadParser {
    public enum Reason { OK, EMPTY_BODY, HTML_INTERSTITIAL, UNSUPPORTED_FORMAT,
        MALFORMED_CAPTION_PAYLOAD, NO_CUES, POST_PARSE_EMPTY, TRACK_NOT_USABLE }
    public record Result(ExtractedTranscript transcript, String parser, int parsedCueCount, Reason reason) {
        public boolean temporary() {
            return reason == Reason.HTML_INTERSTITIAL || reason == Reason.UNSUPPORTED_FORMAT
                || reason == Reason.MALFORMED_CAPTION_PAYLOAD;
        }
    }
    private SubtitlePayloadParser() {}

    public static Result parse(String body, String language, boolean asr) {
        var empty = new ExtractedTranscript("", List.of(), language, asr);
        if (body == null || body.isBlank()) return new Result(empty, "NONE", 0, Reason.EMPTY_BODY);
        String text = body.replaceFirst("^\\uFEFF", "").strip();
        String lower = text.toLowerCase(Locale.ROOT);
        if (lower.startsWith("<!doctype html") || lower.replaceFirst("(?s)^<\\?xml.*?\\?>\\s*", "")
                .matches("(?s)^<(?:html|head|body)(?:\\s|>).*"))
            return new Result(empty, "NONE", 0, Reason.HTML_INTERSTITIAL);
        String parser = text.startsWith("<") ? "TIMEDTEXT_XML" : "WEBVTT";
        int count = 0;
        try {
            ExtractedTranscript transcript;
            if (parser.equals("TIMEDTEXT_XML")) {
                var factory = DocumentBuilderFactory.newInstance();
                factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
                factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
                factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
                factory.setXIncludeAware(false);
                factory.setExpandEntityReferences(false);
                var builder = factory.newDocumentBuilder();
                builder.setErrorHandler(new DefaultHandler());
                var root = builder.parse(new InputSource(new StringReader(text))).getDocumentElement();
                boolean srv3 = root.getTagName().equals("timedtext");
                if (!srv3 && !root.getTagName().equals("transcript"))
                    return new Result(empty, parser, 0, Reason.UNSUPPORTED_FORMAT);
                var nodes = root.getElementsByTagName(srv3 ? "p" : "text");
                count = nodes.getLength();
                List<TranscriptSegmentDto> segments = new ArrayList<>();
                for (int i = 0; i < count; i++) {
                    var cue = (Element) nodes.item(i);
                    double start = Double.parseDouble(cue.getAttribute(srv3 ? "t" : "start"));
                    String duration = cue.getAttribute(srv3 ? "d" : "dur");
                    double length = duration.isBlank() ? 0 : Double.parseDouble(duration);
                    if (!Double.isFinite(start) || !Double.isFinite(length) || start < 0 || length < 0)
                        throw new IllegalArgumentException();
                    String value = cue.getTextContent().replaceAll("\\s+", " ").trim();
                    if (!value.isBlank()) segments.add(new TranscriptSegmentDto(start / (srv3 ? 1000 : 1), length / (srv3 ? 1000 : 1), value));
                }
                transcript = new ExtractedTranscript(String.join(" ", segments.stream().map(TranscriptSegmentDto::text).toList()), segments, language, asr);
            } else {
                if (!text.startsWith("WEBVTT") && !text.contains(" --> "))
                    return new Result(empty, "NONE", 0, Reason.UNSUPPORTED_FORMAT);
                count = (int) text.lines().filter(line -> line.contains("-->")).count();
                transcript = VttSubtitleParser.parse(text, language, asr);
            }
            Reason reason = count == 0 ? Reason.NO_CUES : transcript.segments().isEmpty() ? Reason.POST_PARSE_EMPTY
                : transcript.content().trim().length() < 20 ? Reason.TRACK_NOT_USABLE : Reason.OK;
            return new Result(transcript, parser, count, reason);
        } catch (Exception ignored) {
            return new Result(empty, parser, count, Reason.MALFORMED_CAPTION_PAYLOAD);
        }
    }
}
