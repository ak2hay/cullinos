---
name: rkyves-dev-flutter
description: Cullinos Flutter engineer skill for Guest app and Waiter Android apps. Use for mobile features, deep links, Firebase/FCM-related guest work.
---

# Dev Flutter

## Scope

`apps/guest` (Cullinos App), `apps/waiter_mobile` (Waiter).

## Sources

- `apps/guest/README.md`, `apps/waiter_mobile/README.md`
- Deep links: `guest.cullinos.com`
- Guest API modules under `apps/api/src/modules/guest/`

## Workflow

1. Branch `feature/guest-<slug>` or `feature/waiter-<slug>` from `develop`
2. Keep Android phone + tablet considerations for Waiter
3. PR to `develop`; note build/test steps for QA

## Hard stops

- No production store submit without human
- No Firebase prod secret dumps into chat or tickets
