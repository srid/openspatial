# Space Activity Persistence - Implementation Summary

## Overview
Implemented persistent space activity tracking (Issue #45) to solve excessive Slack notifications after server restarts and display recent activity in the UI.

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `server/migrations/0002_space_events.ts` | Migration: `space_events` table |
| `client/modules/activity-panel.ts` | UI component for activity display |
| `e2e/scenarios/activity.spec.ts` | E2E tests (4 scenarios) |

### Modified Files
| File | Changes |
|------|---------|
| `server/db.ts` | Added `recordSpaceEvent`, `getLastJoinFirstTime`, `getRecentActivity` |
| `server/database/types.ts` | Added `SpaceEventsTable`, `SpaceEvent`, `SpaceEventType` |
| `server/signaling.ts` | Records events on join/leave, emits `space-activity` |
| `server/notifier/index.ts` | DB-backed cooldown (replaces in-memory Map) |
| `index.html` | Activity button + popover in control bar |
| `client/index.css` | Activity panel popover styles |
| `client/main.ts` | Socket listener for `space-activity` |
| `client/modules/socket.ts` | Added `space-activity` to `ServerEventMap` |
| `shared/types/events.ts` | Added `SpaceActivityEvent`, `SpaceActivityItem` |
| `e2e/dsl/types.ts` | Added `ActivityItem`, activity methods |
| `e2e/dsl/user.ts` | Implemented `openActivityPanel`, `activityItems`, etc |

---

## Key Features

### 1. Database Layer
- `space_events` table with `id`, `space_id`, `event_type`, `username`, `created_at`
- 2-day retention (cleanup on every insert)
- Event types: `join_first`, `join`, `leave`, `leave_last`

### 2. Persistent Cooldown
- Notifications now use `getLastJoinFirstTime()` DB query
- Survives server restarts (was in-memory Map)

### 3. Activity Panel UI
- **Control bar button** with clock icon (between Note and Leave)
- **Click-to-expand popover** that slides up
- **Badge notification** (pulsing dot) when new activity arrives while closed
- **Auto-refresh** every 30 seconds while open
- **Hover tooltip** shows full timestamp (e.g., "Sun, Feb 2, 7:10 PM")

### 4. Timezone Handling
- Server stores UTC via SQLite `datetime('now')`
- Client parses with `parseUTCDate()` (appends `Z` suffix)
- Display in user's local time

---

## E2E Tests
4 scenarios in `activity.spec.ts`:

1. **activity panel shows join event** - Own join event appears
2. **activity panel shows join and leave events** - Multi-user events sync
3. **activity badge appears for new activity** - Badge + Alice sees Bob's join
4. **activity timestamps are not stale** - Format validation

---

## Manual Testing Checklist
- [ ] Server restart preserves notification cooldown
- [ ] Activity panel shows events from other users
- [ ] Timestamps update correctly over time
- [ ] Hover shows full timestamp
