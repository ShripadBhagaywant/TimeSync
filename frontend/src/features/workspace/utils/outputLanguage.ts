export const AI_OUTPUT_LANGUAGES = ["English", "Hindi", "Hinglish"] as const;

/** Source markers such as "Original" are not AI output-language preferences. */
export const resolveOutputLanguage = (language?: string | null): string => {
  const normalized = language?.trim().toLowerCase();
  if (
    ["hindi-english", "hindi english", "hindienglish", "hinglish"].includes(
      normalized ?? "",
    )
  ) {
    return "Hinglish";
  }
  return (
    AI_OUTPUT_LANGUAGES.find((value) => value.toLowerCase() === normalized) ??
    "English"
  );
};
