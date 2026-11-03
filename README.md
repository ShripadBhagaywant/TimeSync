# ⏱️ TimeSync Notes

TimeSync Notes helps people turn educational YouTube videos into organized, timestamped study notes. The repository contains a React frontend and a Spring Boot backend.

## ✨ What you can do

- 🎬 Extract video metadata, chapters, and available captions.
- 📝 Import timestamped transcripts and create AI-assisted note drafts.
- 🌐 Generate drafts in English, Hindi, or Hinglish.
- 📚 Work with playlists, custom chapters, and saved workspace notes.
- 📄 Edit and export notes, including PDF, and share read-only snapshots.

## 🧱 Project layout

- `frontend/` — React, TypeScript, and Vite application.
- `backend/` — Java 17 and Spring Boot API, PostgreSQL/Redis integration, Dockerfile, and backend documentation.

## 🚀 Run locally

### 1. Start backend dependencies

Install Docker Desktop, then open PowerShell in `backend/`:

```powershell
Copy-Item .env.example .env
```

Set local passwords and provider keys in `backend/.env`. Keep this private; `.env` files are ignored by Git. If you already have a `.env`, do not overwrite it with the example.

Start the local database and cache:

```powershell
docker compose up -d
docker compose ps
```

The Compose setup starts PostgreSQL and Redis. Then run the backend from `backend/`:

```powershell
.\mvnw spring-boot:run
```

The API listens on `http://localhost:8080` by default. See [`backend/README.md`](backend/README.md) for backend configuration, deployment, endpoints, and troubleshooting.

### 2. Start the frontend

Open another terminal in `frontend/`:

```powershell
npm ci
npm run dev
```

Open `http://localhost:5173`. The Vite development server proxies API requests to the backend on port `8080`.

## 🧪 Checks

From `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

From `backend/`:

```powershell
.\mvnw clean install
```

## 🐳 Build the backend image

From `backend/`:

```powershell
docker build -t timesync-notes-backend:local .
```

The backend image uses a non-root runtime user. The Compose file is for local PostgreSQL and Redis services; it does not launch the application container.

## 🔐 Configuration and deployment notes

- Keep provider credentials on the backend. Never put them in frontend `VITE_*` variables.
- Use environment variables for local and hosted secrets. Commit only `.env.example` files with placeholders.
- The backend currently has no user authentication. Treat public deployment as an intentionally open service and keep request limits, CORS, provider quotas, and hosting costs in mind.
- The backend uses PostgreSQL and Redis; provide managed or hosted instances when deploying the API.
- Configure the backend CORS allowlist for the deployed frontend origin.
- Process-local job and cooldown state is intended for a single backend instance unless the relevant state is moved to shared storage.

## 📜 License

No license file is included in this repository.