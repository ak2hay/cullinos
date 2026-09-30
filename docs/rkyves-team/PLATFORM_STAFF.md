# Platform staff access (Super Admin)

How Rkyves employees get into **Super Admin** (`platform.cullinos.com`) and **Cullinos App Ops** (`app.cullinos.com`), and what each role can do. These are human accounts; Grok Bot teammates do not get platform logins.

Source of truth for the permission map: [`apps/api/src/common/platform-permissions.ts`](../../apps/api/src/common/platform-permissions.ts). If this page and the code disagree, the code wins.

## Roles

Every platform staff account has exactly one role. Permissions are derived server-side from the role on every request, so a role change takes effect immediately (the member's sessions are revoked and they sign in again).

| Role | Typical owner | Can do | Cannot do |
|------|---------------|--------|-----------|
| **Owner** | Founders, CTO | Everything, including Platform team, settings/integration keys, Labs SQL, deleting tenants | — |
| **Support** | Customer Success | Dashboard, health, audit log, view tenants, suspend/activate tenants, impersonate into tenant Admin, reset/suspend tenant users, view plans, App Ops | Onboard or delete tenants, change plans/subscriptions, wallet, settings, marketing CMS |
| **Sales** | Sales | Dashboard, view and onboard tenants, edit tenant environment, manage subscriptions, view plans, marketing inquiries | Suspend/delete, impersonate, plan catalog edits, wallet, settings |
| **Marketing** | Marketing / Growth | Dashboard, marketing CMS (pages, blog, media, theme), marketing inquiries, promo campaigns, App Ops | Tenant list and tenant data, billing, settings |
| **Finance** | Finance | Dashboard, audit log, view tenants, plan catalog (create/edit/sync to Razorpay), subscriptions and payment collection, wallet adjustments | Suspend/delete, impersonate, tenant users, settings, marketing |
| **Viewer** | Interns, auditors | Read-only dashboard, health, audit log, tenants, plans | Any change |

Only **Owner** can open **Platform team**, **Settings**, and **Labs**. Any Super Admin API route that does not declare a permission is Owner-only by default.

**App Ops** requires the `guest_ops.manage` permission (Owner, Support, Marketing). Other roles are refused at sign-in with a message to ask an owner.

## Onboarding a new employee

1. An **Owner** opens Super Admin → **Platform team** → **Invite staff**.
2. Enter work email, name, and role. Use the least-privileged role that covers the job; start with **Viewer** if unsure.
3. The invitee receives an email with a temporary password. The temporary password is also shown once to the inviting owner in case email delivery fails; share it over a private channel only.
4. On first sign-in the member must set a new password before they can use the panel. Email OTP applies as for all platform logins.

Rules the API enforces:

- The email cannot already belong to a restaurant (tenant) user. Use a dedicated Rkyves work email.
- The email cannot already be on the platform team.

## Changing a role

Platform team → change the role in the member's row. Their existing sessions are revoked; the next sign-in picks up the new permissions. You cannot change your own role.

## Offboarding

When someone leaves or no longer needs access, the same day:

1. Platform team → **Deactivate** (optionally note the reason). All their sessions are revoked immediately and they cannot sign in.
2. If they had **Owner**, confirm at least one other active Owner remains. The API refuses to deactivate or demote the last active Owner.
3. Rotate any integration secrets they could have viewed in **Settings** (Owners only) if the departure is not amicable.

Reactivate restores access with their previous role. **Reset password** issues a new temporary password (emailed and shown once) and revokes existing sessions.

You cannot deactivate or reset the password of your own account.

## Audit

Every team action is written to the audit log (`entityType: platform_staff`):

| Action | When |
|--------|------|
| `platform.team_invite` | Member invited |
| `platform.team_role_change` | Role changed (records from/to) |
| `platform.team_deactivate` | Member deactivated |
| `platform.team_activate` | Member reactivated |
| `platform.team_reset_password` | Temporary password reissued |

Review these monthly alongside impersonation and Labs SQL audits.

## Separation from restaurant staff

Platform roles are unrelated to tenant roles (Owner/Manager/Cashier/… inside a restaurant's Admin). Platform tokens are signed with the Super Admin secret and carry `platformRole`; tenant tokens never do. Support staff who need to see a restaurant's Admin use **Impersonate**, which is audited, rather than a tenant login.
