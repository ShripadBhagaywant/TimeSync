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

## ☁️ Deploy the backend to Railway

The backend is an isolated Docker service in this monorepo. In Railway, connect the GitHub repository `ShripadBhagaywant/TimeSync` and branch `main`, set the service root directory to `/backend`, and use the checked-in `Dockerfile` at that directory's root. Leave the start command empty so Railway uses the Docker image entrypoint. The Docker build context must be the `backend/` directory.

Configure the service as follows:

- **Region:** Singapore, close to the current Neon and Upstash database regions.
- **Replicas:** one. AI job tracking and some YouTube cooldown state are process-local; multiple replicas can lose job continuity or enforce inconsistent cooldowns.
- **Public networking:** generate a Railway domain for the API.
- **Health check path:** `/actuator/health`. This endpoint returns only basic health and hides component details. Railway uses it to decide whether a new deployment is ready; configure separate monitoring for ongoing health.
- **Port:** do not hard-code a Railway port. Spring Boot listens on Railway's injected `PORT`; `SERVER_PORT` remains a local fallback.
- **Watch paths:** optional; if used, use `/backend/**` because Railway watch patterns are relative to the repository root.

### Railway environment variables

Add these through the Railway service Variables screen. Do not paste production values into this README or commit an env file.

**Neon PostgreSQL**

- `SPRING_DATASOURCE_URL`: JDBC format using the Neon pooled hostname, database name, and `?sslmode=require` (you may also retain Neon’s `channel_binding=require` query option).
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`

The application does not consume Neon’s `DATABASE_URL` or `DATABASE_URL_POOLED` names directly. Supply the equivalent JDBC URL through `SPRING_DATASOURCE_URL`.

**Upstash Redis over TLS**

- `REDIS_HOST`: hostname only, without scheme or port.
- `REDIS_PORT`: normally `6379` for the TCP endpoint.
- `REDIS_PASSWORD`: the Upstash TCP password.
- `REDIS_SSL=true`: turns on TLS for the custom Lettuce connection used by the distributed rate limiter.
- `SPRING_DATA_REDIS_SSL_ENABLED=true`: turns on TLS for Spring Data Redis caches.

Do not use the Upstash REST URL/token for this Java Redis client.

**External providers and browser URLs**

- `YOUTUBE_API_KEY` and `GEMINI_API_KEY`: backend-only credentials. Rotate any values exposed in chat or logs before production.
- `ALLOWED_ORIGINS`: exact Vercel production origin(s), comma-separated, with no trailing slash.
- `PUBLIC_APP_BASE_URL`: public Vercel origin used when creating share links.

Set other supported limits and timeouts only when needed; defaults are listed in `.env.example` and `src/main/resources/application.yaml`. Railway provides `PORT` automatically. Never put these credentials in `frontend/.env` or any `VITE_*` variable.

### First deployment checks

1. Confirm Railway is building from `/backend` with the Dockerfile, then wait for the deployment health check to pass.
2. Open `https://<railway-domain>/actuator/health`; expect a successful response with no component details.
3. Configure Vercel `VITE_API_BASE_URL` as `https://<railway-domain>/api/v1`, then redeploy the frontend.
4. Test a real extraction, transcript import, AI draft, and share flow from the deployed frontend. Review Railway logs for database/Redis/provider connection errors, without exposing secret values.
5. Keep one backend replica until process-local AI job state and upstream cooldown state are made shared.

The API intentionally has zero authentication. Rate limits and provider budgets help manage anonymous use but are not per-user quotas. Monitor provider usage and hosting costs after launch.
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

AI refinement is a separate asynchronous operation. The requested output language is passed to the AI workflow. Provider throttling and temporary failures return retryable status; a failed job does not replace the source transcript or editor content. Transcript text is sent to Gemini for verification and drafting. With Gemini's unpaid quota, Google may use submitted prompts and responses to improve its services, and human reviewers may process them. Do not submit sensitive, confidential, or personal information. See the [Gemini API terms](https://ai.google.dev/gemini-api/terms).

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
