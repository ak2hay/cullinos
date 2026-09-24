# UI/UX fixes and portal issues (phone field, logins, uploads, OTP, kiosk, floors, POS mobile)

- **id:** 20260924-ui-fixes-portal-issues
- **status:** ready_for_qa
- **priority:** P1
- **type:** bug
- **owner_bot:** QA
- **requester:** human
- **group:** Bug Fix
- **branch:** feature/ui-portal-fixes (not yet committed)
- **pr:** none
- **created:** 2026-09-24
- **updated:** 2026-09-24

## Outcome

All six reported issues fixed and verified on staging before any production deploy.

## Context

| Area | Main paths |
|------|-----------|
| Phone field (web) | `packages/ui/src/components/PhoneField.tsx` |
| Waiter login + phone field | `apps/waiter_mobile/lib/features/auth/login_page.dart`, `lib/widgets/phone_field.dart` |
| Customer app login | `apps/guest/lib/features/auth/login_page.dart`, `lib/widgets/phone_field.dart` |
| 2 MB tenant upload cap | `apps/api/src/modules/marketing/marketing-upload.service.ts` (`uploadMaxBytesFor`), tenant upload controllers, `apps/admin/src/components/ImageUploadField.tsx` |
| Waiter OTP | `apps/api/src/modules/users/*` (`PATCH /users/:id`), `apps/api/src/modules/auth/auth.service.ts` (`requestStaffPhoneOtp`), `apps/admin/src/pages/StaffPage.tsx` (Edit drawer) |
| Web kiosk | new `apps/kiosk` SPA (`kiosk.cullinos.com/o/:org/:outlet`), `apps/admin/src/pages/KioskLauncherPage.tsx` |
| Table QR without app | `infrastructure/www/guest-landing/index.html` |
| Floors | `apps/api/src/modules/tables/tables.{controller,service}.ts`, `apps/admin/src/pages/TablesPage.tsx` |
| POS mobile | `apps/admin/src/features/pos/*`, `apps/admin/src/components/layout/AppShell.tsx`, `apps/pos/src/pages/PosPage.tsx`, `apps/pos/src/components/pos/*` |

## Constraints

- PRs to `develop` only
- No production deploy without human approval
- Tenant scope: new floor endpoints are scoped by `organizationId` + `outletId`; staff edit is org-scoped and never touches super-admin users

## Acceptance criteria

- [ ] **Phone field**: Admin → Staff → New staff account on a 360 px wide screen. Country select is compact (flag + dial code) and the number input is visible and typeable. Same in Outlets, Customers, POS customer lookup, super-admin.
- [ ] **Waiter login**: matches reference (hero, chef hat, pill button, OTP step with 30 s resend). Invalid numbers under 10 digits are blocked client-side.
- [ ] **Customer login**: matches reference (hero with rotating feature pager, Google / Email / Phone buttons, "Stay signed in", terms line).
- [ ] **Uploads**: tenant owner uploading a 3 MB image (menu item, outlet cover, coupon, promo display, guest marketing) gets "max 2 MB". Super admin, and super admin impersonating a tenant, can upload the same 3 MB file.
- [ ] **Waiter OTP**: Admin → Staff → Edit a staff member, add their phone, save. In the waiter app, enter that phone → Send OTP → OTP screen appears (no "Invalid phone or OTP"). Duplicate phone on a second staff account is rejected with "already linked".
- [ ] **Kiosk**: open `https://staging-kiosk.cullinos.com/o/<org>/<outlet>` on a tablet → Start → add item with modifiers → Place order → pickup code shown; order appears in POS/KDS. Idle 2 min returns to welcome screen.
- [ ] **Table QR without app**: scan a table QR on a phone without the app → "Get the Cullinos app" page with venue name; Google Play opens Play Store (with referrer), App Store opens the App Store link from platform config (shows "coming soon" if not configured). With the app installed on Android, the app opens directly.
- [ ] **Floors**: Admin → Tables → Floors: rename a floor (duplicate names rejected, case-insensitive); delete an empty floor; deleting a floor with tables is refused with "Move or delete its tables first" and no tables are lost.
- [ ] **POS mobile**: admin POS and standalone POS on a phone show the menu full-screen, a sticky "N items · ₹total · View cart" bar, cart view with "← Menu" back button, compact header/shift bar. Desktop (≥1024 px) layout unchanged.

## Verification already done

- Builds: `@cullinos/ui`, admin, pos, super-admin, management, kiosk
- API typecheck clean; `npx vitest run apps/api`: 29 files, 115 tests pass (new: `tables-floors.test.ts`, upload-limit cases)
- `flutter analyze`: waiter clean; guest only pre-existing warnings

## Deploy notes

- New image `ghcr.io/ak2hay/cullinos-spa-kiosk` (build matrix + both deploy workflows + k8s `spa-kiosk` Deployment/Service/Ingress).
- `CORS_ORIGINS` now includes `kiosk.cullinos.com` / `staging-kiosk.cullinos.com` (k8s config + `.env.production.example`). The VM `.env` must be updated by hand if it already has `CORS_ORIGINS`.
- DNS A records needed (→ 95.135.254.46): `kiosk`, `staging-kiosk`, `guest`, `staging-guest`. TLS: extend certs to cover the new hosts (`infrastructure/nginx/guest.cullinos.com.conf` has its certificate lines commented out).
- No Prisma migration in this change.

### Rollback

Per `docs/BACKUP_ROLLBACK.md`: Actions → Deploy Production → `workflow_dispatch` with the previous image SHA. The kiosk is a new host, so rolling back leaves `spa-kiosk` idle; remove the `kiosk` ingress rule if needed. No DB changes to revert.

## Timeline

| When | Bot | Action | Result |
|------|-----|--------|--------|
| 2026-09-24 | Cursor agent | Implemented fixes, builds + tests | ready_for_qa |

## Human approvals needed

- [ ] Merge
- [ ] Deploy (staging, then production)
- [ ] DNS + TLS for kiosk / guest hosts
