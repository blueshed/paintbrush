# Deploying to Railway

Paintbrush uses SQLite for storage, so it needs a **persistent volume** to survive redeploys. Railway provides this as an attachable volume.

## Prerequisites

- A [Railway](https://railway.com) account
- Your project pushed to a GitHub repo

## Steps

### 1. Create a new project

In the Railway dashboard, click **New Project → Deploy from GitHub repo** and select your repository.

Railway detects the `Dockerfile` and builds automatically.

### 2. Add a volume

In your service's **Settings → Volumes**, add a volume:

| Setting    | Value     |
|------------|-----------|
| Mount path | `/data`   |

This gives your container a persistent `/data` directory that survives redeploys and restarts.

### 3. Set environment variables

In **Settings → Variables**, add:

| Variable  | Value          | Why                                          |
|-----------|----------------|----------------------------------------------|
| `DB_PATH` | `/data/app.db` | Points SQLite at the persistent volume        |
| `PORT`    | Set by Railway  | Railway injects this automatically — no action needed |

`server.ts` reads both of these:

```ts
const dbPath = process.env.DB_PATH ?? "./data/app.db";
// ...
Bun.serve({ port: process.env.PORT || 3001, ... });
```

### 4. Deploy

Push to your main branch. Railway builds from the Dockerfile and starts the container. The first request creates the SQLite database and tables automatically.

### 5. Verify

Once deployed, Railway gives you a public URL. Visit it and check:

- Home page loads
- Create/edit/delete resources
- Backup: `curl https://your-app.up.railway.app/admin/backup -o backup.db`
- Restore: `curl -X POST https://your-app.up.railway.app/admin/restore --data-binary @backup.db`

## How it works

```
Railway Container
├── /app              → your code (rebuilt on each deploy)
└── /data             → persistent volume (survives deploys)
    └── app.db        → SQLite database
```

The `Dockerfile` copies your code into `/app` and runs `bun server.ts`. The `DB_PATH` environment variable tells the server to store the database on the mounted volume instead of inside the container's ephemeral filesystem.

## Backup and restore

The admin controller provides backup/restore endpoints. Since SQLite is a single file, backups are straightforward:

- **Download:** `GET /admin/backup` — returns the serialised database
- **Upload:** `POST /admin/restore` — replaces the database (live, no restart needed)

You can also back up by downloading the volume contents directly from Railway's dashboard.

## Notes

- **SQLite is single-writer.** This works well for small-to-medium apps on a single Railway container. If you need horizontal scaling, swap the `sqliteStore` for a networked database.
- **WAL mode** is enabled by default, so reads don't block writes.
- **No migration system yet.** Table schemas are created automatically on first access. If you change field shapes, the JSON-in-SQLite approach means old rows keep their original shape until updated.
