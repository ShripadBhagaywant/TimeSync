import React from "react";
import { Link } from "react-router-dom";
import {AlertTriangle, CheckCircle2} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export const TermsOfServicePage: React.FC = () => {
  const lastUpdated = "November 6, 2026";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col selection:bg-blue-500 selection:text-white">
      <Navbar />

      <main className="flex-1 mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
        {/* Header */}
        <div className="border-b border-slate-200 pb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-950 tracking-tight">
            Terms of Service
          </h1>
          <p className="mt-2 text-xs text-slate-500">
            Last Updated: {lastUpdated}
          </p>
        </div>

        {/* Overview Box */}
        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider text-blue-600">
            Summary
          </h2>
          <p className="mt-2 text-sm text-slate-700 leading-6">
            TimeSync Notes is a free, local-first web application designed for
            personal educational note-taking. By using TimeSync Notes, you agree
            to these terms.
          </p>
        </div>

        {/* Body Content */}
        <div className="mt-10 space-y-8 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">
              1. Acceptance of Terms
            </h2>
            <p className="mt-2">
              By accessing or using TimeSync Notes, you agree to be bound by
              these Terms of Service. If you do not agree, you should refrain
              from using the application.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              2. Use of Service & Educational Purpose
            </h2>
            <p className="mt-2">
              TimeSync Notes provides tools for timestamping, formatting code,
              creating tables, and organizing notes alongside public video
              content.
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  You may use TimeSync Notes for personal, educational, or
                  professional note-taking.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  You retain full ownership of all notes, formatting, and
                  markdown structures you compose.
                </span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              3. Local Data Responsibility & Backups
            </h2>
            <p className="mt-2">
              Because TimeSync Notes relies on local-first browser storage:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1 text-slate-600 pl-2">
              <li>
                You are solely responsible for exporting and backing up your
                notes.
              </li>
              <li>
                We cannot recover lost notes caused by clearing browser cache,
                resetting local storage, or browser corruption.
              </li>
              <li>
                If you create a share link, its read-only snapshot is stored by
                the backend for up to 24 hours. Transcript text is sent to
                Google Gemini when you request AI verification or drafting;
                provider terms apply.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              4. Third-Party Content & YouTube Availability
            </h2>
            <p className="mt-2">
              TimeSync Notes relies on external services for video playback,
              source metadata, public captions, analytics, and optional AI
              processing. Their availability and terms are controlled by those
              providers. YouTube use is subject to its{" "}
              <a className="font-medium text-blue-700 underline" href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>; Gemini processing is subject to the{" "}
              <a className="font-medium text-blue-700 underline" href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer">Gemini API terms</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              5. Disclaimer of Warranties
            </h2>
            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-900 text-xs leading-6">
              <div className="flex items-center gap-2 font-bold text-amber-800 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" /> "As Is"
                Provision
              </div>
              TimeSync Notes is provided on an "AS IS" and "AS AVAILABLE" basis
              without warranties of any kind, whether express or implied. We do
              not guarantee uninterrupted operational availability, AI
              error-free summaries, or perpetual transcript extraction.
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              6. Modifications to Terms
            </h2>
            <p className="mt-2">
              We reserve the right to update or modify these Terms at any time.
              Changes will be reflected by updating the "Last Updated" date at
              the top of this page.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">
              7. Privacy and Support
            </h2>
            <p className="mt-2">
              Review the <Link className="font-medium text-blue-700 underline" to="/privacy">Privacy Policy</Link> for details about local storage, sharing, analytics, and transcript processing. For questions or to report an issue, use the{" "}
              <a className="font-medium text-blue-700 underline" href="https://github.com/ShripadBhagaywant/TimeSync/issues" target="_blank" rel="noopener noreferrer">project issue tracker</a>.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};
