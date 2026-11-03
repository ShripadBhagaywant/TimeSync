# ⏱️ TimeSync Notes Backend

TimeSync API for extracting YouTube transcripts and chapters, verifying transcript evidence, preparing AI note drafts, processing playlists, and creating read-only note shares.

## ✨ What it does

- 🎬 Retrieves video and playlist metadata, chapters, and captions.
- 🧾 Imports and verifies user-provided timestamped transcripts.
- ✅ Requires transcript evidence for educational-content verification; metadata alone does not satisfy verification.
- 🤖 Queues AI refinement separately from extraction and supports English, Hindi, and Hinglish output.
- 📚 Processes playlists with bounded concurrency and keeps successful items when individual videos fail.
- 🔗 Creates read-only shared-note snapshots that expire after 24 hours by default.
- 🛡️ Applies stateless security headers, CORS rules, request limits, upstream cooldowns, and safe error responses.

## 🧰 Technology

- Java 17 and Spring Boot 3
- Maven Wrapper
- PostgreSQL for shared-note persistence
- Redis for distributed rate limits and application caches
- YouTube Data API and Gemini-compatible API for provider-backed operations
- Docker for the backend image and local PostgreSQL/Redis services

## 🚀 Run locally

### 1. Prepare environment variables

Create **.env** from **.env.example** if it does not already exist, then set local database/cache passwords and provider API keys. Keep **.env** private; it is ignored by Git and Docker build context. Provider keys belong on the backend only, never in frontend **VITE_*** variables.

~~~powershell
Copy-Item .env.example .env
~~~

Do not run that command if you already have a local **.env**; it would overwrite your local settings.

### 2. Start PostgreSQL and Redis

Docker Compose intentionally starts only these two local dependencies:

~~~powershell
docker compose up -d
docker compose ps
~~~

Both services should show as healthy. Ports bind to **127.0.0.1** on the host. Compose reads **.env** automatically and requires non-empty **POSTGRES_PASSWORD** and **REDIS_PASSWORD** values.

To stop the services while preserving their data volumes:

~~~powershell
docker compose down
~~~

### 3. Run the backend

Spring Boot does not automatically load **.env**. In IntelliJ, add the values from **.env** to the Spring Boot run configuration’s environment variables. Alternatively, import them into PowerShell and launch the Maven Wrapper:

~~~powershell
Get-Content .env | Where-Object { $_ -match '^\s*[^#=]+=.*$' } | ForEach-Object {
    $name, $value = $_ -split '=', 2
    [Environment]::SetEnvironmentVariable($name.Trim(), $value, 'Process')
}
.\mvnw.cmd spring-boot:run
~~~

On macOS/Linux, run **./mvnw spring-boot:run** after exporting the same variables into the shell.

The backend listens on port **8080** locally. It uses **PORT** when a hosting platform supplies one.

### 4. Run the frontend

In the frontend project, set **VITE_API_BASE_URL=/api/v1** and start Vite with **npm run dev**. The development server runs on port **5173** and proxies **/api** requests to the backend on port **8080**.

Useful local URLs:

- Frontend: **http://localhost:5173**
- Backend health: **http://localhost:8080/actuator/health**

## 🐳 Build the backend image

The multi-stage Dockerfile builds the Spring Boot JAR, then copies only the runnable artifact into a small Java 17 runtime image. The application runs as a non-root user. Secrets and local build output are excluded by **.dockerignore**.

~~~powershell
docker build -t timesync-notes-backend:local .
~~~

The Docker image expects database, Redis, provider, and CORS settings through environment variables. The Compose file is for local PostgreSQL and Redis; it does not start the backend container.

## ☁️ Deploy the backend to Render

Create a Render Web Service using the Docker runtime and this backend folder as its root directory. Render builds the checked-in **Dockerfile**; the application reads Render’s assigned **PORT** automatically.

Use Render-managed PostgreSQL and Redis-compatible Key Value services for production. Set the backend environment variables in Render’s service settings; do not commit production secrets or add them to the Docker image.

Configure these values for production:

- **POSTGRES_HOST**, **POSTGRES_PORT**, **POSTGRES_DB**, **POSTGRES_USER**, and **POSTGRES_PASSWORD** from the Render database connection details. The current application expects these separate values rather than a single **DATABASE_URL**.
- **REDIS_HOST**, **REDIS_PORT**, and **REDIS_PASSWORD** from the Redis-compatible service.
- **YOUTUBE_API_KEY** and **GEMINI_API_KEY** for provider-backed features.
- **ALLOWED_ORIGINS** with the exact Vercel production origin, and **PUBLIC_APP_BASE_URL** with the public frontend URL.
- Other limits and timeouts as needed; defaults are defined in **application.yaml** and Java configuration.

