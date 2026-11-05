import React from "react";
import { Link } from "react-router-dom";
import {
  BookOpenCheck,
  Braces,
  CheckCircle2,
  ChevronRight,
  Download,
  Edit3,
  FileQuestion,
  Languages,
  ListVideo,
  Maximize2,
  PlaySquare,
  Save,
  Sparkles,
  Table2,
  type LucideIcon,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

// --- TYPES ---
interface WorkflowStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface SourceCase {
  title: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: "blue" | "amber";
}

interface EditorTool {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface ToneStyle {
  shell: string;
  icon: string;
  badge: string;
}

// --- CONSTANTS ---
const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    title: "Add a video or playlist",
    description:
      "Paste a supported YouTube video or playlist link. Extraction starts without AI or language choices.",
    icon: PlaySquare,
  },
  {
    title: "Review the available source",
    description:
      "Read the timestamped transcript, or import it from YouTube when captions cannot be retrieved. Parsing prepares your source without starting AI. Chapters are optional.",
    icon: FileQuestion,
  },
  {
    title: "Work one video at a time",
    description:
      "Choose a video in your playlist to review its source. Apply each finished AI draft to the shared playlist document when you are ready.",
    icon: ListVideo,
  },
  {
    title: "Edit the note in your editor",
    description:
      "Write your own notes, or choose an output language and create a structured draft. AI checks transcript eligibility first. Review the result before applying it.",
    icon: Edit3,
  },
  {
    title: "Save, export, or share",
    description:
      "With autosave enabled, wait for the saved indicator before leaving. Export your notes or share a read-only snapshot when they are ready.",
    icon: Download,
  },
];

const SOURCE_CASES: SourceCase[] = [
  {
    title: "Transcript is available",
    label: "Spoken content ready",
    description:
      "The original timestamped transcript stays in the left panel. You can read and seek with it, then optionally create a separate structured AI draft in your selected language.",
    icon: BookOpenCheck,
    tone: "blue",
  },
  {
    title: "Transcript is unavailable",
    label: "Paste while watching",
    description:
      "Video information and any available chapters remain accessible. If YouTube offers Show transcript, copy its timestamped text and use Import Transcript. Parsing does not start AI.",
    icon: FileQuestion,
    tone: "amber",
  },
];

const EDITOR_TOOLS: EditorTool[] = [
  {
    title: "Code blocks and language",
    description:
      "Place the cursor in a code block, then choose a language such as Java, Python, SQL, or JavaScript. The selector changes syntax highlighting only; it never executes, translates, or alters your code.",
    icon: Braces,
  },
  {
    title: "Editable tables",
    description:
      "Insert a starter table, click inside a cell, and use the contextual controls to add or remove rows and columns. You decide when a comparison deserves a table.",
    icon: Table2,
  },
  {
    title: "Focused writing modes",
    description:
      "Minimize the editor when you need more room for the video, or expand it when you want a distraction-free writing surface. Exit expanded mode with Escape.",
    icon: Maximize2,
  },
  {
    title: "Automatic local drafts",
    description:
      "With autosave enabled, edits are saved in this browser. Check the save indicator before leaving. Playlist notes stay in the shared course document as you switch videos.",
    icon: Save,
  },
];

const FAQS: FaqItem[] = [
  {
    question: "Why does AI say temporarily unavailable after parsing succeeds?",
    answer:
      "Parsing and AI verification are separate steps. A provider connection problem can interrupt verification even when your transcript parsed successfully. Keep your transcript and notes, wait for the suggested retry delay, then try again. Missing verification does not approve an AI draft.",
  },
  {
    question: "What does the AI refinement option change?",
    answer:
      "Create structured draft first verifies that the transcript is suitable for educational notes, then prepares a draft in your selected language. Your source and notes stay unchanged until you apply the result. Parsing alone never starts AI.",
  },
  {
    question: "What does the target language control?",
    answer:
      "It controls only the AI draft; English is the default. Choose your language before creating a draft. The original transcript, video playback, and code highlighting stay unchanged.",
  },
  {
    question: "Can a large playlist be used?",
    answer:
      "Yes. Videos are prepared progressively, with a separate source for each video and a shared playlist note document. Large playlists can take longer; unavailable videos do not erase completed work.",
  },
  {
    question: "Who controls chapters?",
    answer:
      "Creator chapters are read-only. When chapters are absent or temporarily unavailable, use the chapter panel to add and remove your own markers at the current playback time.",
  },
  {
    question: "Can metadata reveal what was said inside a video?",
    answer:
      "No. Video information cannot recover spoken questions, examples, or explanations. Paste YouTube's Show transcript output or write your own notes while watching.",
  },
];

const TONE_STYLES: Record<"blue" | "amber", ToneStyle> = {
  blue: {
    shell: "border-blue-200 bg-blue-50/70",
    icon: "bg-blue-600 text-white",
    badge: "bg-blue-100 text-blue-700",
  },
  amber: {
    shell: "border-amber-200 bg-amber-50/70",
    icon: "bg-amber-500 text-white",
    badge: "bg-amber-100 text-amber-800",
  },
};

