package com.timesync.notes.guardrail;
import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Contextual evidence, never a list of disallowed video titles. */
public final class MetadataSignalExtractor {
 public record Signals(boolean media, boolean sports, boolean gaming, boolean music,
  boolean reaction, boolean review, boolean spoiler, boolean trailer, boolean celebrity,
  boolean vlog, boolean promotional, boolean instructional, boolean technical, boolean academic,
  boolean musicVideo, boolean highlights, boolean plotSummary, boolean entertainmentCategory,
  boolean musicChannel) {}

 public Signals extract(String title, String channel, String category) {
  String text = normalize(title);
  boolean spoiler = has(text, "spoiler(?:s| free)?");
  boolean media = has(text, "movies?|films?|cinema|tv|television|series|sitcom|screenplay") || spoiler;
  return new Signals(media,
   "17".equals(category) || has(text, "cricket|football|soccer|basketball|world cup|wc \\d{4}|ind (?:vs?\\.?|versus) aus|ipl"),
   "20".equals(category) || has(text, "gaming|gameplay|minecraft|fortnite|speedrun|ranked match"),
   "10".equals(category) || has(text, "music|song|lyrics?|remix|album"),
   has(text, "reactions?|reacting|funny moments|compilation|hype|not ready to get hurt|gossip|paparazzi"),
   has(text, "reviews?"), spoiler, has(text, "trailer|teaser"),
   has(text, "celebrity|celebrities"), has(text, "vlogs?"),
   text.startsWith("buy now ") || text.startsWith("shop now ")
       || (has(text, "limited time offer") && has(text, "buy|shop|discount code")),
   has(text, "tutorial|course|lecture|lesson|step by step|explained|how .{1,70} works?"),
   has(text, "architecture|system design|data structures?|algorithms?|databases?|research paper|programming|engineering|recommendation systems?|react \\d+|java collections|analytics"),
   has(text, "physics|mathematics|statistics|chemistry|biology|academic|history|documentary"),
   has(text, "(?:official )?music video|lyric video|official audio|cover song"),
   has(text, "highlights?|full match|live match|match replay|funny moments|gameplay|speedrun"),
   media && has(text, "(?:ending|plot) explained"), "24".equals(category),
   has(normalize(channel), "vevo|saregama|music label|records|recordings|songs"));
 }
 private static boolean has(String text, String expression) {
  return Pattern.compile("\\b(?:" + expression + ")\\b").matcher(text).find();
 }
 private static String normalize(String value) {
  return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFKC)
   .toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}.]+", " ").trim();
 }
}
