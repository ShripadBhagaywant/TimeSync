import React from "react";
import { HardDrive, Lock, Eye, Cpu } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const PrivacyPolicyPage: React.FC = () => {
  const lastUpdated = "September 22, 2026";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-500 selection:text-white">
      <Navbar />

      <main className="flex-1 mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Header */}
        <div className="border-b border-slate-200 pb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Privacy Policy
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            Last Updated: {lastUpdated}
          </p>
        </div>

        {/* Highlights Banner */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <HardDrive className="w-5 h-5 text-blue-600 mb-2" />
            <h2 className="text-sm font-bold text-slate-900">
              100% Local-First
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Your notes, drafts, and edits never touch our database. They
              remain on your device.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Lock className="w-5 h-5 text-emerald-600 mb-2" />
            <h2 className="text-sm font-bold text-slate-900">
              Zero Authentication
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              No sign-up, no login, and no passwords. We do not track your
              identity.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Eye className="w-5 h-5 text-purple-600 mb-2" />
            <h2 className="text-sm font-bold text-slate-900">No Tracking</h2>
            <p className="mt-1 text-xs text-slate-600">
              We do not sell data, profile your browsing, or sell advertising
              slots.
            </p>
          </div>
        </div>

        {/* Body Content */}
        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">
              1. Information We Do Not Collect
            </h2>
            <p className="mt-2">
              TimeSync Notes is built on a{" "}
              <strong>Zero Auth, Local-First</strong> paradigm. Because you do
              not need an account to use TimeSync Notes, we do not collect:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-slate-600 pl-2">
              <li>
                Personal identification details (e.g., name, email address,
                phone number).
              </li>
              <li>Authentication credentials or account passwords.</li>
              <li>
                Your notes, formatted tables, code snippets, or video study
                history.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              2. Local Storage & Local Data Ownership
            </h2>
            <p className="mt-2">
              When you work on video notes, import transcripts, or create
              structured outlines, all data is stored exclusively in your
              browser’s local storage (`localStorage` / `IndexedDB`).
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-slate-600 pl-2">
              <li>
                <strong>Draft Control:</strong> Clearing your browser data or
                using "Clear Draft" permanently removes notes from your device.
              </li>
              <li>
                <strong>Exports & Snapshots:</strong> Exported files or local
                JSON/Markdown snapshots are generated locally on your client
                device.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              3. Third-Party Services & AI Processing
            </h2>
            <p className="mt-2">
              To provide video playback, transcript extraction, and optional AI
              refinement, TimeSync Notes interacts with external services under
              strict limitations:
            </p>
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-600" /> YouTube & Embedded
                  Media
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-5">
                  When you input a YouTube link or play a video, requests are
                  sent directly to YouTube's servers to load video metadata,
                  player controls, and public captions. Subject to YouTube's
                  Privacy Policy.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-600" /> Optional AI
                  Refinement
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-5">
                  If you explicitly request AI refinement or translation,
                  transcript text is submitted to external AI processing
                  services solely for generating structured notes. Prompt inputs
                  are not retained or used for training underlying AI models.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              4. Analytics & Cookies
            </h2>
            <p className="mt-2">
              TimeSync Notes does not use third-party tracking cookies,
              advertising IDs, or cross-site behavioral telemetry.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              5. Contact Information
            </h2>
            <p className="mt-2">
              If you have any questions or feedback regarding our local-first
              privacy architecture, please open an issue on our official GitHub
              repository.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};