// --- SUB-COMPONENTS ---
const HeroSection: React.FC = () => (
  <section className="border-b border-slate-200 bg-white">
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8">
      <div>
        <h1 className="max-w-3xl text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.75rem]">
          From a video link to notes you fully control
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
          TimeSync prepares a useful starting point, keeps it connected to
          playback, and gives you the final say over structure, code, tables,
          chapters, and exports.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            to="/workspace"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Open workspace <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            to="/"
            className="inline-flex min-h-10 items-center justify-center rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            Back to home
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white shadow-lg shadow-slate-200/60 sm:p-5">
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="rounded-xl bg-blue-600 p-2.5">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">Your source. Your final say.</p>
            <p className="text-xs text-slate-400">
              Create a draft only when you are ready.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2.5 text-sm">
          {[
            "Import and parse without starting AI",
            "Choose the language for your AI draft",
            "Review the draft before applying it",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-slate-200">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

const WorkflowSection: React.FC = () => (
  <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
    <div className="max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
        Complete workflow
      </p>
      <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
        How a workspace comes together
      </h2>
    </div>

    <ol className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
      {WORKFLOW_STEPS.map((step, index) => {
        const Icon = step.icon;
        return (
          <li
            key={step.title}
            className="relative min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-200 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold tabular-nums text-slate-500">
                0{index + 1}
              </span>
            </div>
            <h3 className="mt-3 text-sm font-bold leading-snug text-slate-900">
              {step.title}
            </h3>
            <p className="mt-1.5 text-sm leading-5 text-slate-600">
              {step.description}
            </p>
          </li>
        );
      })}
    </ol>
  </section>
);

const SourceClaritySection: React.FC = () => (
  <section className="border-y border-slate-200 bg-white">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
          Source clarity
        </p>
        <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
          What happens when a transcript is missing?
        </h2>
        <p className="mt-1.5 text-sm leading-5 text-slate-600">
          The workspace always tells you which kind of source was available, so
          a helpful starting point is never mistaken for spoken content.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {SOURCE_CASES.map((source) => {
          const Icon = source.icon;
          const style = TONE_STYLES[source.tone];
          return (
            <article
              key={source.title}
              className={`rounded-xl border p-4 sm:p-5 ${style.shell}`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <span className={`shrink-0 rounded-xl p-2.5 ${style.icon}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${style.badge}`}
                  >
                    {source.label}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{source.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    {source.description}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  </section>
);

const EditorToolsSection: React.FC = () => (
  <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
    <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
      <div className="lg:sticky lg:top-24">
        <h2 className="text-2xl font-extrabold sm:text-3xl">
          Your editor, your formatting
        </h2>
        <p className="mt-1.5 text-sm leading-5 text-slate-600">
          Generated notes stay intentionally simple. The editor gives you
          focused controls for richer formatting only where you want it.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {EDITOR_TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <article
              key={tool.title}
              className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-200 hover:shadow-sm"
            >
              <Icon className="h-6 w-6 text-blue-600" />
              <h3 className="mt-3 text-sm font-bold">{tool.title}</h3>
              <p className="mt-1.5 text-sm leading-5 text-slate-600">
                {tool.description}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  </section>
);

const LanguageAndDraftsSection: React.FC = () => (
  <section className="border-y border-slate-200 bg-slate-950 text-white">
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-3 lg:px-8">
      <div>
        <Languages className="h-7 w-7 text-blue-400" />
        <h2 className="mt-3 text-lg font-bold">Language behavior</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          The imported transcript keeps its original language. The output
          selector appears only for AI refinement and controls its translated
          draft. Code-language highlighting remains separate.
        </p>
      </div>
      <div>
        <ListVideo className="h-7 w-7 text-purple-400" />
        <h2 className="mt-3 text-lg font-bold">Large playlists</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Each video keeps its own transcript and chapters. Move between videos
          while building a shared course document, and apply each AI draft
          only when you are ready.
        </p>
      </div>
      <div>
        <Save className="h-7 w-7 text-emerald-400" />
        <h2 className="mt-3 text-lg font-bold">Draft ownership</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          With autosave enabled, edits stay in this browser. Clearing browser
          data removes local drafts, so export important notes. Clear Draft
          deletes your saved note only when you choose it.
        </p>
      </div>
    </div>
  </section>
);

const FaqSection: React.FC = () => (
  <section className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
    <div className="text-center">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">
        Common questions
      </p>
      <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
        Know what to expect
      </h2>
    </div>

    <div className="mt-6 space-y-2">
      {FAQS.map((faq, index) => (
        <details
          key={faq.question}
          className="group min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-200 hover:shadow-sm open:border-blue-200"
          open={index === 0}
        >
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-lg text-sm font-bold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4 [&::-webkit-details-marker]:hidden">
            {faq.question}
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-open:rotate-90 group-open:text-blue-600" />
          </summary>
          <p className="mt-2.5 border-t border-slate-100 pt-2.5 text-sm leading-6 text-slate-600">
            {faq.answer}
          </p>
        </details>
      ))}
    </div>
  </section>
);

// --- MAIN COMPONENT ---
export const GuidePage: React.FC = () => (
  <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white">
    <Navbar />
    <main>
      <HeroSection />
      <WorkflowSection />
      <SourceClaritySection />
      <EditorToolsSection />
      <LanguageAndDraftsSection />
      <FaqSection />
    </main>
    <Footer />
  </div>
);
