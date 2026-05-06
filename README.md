# mma365-admin

Administration web app for the MMA365 platform. Allows managing events, fighters, and sending global push notifications. Built with Next.js 15 App Router.

**Runs locally alongside the Python scrapers. Not intended for public deployment.**

---

## Stack

| Tool | Purpose |
|---|---|
| Next.js 15 (App Router) | Framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| Supabase (`@supabase/ssr`) | Database + auth |

---

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in the values (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/login` if not authenticated.

### Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...           # service role key — bypasses RLS for admin writes
SCRAPERS_PATH=C:\path\to\mma-scrapers  # absolute path to the mma-scrapers repo
PYTHON_CMD=python                  # optional, defaults to "python"
```

`SUPABASE_SERVICE_KEY` is the service role key found in Supabase → Project Settings → API. It is never exposed to the browser — only used in server-side API routes.

---

## Authentication

Login at `/login` with email + password (Supabase Auth). All `/` routes are protected by `middleware.ts` — unauthenticated requests are redirected to `/login`.

---

## Project Structure

```
mma365-admin/
├── app/
│   ├── (admin)/                    # Protected admin routes (Sidebar layout)
│   │   ├── layout.tsx              # Sidebar + main content wrapper
│   │   ├── page.tsx                # Dashboard — stats cards
│   │   ├── events/
│   │   │   ├── page.tsx            # Events list — search + pagination
│   │   │   ├── new/page.tsx        # Create new event
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Server Component — fetches event + fights
│   │   │       └── EventEditForm.tsx  # Client Component — form + Sherdog sync panel
│   │   ├── fighters/
│   │   │   ├── page.tsx            # Fighters list — search + pagination
│   │   │   ├── new/page.tsx        # Create new fighter
│   │   │   └── [id]/
│   │   │       ├── page.tsx        # Server Component — fetches fighter
│   │   │       └── FighterEditForm.tsx  # Client Component — form
│   │   └── notifications/
│   │       └── page.tsx            # Send global push notification
│   ├── api/
│   │   ├── events/[id]/route.ts    # PATCH + DELETE — uses service key
│   │   ├── fighters/[id]/route.ts  # PATCH + DELETE — uses service key
│   │   ├── notify/route.ts         # POST — sends push via Expo API
│   │   └── scrape/event/route.ts   # POST — SSE stream of update.py output
│   ├── login/page.tsx              # Login form
│   └── layout.tsx                  # Root layout
├── components/
│   ├── Sidebar.tsx                 # Navigation sidebar + logout
│   ├── SearchBar.tsx               # Debounced search input (URL-based)
│   └── Pagination.tsx              # Page navigation links
├── lib/
│   └── supabase/
│       ├── client.ts               # Browser client (anon key)
│       └── server.ts               # Server client (anon) + admin client (service key)
└── middleware.ts                   # Auth guard — redirects unauthenticated requests
```

---

## Pages

### Dashboard (`/`)
Three stat cards: total events, total fighters, upcoming events.

### Events (`/events`)
- Searchable table (filters on name + organization), 20 results per page
- Links to edit each event

### Event Edit (`/events/[id]`)
- Edit: name, organization, date, venue, city, country, accent color
- Sherdog Sync panel (see below)
- Read-only list of associated fights with results

### Fighters (`/fighters`)
- Searchable table (filters on first + last name), 20 results per page

### Fighter Edit (`/fighters/[id]`)
- Edit all fighter fields: name, nickname, org, division, country, record, DOB, height, reach, stance, image URL

### Notifications (`/notifications`)
Send a global push notification to all users with `notify_global = true`. Uses the Expo Push API via `/api/notify`.

---

## Sherdog Sync

On any event edit page, if the event has a `sherdog_url`, a **Synchroniser depuis Sherdog** panel is available.

### Flow

1. **Prévisualiser** → streams `python update.py --event-url <url> --dry-run` output in real-time
   - Shows exactly what would change: new fights, result updates, renamed events
2. **Appliquer les changements** → runs `python update.py --event-url <url>` (writes to DB)

The same `update.py` used by GitHub Actions is called directly — no separate script to maintain.

### Requirements
- `SCRAPERS_PATH` must point to the `mma-scrapers` directory
- Python must be installed and accessible via `PYTHON_CMD` (default: `python`)
- The scraper's own `.env` must be configured with Supabase credentials

### Technical notes
- Uses SSE (`text/event-stream`) to stream stdout line by line
- Python launched with `-u` (unbuffered) and `PYTHONIOENCODING=utf-8` to get real-time output on Windows
- Works locally only — `child_process.spawn` is not available on Vercel serverless

---

## API Routes

All API routes use the Supabase **service role key** (bypasses RLS). They are not authenticated at the route level — only accessible to users who are already logged in via the admin UI.

| Route | Method | Description |
|---|---|---|
| `/api/events/[id]` | `PATCH` | Update event fields |
| `/api/events/[id]` | `DELETE` | Delete event |
| `/api/fighters/[id]` | `PATCH` | Update fighter fields |
| `/api/fighters/[id]` | `DELETE` | Delete fighter |
| `/api/notify` | `POST` | Send global push notification |
| `/api/scrape/event` | `POST` | Stream `update.py` output via SSE |

---

## Deployment

Currently intended for local use only. When moving to a VPS:

```bash
npm run build
pm2 start npm --name mma365-admin -- start
```

Serve behind nginx on a private port or with basic auth.
