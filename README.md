# team-notes-api

A REST API for small teams to create, organize, and share notes.

## Tech stack

- Node.js + Express
- PostgreSQL 16 (run via Docker Compose)
- `pg` for database access
- Jest + Supertest for tests

## Getting started

### Prerequisites

- Node.js 20+
- Docker (running)

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

## Running tests

With Postgres running:

```bash
npm test                    # run the test suite
npm run test:coverage       # run with a coverage report
```

The tests are integration tests: they send real HTTP requests to the
app and run against the real database, because the access rules live
in the SQL queries. Each test resets the database to the seed data,
so **running the tests wipes any notes you created by hand**.

## Authentication

Every request except `/health` must include an `X-User-Id` header
with the ID of an existing user:

```bash
curl -H "X-User-Id: 2" localhost:3000/teams/1/notes
```

A missing, invalid, or unknown ID returns `401`. This is a stand-in
for real authentication (see trade-offs below).

## Seed data

| User      | Teams               |
|-----------|---------------------|
| 1 – Alice | Engineering, Design |
| 2 – Bob   | Engineering         |
| 3 – Carol | Design              |

Team 1 is Engineering, team 2 is Design.

| Note | Team        | Author |
|------|-------------|--------|
| 1    | Engineering | Alice  |
| 2    | Engineering | Bob    |
| 3    | Design      | Carol  |

Run `npm run db:seed` at any time to reset the data.

## Endpoints

| Method | Path                   | Description                       |
|--------|------------------------|-----------------------------------|
| GET    | `/health`              | Service and database health check |
| GET    | `/teams/:teamId/notes` | List a team's notes               |
| POST   | `/teams/:teamId/notes` | Create a note in a team           |
| GET    | `/notes/:noteId`       | Get a single note                 |
| PATCH  | `/notes/:noteId`       | Update a note's title and/or body |
| DELETE | `/notes/:noteId`       | Delete a note                     |

### Access rules

- Team members can read and create notes in their teams.
- Only a note's author can edit or delete it.
- Users outside a team get `404` for that team and its notes, so
  they can't tell whether those exist.

The examples below use the seed data.

### Health check

```bash
curl localhost:3000/health
```

### List a team's notes

```bash
curl -H "X-User-Id: 2" localhost:3000/teams/1/notes
```

Bob (user 2) is in Engineering (team 1), so this returns its notes.
He isn't in Design (team 2), so this returns `404`:

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
characters); `body` is optional. The author is always the current
user.

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

### Delete a note

```bash
curl -i -X DELETE localhost:3000/notes/2 -H "X-User-Id: 2"
```

Note 2 was written by Bob (user 2), so this returns `204 No Content`.
As Alice (user 1), who's on the team but isn't the author, it returns
`403`. As Carol (user 3), who isn't on the team, it returns `404`.

`-i` shows the status code, since a `204` response has no body.

### Errors

All errors return JSON in the form `{"error": "message"}`.

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
- **Only authors can edit or delete their notes.** Teammates get
  `403` (they can see the note, so `404` would be misleading).
  Shared editing would be a small change if teams wanted it.
- **404 instead of 403 for outsiders**, so they can't tell whether a
  team or note exists.
- **PostgreSQL.** The data is relational (users ↔ teams ↔ notes), so
  membership checks are simple joins enforced by foreign keys. Chosen
  over SQLite for production realism and over MongoDB because the
  access rules fit relational data better.
- **Docker Compose** so the database runs with one command and no
  local install.
- **`/notes/:noteId` instead of `/teams/:teamId/notes/:noteId`.** Note
  IDs are already unique, so the shorter URL is simpler; the team
  check still happens in the query.
- **Hard deletes.** Deleted notes are removed permanently. A
  production app might use soft deletes (a `deleted_at` column) to
  allow recovery and auditing.
- **Parameterized queries** throughout to prevent SQL injection.

## Trade-offs and out of scope

- **No real authentication.** `X-User-Id` is trusted as-is. In
  production this would be replaced by sessions or JWTs.
- **No migration tool.** The schema is applied with
  `CREATE TABLE IF NOT EXISTS`. A real project would use versioned
  migrations (e.g. node-pg-migrate).
- **Tests share the development database.** A separate test database
  would keep test runs from wiping local data.
- **Local