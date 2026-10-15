# Realtime Duty Selection — Plan

**Status:** built and verified locally (Phases 1 + 2) · **Date:** 2026-10-07 · decisions in §7

Two asks:

1. **One duty, one teacher.** If 5 teachers click the same duty at the same moment, exactly one gets it.
   The other four get a clear "just taken" message, and none of them ends up holding it.
2. **Live updates.** When anyone takes or releases a duty, every open page (teacher select-duty screens,
   dashboards, CS Manage Duties, exam room views) updates on its own, the way a socket.io chat does. No
   refresh needed.

---

## 1. What happens today

The claim is a two-step **check, then insert**: `validateConflicts` asks whether anyone already holds
this room for this role, then `dutyRepository.create` inserts the duty (`duty.service.js:227-229`).
Concurrent requests interleave between those two steps, so all of them see the room as free and all of
them insert:

```
T1: check → free      T2: check → free      T3: check → free
T1: insert ✅          T2: insert ✅          T3: insert ✅     ← three teachers, one room
```

The transaction doesn't stop this. Each teacher inserts a *different* document, so MongoDB sees no
conflict. Only a unique index would block it, and `Duty` has none (`duty.model.js:111-114`; the comment
at `duty.service.js:313` mentions a "room-unique duty index" that doesn't exist).

| Role | Concurrent claims today |
|---|---|
| Invigilator | Several can win |
| RS group | Several can win the whole group (checks at `:340` run before the transaction at `:345`) |
| DCS group | One wins, but only on a replica set: every claim writes the same `DCSGroup` document, so MongoDB's write-conflict retry catches it. On standalone Mongo, duplicates are possible. |

Pages don't update live either. React Query `staleTime` is 60s and nothing on the duty screens polls,
so a teacher keeps seeing a free slot until they refetch or click it.

---

## 2. Phase 1: guarantee a single winner (backend only, no new dependencies)

The database becomes the referee. Application-level checks can always be raced; a unique index can't.

### 2.1 Partial unique index on `Duty`

```js
dutySchema.index(
  { examRoom: 1, role: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "assigned", examRoom: { $type: "objectId" } },
    name: "one_live_duty_per_slot",
  }
);
```

- **Why `examRoom`:** an `ExamRoom` is one room in one schedule, which is exactly one duty slot. This
  key covers invigilator, RS (one duty per room), and DCS (one duty per room) with a single rule.
- **`status: "assigned"` only:** cancelled duties don't count, so a released slot can be claimed again.
- **`examRoom` must be an ObjectId:** this skips legacy exam-based duties that have no `examRoom` (2 in
  the 2026-09-30 dump).
- **Existing writers stay compatible.** Every swap and move path cancels the old duty *before* creating
  the new one, inside one transaction (`changeRequest.service.js` DCS swap `~:641→661`, RS swap
  `~:783→799`, move `~:906→924`). A plain swap only changes `teacher` on the existing duty. No code
  path creates a second live duty on a slot on purpose.

### 2.2 What the losers see

- **Invigilator:** the insert fails with E11000. `errorHandler.js` gets a case for this index that
  returns **409 "This duty was just taken by someone else."** The select-duty page already shows
  per-slot error messages (`useDutySelection.ts:145`) and refetches on settle.
- **RS/DCS groups:** the failing room aborts the transaction, so the whole group rolls back. A teacher
  never ends up with a partial group.
- **DCS (belt and braces):** the claim flips the group `open → claimed` *first*, conditionally
  (`claimIfOpen`). Only one concurrent claim can match, and the rest get the existing "already taken"
  409 before writing any duty. DCS stays safe without relying on write-conflict retry, and on
  standalone Mongo too.
- **Standalone Mongo (no transaction):** `dutyRepository.createMany` deletes the rooms it already wrote
  when a later room fails, and the DCS claim hands the group back. A lost race never leaves a partial
  group, whatever the deployment.

### 2.3 Rolling the index out safely

Mongoose builds the index when the server boots. **If production already has duplicate live duties,
the build fails** (it only logs; it doesn't crash) and the protection silently isn't there. So:

- New `backend/scripts/check-duplicate-duties.js` lists slots with more than one live duty and whether
  the index exists. It exits 1 until both are fine. It **never changes duties**: duplicates are resolved
  through CS → Manage Duties → Unassign, which notifies the teacher who is taken off. A script cancel
  would skip the emitter. `--build-index` builds the index once the data is clean.
- The server also logs `[duty] index build failed — concurrent claims are NOT protected` at boot if the
  build fails, instead of failing silently.
- It runs against production before or right after deploy. The 2026-09-30 dump has **0 duplicates**
  across 44 live duties, which is a good sign but not proof for today.
- The script then checks that the index exists, so we *know* the protection is live.

### 2.4 Proof

New suite `tests/14-concurrency.test.js`, wired into `runner.js`:

- 5 teachers fire `POST /duties/self-assign` at the **same invigilator slot** at once → exactly
  1 × 201 and 4 × 409, and the DB holds one live duty for that slot.
- Same for an **RS group** (one teacher gets all of its rooms, the others get nothing) and a **DCS group**.
- After the winner releases, someone else can claim the slot (the partial index ignores cancelled
  duties).

This runs locally against a Docker Mongo **replica set** (transactions don't work on standalone), and
in CI.

---

## 3. Phase 2: live updates over socket.io

### 3.1 Design in one paragraph

The server pushes a **content-free signal**: `duties:changed`, with no payload at all. It never
pushes duty data or names. Each open page reacts by refetching what's on screen through the
**existing, already-authorized** API calls. The socket therefore adds no second data path to secure,
and "only CS sees who holds a duty" stays exactly as it is. React Query refetches only the queries
mounted right now; everything else is just marked stale.

### 3.2 Backend

- **Dependency:** `socket.io`.
- **`backend/shared/realtime/`:** attaches socket.io to the HTTP server (`server.js` switches
  `app.listen` to `http.createServer(app)`).
  - **Path `/api/socket.io`.** It rides the existing nginx `/api` location and the Vite `/api` proxy, so
    no new public route is needed.
  - **Handshake auth** uses the same rules as `protect`: a valid JWT with an `activeRole`, the user
    exists, and the role is still in `roles`. A `tempToken` (role not chosen yet) is refused.
  - **Prod can't crash because of it.** If `socket.io` fails to load (for example, the deploy skipped
    `npm install`), the server logs a warning and runs exactly as today, without realtime.
- **Where the signal fires:** Mongoose middleware on **`Duty`** and **`DCSGroup`** (save, insertMany,
  updateOne/updateMany/findOneAndUpdate, delete*). These hooks catch every write path at once
  (self-claims, CS assign/unassign, swaps and moves, exam deletion cleanup, DCS release) plus any future
  one, without touching each service.
  - **Debounced ~300 ms, trailing.** A 5-room group claim becomes **one** event, and it lands after the
    transaction has committed, so clients refetch committed state.
  - **Quiet:** no background job writes `Duty` (checked: the reminder and calendar jobs only read), so
    there's no periodic spam.

### 3.3 Frontend

- **No new dependency.** `src/shared/realtime/socketClient.ts` loads the socket.io client from the
  backend at runtime (`/api/socket.io/socket.io.esm.min.js`, served by socket.io itself), so the client
  always matches the server. A backend without socket.io returns 404 there and the page simply isn't
  live. See §7.
- **`src/shared/realtime/useRealtimeSync.ts`** is mounted once in **`AuthGuard`**, which all four
  layouts use (CS `ProtectedLayout`, Invigilator, RS, DCS).
  - It connects with the current token, reconnects on role switch or re-login, and disconnects on
    logout.
  - On `duties:changed`, it invalidates the duty query families the app already uses after its own
    mutations: `["shared"]` (exam-groups, duty-status, duties-by-teacher), `["dcs"]`, `["duties"]`,
    `["duty-calculation"]`, `["manage-duties"]`, `["change-requests"]`, `["exam-groups"]`,
    `["invigilators-for-rooms"]`.
  - On **reconnect**, it invalidates once to catch up on anything missed while offline (laptop sleep,
    network drop).
- **`vite.config.ts`:** add `ws: true` to the `/api` proxy (dev and preview).
- **Hidden tabs** only mark data stale, and React Query refetches them on focus. Server-side bursts are
  coalesced: a signal goes out 300 ms after writes go quiet, and at least every 2 s during a sustained
  rush.
- **Result:** Teacher A takes Room 004 → about 0.3 s later Room 004 shows **Occupied/Full** on Teacher
  B's screen, CS's Manage Duties count moves, and the exam room modal updates.

### 3.4 Graceful degradation

1. WebSocket blocked (nginx not yet configured): socket.io **falls back to HTTP long-polling** on its
   own. Updates are still effectively live.
2. Both fail: pages behave exactly as they do today, and Phase 1 still guarantees one winner.

---

## 4. Deployment: blocking questions

Edits in this repo auto-push and auto-deploy to proctavo.com, so these need answers before Phase 2
lands:

1. **Does the production deploy run `npm install` (backend) and `npm install && npm run build`
   (frontend)?** The backend is safe either way because of the guarded require. If the frontend build
   doesn't install new packages, `socket.io-client` breaks the build.
2. **Is production a single Node process** (plain `node`/`pm2` with one instance, not pm2 cluster
   mode)? Multiple processes would need sticky sessions plus a Redis adapter for socket.io. That's out
   of scope, and the in-process schedulers would already be running N times.
3. **Can I see or change the nginx config** (and which host/key)? For true WebSockets instead of
   long-polling, the `/api` location needs:
   ```nginx
   proxy_http_version 1.1;
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   proxy_read_timeout 75s;
   ```
4. **Is production MongoDB a replica set?** If it's standalone, group claims run without a transaction.
   I'd add a small compensating cleanup (delete the rooms already created when a later room hits the
   index), so a lost RS race can't leave half a group.

---

## 5. Build order

| Step | What | Visible in prod? |
|---|---|---|
| 1 | Phase 1: index, 409 message, conditional DCS update, duplicate script, concurrency tests | Yes, race-proof claims |
| 2 | Run `check-duplicate-duties.js` against prod and confirm the index exists | — |
| 3 | Phase 2 backend: socket server, auth, model hooks (guarded, can't crash prod) | Invisible until the frontend ships |
| 4 | Phase 2 frontend: `useRealtimeSync`, Vite proxy | Yes, live pages |
| 5 | nginx upgrade headers (if approved) | WebSocket instead of polling |

Verification at each step: `npm run build` (frontend type-check), the full API suite, the new
concurrency suite, `check-architecture.js`, and a two-browser manual check (claim in one window, watch
it flip in the other).

## 6. Not in this plan (easy follow-ons once the socket exists)

- Live **chat** (`/api/messages` currently polls every 5s) and the live **notification bell** (polls
  every 30s): same socket, add an event.
- Live updates when CS **publishes or deletes an exam** (hooks on `ExamGroup`/`ExamRoom`).
- A "Live" connection dot in the navbar.
- Same-teacher double-booking across two *different* overlapping slots in one instant (a double-click
  race). A time-range overlap can't be a unique index; the claim button is disabled while a request is
  pending, which covers the realistic case.

---

## 7. Decisions and verification (2026-10-07)

**Decisions made while building**

- **Deploy questions 1–4 weren't answered, so nothing depends on them.** If the backend's `socket.io`
  can't load, the server logs a warning and runs as before. The frontend gained no npm dependency
  (client loaded from the backend at runtime), so a deploy that skips `npm install` can't break the
  build. Without nginx upgrade headers, socket.io uses HTTP long-polling, which was verified.
  **Still assumed:** production runs a single Node process. pm2 cluster mode would need sticky sessions,
  and the in-process schedulers already assume one process.
- **No `scheduleIds` in the signal.** Every duty screen shows all open exams, so pages refetch their
  duty queries regardless; a payload would add nothing yet.
- **Duplicates are reported, never auto-fixed** (§2.3). Removing a teacher must go through Unassign so
  they're notified.
- **CORS allowlist** moved to `backend/shared/config/cors.js`, shared by Express and the socket. The
  token rules moved to `shared/utils/authenticateToken.js`, shared by `protect` and the socket
  handshake. `protect`'s behaviour is unchanged.

**Verified locally**

- Bug reproduced first: with the index dropped, 5 simultaneous claims gave **3 winners** for one room.
- With the fix: the full API suite, including new `14-concurrency`, passes **126/126** on a replica set
  and on standalone Mongo (CI's setup). The race suite passed 6/6 and 4/4 reruns respectively.
- DCS: 4 simultaneous claims → 1 winner, 3 × 409, the group holds only the winner's duties, on both
  setups.
- Socket: auth enforced (no token, a garbage token, and a role-less `tempToken` are all refused). A
  claim reaches other teachers in ~320 ms. A 3-room group claim is one signal. A CS unassign reaches
  teachers. The signal carries no payload. Long-polling-only clients work.
- Production build in headless Chrome behind an nginx-like proxy: Teacher A's Select Duty flipped Room
  101 to **Occupied** ~320 ms after Teacher B's claim, with no reload and no console errors.

**After deploy**

1. On the production server: `cd backend && node scripts/check-duplicate-duties.js` should report
   "Duplicates: none" and "Index: present."
2. Optional: add the nginx upgrade headers (§4.3) to switch from long-polling to WebSocket.
