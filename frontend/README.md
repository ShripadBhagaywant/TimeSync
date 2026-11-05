# TimeSync Notes Frontend

React workspace for synchronized YouTube transcripts, editable study notes,
chapters, local drafts, exports, playlists, and shared snapshots.

## Requirements

- Node.js 22.22.2+, 24.15.0+, or 26+ (required by the installed jsdom dependency)
- The TimeSync backend running on port 8080

## Start locally

```powershell
npm install
npm run dev
```

The development server starts at `http://localhost:5173`. The local `.env`
uses the Vite proxy path `/api/v1`; `.env.example` shows the direct-backend option.

## Commands

### Editor keyboard indentation

While editing, Tab/Shift+Tab indent/outdent paragraphs and headings (0–6 levels),
sink/lift bullet and ordered list items, and insert/remove two-space code indentation.
Arrow keys retain the editor's native behavior. Press Escape to release editor focus;
the next Tab resumes browser focus navigation. Table cells retain their native keymap.
Indentation is saved as `data-indent` in HTML, including playlist documents and snapshots.
Markdown exports represent paragraph indentation with blockquote levels; Text uses spaces,
and HTML/PDF use validated margins.

```powershell
npm run lint
npm test
npm run build
npm run preview
```

## Supported YouTube inputs

- Standard `watch?v=` URLs
- `youtu.be` links
- Shorts, live, embed, mobile, and privacy-enhanced embed URLs
- Raw 11-character video IDs
- Playlist URLs, watch URLs containing `list=`, and raw playlist IDs

## Workspace storage

Editor drafts are stored per video in IndexedDB and expire after seven days.
Small per-video preferences such as custom titles and starred status are stored
in localStorage. Transcripts and complete playlists are not stored in localStorage,
preventing large playlists from exceeding browser storage limits.

## Visitor analytics

The app integrates Vercel Web Analytics for aggregated visitor and page-view
counts. In the Vercel project dashboard, open **Analytics** and enable **Web
Analytics**; after deployment, view counts and traffic breakdowns there. Before
events are sent, the frontend removes query strings and replaces video IDs,
playlist IDs, and shared-note hashes with generic route names.

## Transcript and AI data

Video workspaces and editor drafts are persisted locally in IndexedDB. A share
created by the user is sent to the backend and stored for up to 24 hours.
Transcript text is sent to the backend for extraction and to Google Gemini when
verification or an AI draft is requested. With Gemini's unpaid quota, Google
may use prompts and responses to improve its services, and human reviewers may
process them. Do not submit sensitive, confidential, or personal information.
See the [Gemini API terms](https://ai.google.dev/gemini-api/terms).
