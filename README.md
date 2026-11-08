# team-notes-api

A REST API for small teams to create, organize, and share notes.

## Tech stack

- Node.js + Express
- PostgreSQL 16 (run via Docker Compose)
- `pg` for database access

## Getting started

### Prerequisites

- Node.js 20+
- Docker

### Setup

```bash
npm install
docker compose up -d        # start Postgres
npm run db:init             # create tables
npm run db:seed             # load sample users, teams and notes
npm start                   # start the API on http://localhost:3000
```

Check it's running:

```bash
curl localhost:3000/health
# {"status":"ok","db":"ok"}
```

## Authentication

Requests identify the user with an `X-User-Id` header:

```bash
curl -H "X-User-Id: 1" localhost:3000/me
```

This is a stand-in for real authentication (see trade-offs below).

## Seed data

| User      | Teams                |
|-----------|----------------------|
| 1 – Alice | Engineering, Design  |
| 2 – Bob   | Engineering          |
| 3 – Carol | Design               |

Team 1 is Engineering, team 2 is Design.

| Method | Path                   | Description                        |
|--------|------------------------|------------------------------------|
| GET    | `/health`              | Service and database health check  |
| GET    | `/teams/:teamId/notes` | List a team's notes                |
| POST   | `/teams/:teamId/notes` | Create a note in a team            |
| GET    | `/notes/:noteId`       | Get a single note                  |
| PATCH  | `/notes/:noteId`       | Update a note's title and/or body |

All endpoints except `/health` require an `X-User-Id` header.
The examples below use the seed data.

### Health check

```bash
curl localhost:3000/health
```

### Current user

```bash
curl -H "X-User-Id: 1" localhost:3000/me
```

### List a team's notes

```bash
curl -H "X-User-Id: 2" localhost:3000/teams/1/notes
```

Bob (user 2) is in Engineering (team 1), so this returns its notes.
He isn't in Design, so this returns `404`:

```bash
curl -H "X-User-Id: 2" localhost:3000/teams/2/notes
```

### Create a note

```bash
curl -X POST localhost:3000/teams/1/notes \
  -H "X-User-Id: 2" \
  -H "Content-Type: application/json" \
  -d '{"title": "Standup notes", "body": "Discussed the release."}'
```

Returns `201` with the created note. `title` is required (max 200
characters); `body` is optional.

### Get a single note

```bash
curl -H "X-User-Id: 2" localhost:3000/notes/1
```

Note 1 belongs to Engineering, so Bob can see it. Note 3 belongs to
Design, so this returns `404`:

```bash
curl -H "X-User-Id: 2" localhost:3000/notes/3
```
### Update a note

Send `title`, `body`, or both. Fields you leave out stay unchanged.

```bash
curl -X PATCH localhost:3000/notes/1 \
  -H "X-User-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{"title": "Sprint planning (updated)"}'
```

Note 1 was written by Alice (user 1), so this succeeds. The same
request as Bob (user 2) returns `403`, since he's on the team but
isn't the author. As Carol (user 3), who isn't on the team, it
returns `404`.

### Errors

| Status | Meaning                                              |
|--------|------------------------------------------------------|
| 400    | Invalid input (e.g. missing title, bad id)           |
| 401    | Missing, invalid, or unknown `X-User-Id`             |
| 403    | You can see the note but aren't allowed to change it |
| 404    | Not found, or you're not a member of its team        |
| 500    | Unexpected server error                              |

## Design decisions

- **Notes belong to teams, not users.** Access comes from team
  membership, which makes sharing the default.
- **PostgreSQL.** The data is relational (users ↔ teams ↔ notes), so
  membership checks are simple joins enforced by foreign keys. Chosen
  over SQLite for production realism and over MongoDB because the
  access rules fit relational data better.
- **Docker Compose** so the database runs with one command and no
  local install.
- **404 instead of 403** for teams you don't belong to, so outsiders
  can't tell whether a team exists.
- **Parameterized queries** throughout to prevent SQL injection.

## Trade-offs and out of scope

- **No real authentication.** `X-User-Id` is trusted as-is. In
  production this would be replaced by sessions or JWTs.
- **No migration tool.** The schema is applied with
  `CREATE TABLE IF NOT EXISTS`. A real project would use versioned
  migrations (e.g. node-pg-migrate).
- **Local credentials** in `docker-compose.yml` are for development
  only; production would use environment variables or a secrets
  manager.