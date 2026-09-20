# Full-Stack Email Job Scheduler (ReachInbox Assignment)

This is a full-stack email job scheduler application built for reliable scheduling and sending of emails at scale. It utilizes BullMQ for distributed task queues, PostgreSQL for persistence, and Elasticsearch for searching capabilities.

## Architecture Overview

### How Scheduling Works
1. When a user schedules an email from the frontend, an API request is made to the `POST /api/emails` endpoint.
2. The backend inserts an `EmailRecord` into the PostgreSQL database with a status of `SCHEDULED`.
3. It then enqueues a delayed job in **BullMQ** representing the email to be sent. The job payload contains the database record ID.
4. BullMQ handles the delay internally using Redis and will pick up the job exactly when it's scheduled to be executed.

### How Persistence on Restart is Handled
- **Job Persistence**: Jobs are stored in Redis (via BullMQ). If the worker crashes or restarts, BullMQ ensures jobs are preserved in Redis and retried if they were mid-execution.
- **State Synchronization**: The PostgreSQL database acts as the source of truth for email status. As BullMQ processes the job, the worker updates the PostgreSQL record (e.g., from `SCHEDULED` to `PROCESSING` to `SENT` or `FAILED`).

### How Rate Limiting & Concurrency are Implemented
- **Concurrency**: The BullMQ Worker is instantiated with a specific `concurrency` setting (configured via `WORKER_CONCURRENCY` in `.env`). This determines the maximum number of email jobs the worker will process simultaneously.
- **Rate Limiting**: BullMQ's built-in `RateLimiter` ensures that a specific sender does not exceed its configured throughput (e.g., `MAX_EMAILS_PER_HOUR`). The `Worker` configuration natively throttles the processing rate to respect the SMTP limits and avoid IP bans.

---

## Features Implemented

### Backend
- **Scheduler**: Robust delayed job scheduling utilizing Redis and BullMQ.
- **Persistence**: Reliable data persistence using PostgreSQL with fallback recovery mechanisms.
- **Rate Limiting**: BullMQ rate limiter integration to prevent SMTP rate-limit bans.
- **Concurrency**: Parallel queue processing configured for maximum throughput without overloading the database.
- **Authentication Layer**: Verifies Google ID tokens natively and handles Tenant isolation.

### Frontend
- **Login**: Secured Google OAuth integration using Google Identity Services (GSI).
- **Dashboard**: Modern sidebar-layout architecture based on provided designs.
- **Compose**: Fully functional workspace to draft emails, select senders, and pick delay/scheduling timings.
- **Tables**: Filterable, searchable, and sortable tabs for Scheduled and Sent emails.
- **Exact Figma Implementation**: 1:1 pixel-perfect mapping of the Figma UI mockups provided in the prompt.

---

## Running the Project

### Prerequisites
- Node.js 20+
- pnpm
- Docker & Docker Compose (for PostgreSQL, Redis, Elasticsearch)

### 1. Infrastructure Setup
Start the local infrastructure components using Docker Compose:
```bash
cd Scheduler_Backend
docker-compose -f docker-compose.dev.yml up -d
```

### 2. Backend Setup
1. Open the backend directory:
   ```bash
   cd Scheduler_Backend
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Set up the environment variables:
   Copy `.env.example` to `.env` (or use the provided `.env`).
4. Initialize the database and seed the required initial data (including Ethereal sender configs):
   ```bash
   pnpm run db:init
   ```
5. Start the backend development server and BullMQ worker:
   ```bash
   pnpm start
   ```
   *(The backend API will run on `http://localhost:4000`)*

### 3. Frontend Setup
1. Open the frontend directory:
   ```bash
   cd ../Scheduler_Frontend
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the Vite development server:
   ```bash
   pnpm run dev
   ```
   *(The frontend UI will be available at `http://localhost:5173`)*

---

## Setting up Ethereal Email and Env Variables

### Ethereal Email Configuration
Ethereal Email is a fake SMTP service used for development.

1. Go to [ethereal.email](https://ethereal.email/) and generate a new Ethereal account.
2. In your `Scheduler_Backend/.env` file, find the `ETHEREAL_SENDERS` JSON array variable.
3. Replace the placeholder credentials with the credentials you just generated:
   ```env
   ETHEREAL_SENDERS=[{"id":"sender-1","name":"ReachInbox Sender 1","email":"your_ethereal_email@ethereal.email","host":"smtp.ethereal.email","port":587,"user":"your_ethereal_email@ethereal.email","pass":"your_ethereal_password"}]
   ```
4. After modifying the sender in `.env`, **you must run the database seed script** to inject the new credentials into PostgreSQL:
   ```bash
   pnpm run db:init
   ```

### Google Tenant Authentication
To ensure the authenticated user can see the seeded sender:
1. In the browser, obtain your numeric Google `sub` ID (you can inspect the decoded JWT token payload).
2. Assign it to `sender-1` inside `Scheduler_Backend/.env`:
   ```env
   SENDER_TENANT_ASSIGNMENTS=[{"senderId":"sender-1","tenantId":"google:<YOUR_NUMERIC_GOOGLE_SUB>"}]
   ```
3. Run `pnpm run db:init` again to update the tenant relationship in the database.

---

## Notes: Assumptions, Shortcuts, and Trade-offs

1. **Authentication (Assumption & Shortcut)**: 
   - **Assumption**: We assume users will only authenticate via Google.
   - **Shortcut**: Instead of building a full JWT issuance backend with a dedicated user database, the backend directly verifies the Google ID token provided by Google Identity Services on every request. This eliminates the need to manage custom session cookies or custom access tokens.
2. **Tenant Mapping (Shortcut)**: 
   - **Shortcut**: The user's Google `sub` (subject ID) is used directly as the `tenant_id` for multi-tenancy. This avoids creating an intermediary `User` or `Tenant` table, simplifying the architecture for this assignment. Sender assignment is hardcoded via the `.env` seeding script instead of building a full UI for users to manage their own SMTP credentials.
3. **Email Persistence vs BullMQ Payload (Trade-off)**:
   - **Trade-off**: Instead of storing the full email content (subject, body, recipients) directly in the BullMQ job payload, it's stored in PostgreSQL, and only the `email_id` is sent to BullMQ.
   - **Why**: This prevents Redis from bloating with large email payloads and maintains a single source of truth (PostgreSQL) for email status and content, making it easier to search and audit later.
4. **Error Handling & Retries (Trade-off)**:
   - **Trade-off**: The BullMQ worker is configured to fail the job if Ethereal SMTP rejects the credentials (e.g., 535 Authentication failed), moving it to a `FAILED` state immediately.
   - **Why**: We chose not to implement exponential backoff for authentication failures because they are fatal (credentials won't magically fix themselves). Network timeouts could be retried, but auth errors fail fast.
5. **Elasticsearch Indexing (Shortcut)**:
   - **Shortcut**: Elasticsearch is configured via `docker-compose` but a dedicated background sync worker was skipped. Instead, emails can be indexed inline or periodically. In a production scenario, we'd use Logstash or a dedicated BullMQ queue just for ES indexing to avoid blocking the main API.
