# Service Operations Tracker

A sanitised portfolio edition of a full-stack service workflow platform. It demonstrates the architecture and engineering patterns of the original application without production credentials, customer records, company branding, deployment links or inherited Git history.

The repository starts with a single sanitised commit. All names, email addresses and examples are fictional.

## What it demonstrates

- React 19 and TypeScript application architecture
- Responsive operational dashboards and workflow views
- Node.js and Express REST APIs
- Prisma ORM with PostgreSQL
- JWT authentication, password hashing and one-time-code flows
- Role-based access control
- Client, order, proposal and budgetary-quote CRUD workflows
- Configurable workflow steps, SLA monitoring and audit history
- Optional SMTP notifications using environment-only configuration
- Git hygiene, environment isolation and secret-safe defaults

## Technology

| Layer | Technology |
|---|---|
| Front end | React 19, TypeScript, Vite and Tailwind CSS v4 |
| Components | shadcn/ui and Lucide icons |
| API | Node.js, Express and tsx |
| Data | PostgreSQL and Prisma |
| Authentication | JWT and bcrypt |
| Email | Nodemailer with optional SMTP |

## Safe local setup

Prerequisites:

- Node.js 20 or later
- A local or isolated PostgreSQL database containing demo data only

1. Install dependencies:

   ```bash
   npm ci
   ```

2. Create local configuration:

   ```bash
   cp .env.example .env
   ```

3. Replace the placeholders in `.env`. Generate a unique JWT secret with:

   ```bash
   openssl rand -base64 48
   ```

4. Prepare the demo database:

   ```bash
   npm run db:push
   npm run db:seed
   ```

5. Run the API and front end in separate terminals:

   ```bash
   npm run dev:server
   npm run dev
   ```

The Vite client uses port 5173 and proxies `/api` requests to the Express API on port 3000.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string; required |
| `JWT_SECRET` | Random secret of at least 32 characters; required |
| `ALLOWED_EMAIL_DOMAINS` | Comma-separated domains allowed to request a login code |
| `ADMIN_EMAILS` | Comma-separated addresses that receive the administrator role |
| `APP_URL` | Base URL used in application links |
| `CORS_ORIGIN` | Allowed browser origin for the API |
| `EMAIL_ENABLED` | Enables SMTP only when explicitly set to `true` |
| `SMTP_*` | Optional SMTP host, port, security and credentials |
| `FROM_EMAIL` | Sender name and address |
| `DEMO_ADMIN_*` | Fictional seed account details; set a password to use local password login |

See `.env.example` for demo-safe values. Never reuse its placeholders in production.

## Useful commands

```bash
npm run dev          # Start the Vite development server
npm run dev:server   # Start the Express API with reloads
npm run build        # Generate Prisma Client and build the front end
npm run lint         # Type-check the project
npm run db:push      # Apply the schema to a disposable database
npm run db:seed      # Add fictional workflow and administrator records
```

## Repository safety

- No original commit history is included.
- No `.env`, database export, customer attachment or credential file is tracked.
- Browser bundles do not receive server-side API keys.
- Authentication fails closed when `JWT_SECRET` is missing or too short.
- Email delivery is disabled by default and uses environment configuration only.
- Company names, personal addresses, production URLs and branded artwork have been replaced.

Before using this project beyond a portfolio review, complete a threat model, add automated tests and apply production-specific controls for rate limiting, cookies or token storage, file uploads, CORS and database migrations.
