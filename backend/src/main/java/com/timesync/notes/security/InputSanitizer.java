package com.timesync.notes.security;

import org.springframework.stereotype.Component;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;

import java.util.regex.Pattern;

@Component
public class InputSanitizer {

    // Matches script tags regardless of attributes (e.g., <script src="..."> or <script type="...">) and across line breaks
    private static final Pattern SCRIPT_PATTERN = Pattern.compile("<script[^>]*>(.*?)</script>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    // Removes quoted event-handler attributes from plain-text input.
    private static final Pattern EVENT_HANDLER_PATTERN = Pattern.compile("on\\w+\\s*=\\s*\"[^\"]*\"|on\\w+\\s*=\\s*'[^']*'", Pattern.CASE_INSENSITIVE);

    // Matches any remaining raw HTML tags
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]*>");
    private static final Safelist RICH_NOTE_SAFELIST = Safelist.relaxed()
            .addTags("h1", "h2", "h3", "h4", "h5", "h6", "mark", "u", "col", "colgroup", "tfoot")
            .addAttributes(":all", "class", "title")
            .addAttributes("p", "data-indent")
            .addAttributes("h1", "data-indent")
            .addAttributes("h2", "data-indent")
            .addAttributes("h3", "data-indent")
            .addAttributes("h4", "data-indent")
            .addAttributes("h5", "data-indent")
            .addAttributes("h6", "data-indent")
            .addAttributes("span", "data-type", "timestamp")
            .addAttributes("div", "data-diagram-shape", "data-shape")
            .addAttributes("td", "colspan", "rowspan")
            .addAttributes("th", "colspan", "rowspan")
            .addProtocols("img", "src", "http", "https", "data");
    private static final Document.OutputSettings COMPACT_HTML =
            new Document.OutputSettings().prettyPrint(false);

    /**
     * Sanitizes plain input text by stripping dangerous script tags, event handlers, and HTML constructs.
     */
    public String sanitize(String rawInput) {
        if (rawInput == null || rawInput.isBlank()) {
            return rawInput;
        }

        String sanitized = SCRIPT_PATTERN.matcher(rawInput).replaceAll("");
        sanitized = EVENT_HANDLER_PATTERN.matcher(sanitized).replaceAll("");
        sanitized = HTML_TAG_PATTERN.matcher(sanitized).replaceAll("");

        return sanitized.trim();
    }

    public String sanitizeRichHtml(String rawHtml) {
        if (rawHtml == null || rawHtml.isBlank()) {
            return rawHtml;
        }

        return Jsoup.clean(rawHtml, "", RICH_NOTE_SAFELIST, COMPACT_HTML).trim();
    }
}