Set the Render health check path to **/actuator/health**. The API intentionally has zero authentication, so keep request limits and provider budgets conservative. AI/playlist job tracking and some upstream cooldown state are process-local; run a single backend instance until job state and those controls are shared across instances.

## 🔌 API overview

All routes use the **/api/v1** prefix and JSON unless otherwise noted.

| Method | Route | Purpose |
| --- | --- | --- |
| **POST** | **/extract/video** | Extract a video workspace and available transcript evidence. |
| **GET** | **/extract/video/{videoId}** | Refresh or retrieve stable video workspace data. |
| **POST** | **/extract/video/transcript** | Parse and verify an imported timestamped transcript. |
| **POST** | **/extract/video/refine** | Queue AI refinement in the requested output language. |
| **GET** | **/extract/ai/jobs/{jobId}** | Read AI job status and result. |
| **POST** | **/extract/playlist** | Extract a playlist while preserving partial-success results. |
| **GET** | **/extract/playlist/{playlistId}** | Refresh playlist source data. |
| **POST** | **/extract/playlist/jobs** | Start background playlist processing. |
| **GET** | **/extract/playlist/jobs/{jobId}** | Read playlist job progress. |
| **POST** | **/notes/share** | Create an expiring read-only share. |
| **GET** | **/notes/{hashId}** | Read a shared-note snapshot. |
| **GET** | **/actuator/health** | Read service health without exposing component details. |

For throttling responses, clients should honor both the **Retry-After** header and **retryAfterSeconds** in the response body when present. Job polling routes are intentionally excluded from the application request limiter.

## 🔄 Processing flow

### Video and transcript

1. Validate the request and assign a trace ID.
2. Retrieve and cache official metadata; discover native chapters where available.
3. Treat chapter/watch-page failures as recoverable, while caption/transcript evidence remains required.
4. Parse and normalize the transcript, then apply the educational-content verification guardrail.
5. Return a verified workspace response. Pasted transcripts use the same verification requirement.

### AI draft

AI refinement is a separate asynchronous operation. The requested output language is passed to the AI workflow. Provider throttling and temporary failures return retryable status; a failed job does not replace the source transcript or editor content.

### Playlist

Playlist work can run synchronously or through a background job. Extraction uses bounded batches and preserves successful videos when other items fail. Worker counts, batch size, timeouts, and maximum playlist size are configurable.

## ⚙️ Configuration and resilience

The safe template is **.env.example**. Main settings include:

- 🗄️ **POSTGRES_*** and **REDIS_*** for local or hosted data services.
- 🔑 **YOUTUBE_API_KEY** and **GEMINI_API_KEY** for backend-only provider access.
- 🌐 **ALLOWED_ORIGINS** and **PUBLIC_APP_BASE_URL** for CORS and share links.
- 🚦 **RATE_LIMIT_PER_MINUTE**, **RATE_LIMIT_PER_DAY**, and **TRUST_FORWARDED_HEADERS** for anonymous request controls.
- 🤖 AI worker counts, request budgets, retry limits, and timeouts.
- 📺 YouTube concurrency limits, cooldowns, retries, and cache lifetimes.

Redis backs distributed request limiting and caches. Transcript-note cache lifetime defaults to seven days; YouTube player-response cache lifetime defaults to three hours; AI transcript-chunk cache lifetime defaults to two hours. YouTube cooldowns are separated by Data API, watch-page, and caption traffic and remain process-local.

If Redis is unavailable, rate limiting falls back to bounded in-memory buckets. That fallback is process-local and does not share quotas between multiple backend instances.

## 🔒 Security and operations

- The API intentionally uses zero authentication: **/api/v1/** is publicly callable. Rate limits reduce abuse but cannot guarantee a per-user quota without user identity.
- Keep **.env** and production credentials out of Git, screenshots, logs, and frontend build variables. Rotate any key that has been exposed.
- CORS should include only deployed frontend origins. Keep forwarded-header trust disabled unless a trusted proxy sanitizes those headers.
- Public actuator access is limited to **/actuator/health**; health details are hidden. Server error responses do not expose exception messages.
- Logs use trace IDs and safe error details. Do not log transcripts, API keys, cookies, signed caption URLs, or raw provider response bodies.
- PostgreSQL schema updates and **schema.sql** run at application startup. Back up production data and review schema changes before deploying them.
- Shared notes are read-only snapshots and expire after 24 hours by default.

## 🧪 Build and tests

Run the complete backend verification from this folder:

~~~powershell
.\mvnw.cmd clean install
~~~

On macOS/Linux:

~~~bash
./mvnw clean install
~~~

Tests use mocks and controlled local fixtures; they do not require live YouTube or Gemini requests. Maven output is written to **target/**, which Git and Docker ignore.
