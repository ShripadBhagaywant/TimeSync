import React from "react";
import { Link } from "react-router-dom";
import { HardDrive, Lock, Eye, Cpu } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const PrivacyPolicyPage: React.FC = () => {
  const lastUpdated = "November 6, 2026";

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
              Local-First Workspace
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              Your workspace stays in this browser unless you choose to create
              an AI draft or share a note.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Lock className="w-5 h-5 text-emerald-600 mb-2" />
            <h2 className="text-sm font-bold text-slate-900">
              Zero Authentication
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              No sign-up, login, or account profile is required to use the app.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <Eye className="w-5 h-5 text-purple-600 mb-2" />
            <h2 className="text-sm font-bold text-slate-900">Anonymous Analytics</h2>
            <p className="mt-1 text-xs text-slate-600">
              We count visits without advertising cookies or cross-site identity
              profiles.
            </p>
          </div>
        </div>

        {/* Body Content */}
        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">
              1. Information and Content Handling
            </h2>
            <p className="mt-2">
              TimeSync Notes does not require an account or ask you for a name,
              email address, phone number, or login credentials. Hosting and
              provider services may process technical request data under their
              own policies:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-slate-600 pl-2">
              <li>
                Personal identification details (e.g., name, email address,
                phone number).
              </li>
              <li>Authentication credentials or account passwords.</li>
              <li>Advertising profiles or cross-site identity profiles.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              2. Local Storage & Local Data Ownership
            </h2>
            <p className="mt-2">
              Video workspaces, transcripts, chapters, and editor drafts are
              saved in this browser’s IndexedDB. They are not uploaded as a
              general cloud backup. The following actions send the relevant
              content to the backend or a provider:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-slate-600 pl-2">
              <li>
                <strong>Draft Control:</strong> Clearing your browser data or
                using "Clear Draft" permanently removes notes from your device.
              </li>
              <li>
                <strong>Exports & Snapshots:</strong> Exported files or local
                JSON/Markdown snapshots are generated on your device. If you
                choose Share, the note snapshot is sent to the backend and
                stored for up to 24 hours so recipients can open its read-only
                link.
              </li>
              <li>
                <strong>Transcript processing:</strong> Video identifiers and
                transcript-related requests are sent to the TimeSync backend.
                Imported transcript text is sent when you submit it.
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
                  The TimeSync backend requests video metadata and available
                  public captions from YouTube. The embedded video player also
                  connects to YouTube. These services are subject to the{" "}
                  <a className="font-medium text-blue-700 underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-purple-600" /> Optional AI
                  Refinement
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-5">
                  When you request AI verification and drafting, transcript
                  text is sent to Google Gemini. If a request uses Gemini’s
                  unpaid quota, Google’s terms say submitted prompts and
                  responses may be used to improve its services and may be
                  reviewed by people. Do not submit sensitive, confidential,
                  or personal information. Data handling differs for paid
                  service use. See the{" "}
                  <a className="font-medium text-blue-700 underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini API terms</a>.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              4. Analytics & Cookies
            </h2>
            <p className="mt-2">
              TimeSync Notes uses Vercel Web Analytics to measure aggregated
              visitor counts and page views. Vercel describes this as
              cookie-free analytics; it uses a temporary visitor hash that is
              discarded after 24 hours. Analytics may include page, timestamp,
              referring site, broad location, device, operating system, and
              browser information. We remove query strings and replace video,
              playlist, and shared-note identifiers with generic route names
              before sending page-view events. Note text, transcripts, and AI
              prompts are not sent as analytics events. The statistics are
              available to the project owner in the Vercel dashboard and are
              not used for advertising.
              {" "}
              See Vercel’s{" "}
              <a className="font-medium text-blue-700 underline" href="https://vercel.com/docs/analytics/privacy-policy" target="_blank" rel="noopener noreferrer">Web Analytics privacy details</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              5. Contact Information
            </h2>
            <p className="mt-2">
              If you have questions or feedback, open an issue in the{" "}
              <a className="font-medium text-blue-700 underline" href="https://github.com/ShripadBhagaywant/TimeSync/issues" target="_blank" rel="noopener noreferrer">TimeSync Notes repository</a>.
              {" "}You can also review our <Link className="font-medium text-blue-700 underline" to="/terms">Terms of Service</Link>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};
