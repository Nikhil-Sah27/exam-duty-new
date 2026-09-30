# CS Unassign — Implementation Plan

**Status:** built 2026-09-30 — all three recommendations accepted (both placements, whole-group, optional reason). Full API suite 110/110 incl. `12-unassign`; frontend build passes; both UIs checked in the browser.

**Change from the draft:** `admin-unassign-group` takes a single `dutyId`, not a list. A teacher can hold only one duty per time slot, so their live RS duties on a schedule *are* their RS group — the server expands it, the client never re-derives groups, and a partial unassign is impossible. `GET /exam-groups/:id/duty-status` now also returns `dcsDutyId` / `rsDutyId` / `invigilatorDutyId` per room so the room view can unassign.

**Also closed:** `POST /duties/admin-assign`, `/duties/admin-assign-group` and `/dcs/groups/:id/admin-claim` had no CS guard — any logged-in teacher could assign duties to anyone. All three are now `requireRole("cs")`.

**Ask:** CS (admin) can assign a teacher to a duty but has no way to take them off it again.

---

## 1. Where things stand today

| Piece | State |
|---|---|
| `PATCH /duties/:id/cancel` → `duty.service.cancelDuty` | Exists. Already distinguishes a CS cancel from a teacher self-release via `actor`, and already emits `duty_cancelled` to the teacher (inbox + email). |
| **Who may call it** | **Anyone logged in.** `duty.routes.js` has only `protect` — no `requireRole`, and `cancelDuty` never checks that a non-CS caller owns the duty. A teacher can cancel *another teacher's* duty by ID. (Bug — fixed as part of this work.) |
| RS group cancel | None. RS groups are derived (≤5 rooms per schedule+building), so "unassign the RS" today would mean N separate cancel calls — non-atomic, and N notifications for one duty unit. |
| DCS group release | `POST /dcs/groups/:id/release` exists but throws 403 unless the caller *is* the assigned DCS. CS cannot use it. |
| CS UI | No unassign button anywhere. Teacher Details (Manage Duties → teacher) lists invigilator duties, RS groups and DCS groups read-only. The exam Duty Status modal shows who holds each slot, read-only. The legacy `/duties` table has a cancel button but isn't in the sidebar. |

## 2. What gets built

### Backend
1. **Lock down `PATCH /duties/:id/cancel`** — CS may cancel any duty; anyone else only their own (403 otherwise).
2. **`POST /duties/admin-unassign-group`** (CS only) — body `{ dutyIds, reason? }` for an RS group. Cancels every duty in one `withOptionalTransaction`, emits **one** `duty_group_cancelled` to the teacher (group = one unit, same as `duty_group_assigned`).
3. **CS path for DCS groups** — `releaseGroup` accepts a CS actor: skips the owner check, resets the `DCSGroup` to `open` as today, notifies the *teacher* (`duty_group_cancelled`) instead of alerting CS about itself.
4. New notification type `duty_group_cancelled` → template + `mail.policy.js` entry (email: yes, same as `duty_cancelled`) + frontend type/selector.
5. Audit log entry for each unassign (`duty_unassigned` / `duty_group_unassigned`) with CS actor + reason.

Unassigning frees the slot immediately (conflict scans already ignore `cancelled`), and the teacher's target count drops because targets are computed on demand — nothing to recompute.

### Frontend
6. **Teacher Details page** — an "Unassign" action on each upcoming invigilator duty row, each RS group card and each DCS group card. Confirmation modal with optional reason. Completed/past duties get no button (backend already rejects them).
7. **Exam Duty Status modal** (`DutyOverviewContent`) — "Unassign" next to an occupied slot, so CS can free a room from the exam view too.
8. Group actions reuse `groupRoomsIntoRSGroups` / `countDutyUnits` to collect the group's duty IDs — no ad-hoc regrouping.

### Tests
9. `tests/12-unassign.test.js` — CS unassigns single / RS group / DCS group; teacher cannot cancel someone else's duty (403); slot is re-assignable afterwards; teacher gets exactly one notification per unit.

## 3. Decisions for you

1. **Where should the button live?** Teacher Details only, or also in the exam Duty Status modal? *(Recommend both — items 6 + 7.)*
2. **Groups all-or-nothing?** Unassigning an RS/DCS teacher removes them from the whole group, not one room of it. *(Recommend yes — matches "group = one duty unit" everywhere else.)*
3. **Reason:** optional or required? It's shown to the teacher in the notification/email. *(Recommend optional.)*

## 4. Build order

1. Backend 1–5 + tests (fixes the permission bug first).
2. Teacher Details UI (6).
3. Duty Status modal UI (7).
4. `npm run build` gate + full API suite, then drive it in the browser.
