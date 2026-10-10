# Platform staff access (Super Admin)

How Rkyves employees get into **Super Admin** (`platform.cullinos.com`) and **Cullinos App Ops** (`app.cullinos.com`), what they can do, and how approvals, tenant access and audits work. These are human accounts; Grok Bot teammates do not get platform logins.

Sources of truth (the code wins if this page disagrees):

| Topic | Code |
|-------|------|
| Permission catalog, risk levels, system roles | [`apps/api/src/common/platform-permissions.ts`](../../apps/api/src/common/platform-permissions.ts) |
| Effective access (roles, scopes, IP allowlist) | `apps/api/src/modules/platform-iam/` |
| Default approval policies | [`apps/api/src/modules/platform-approvals/default-policies.ts`](../../apps/api/src/modules/platform-approvals/default-policies.ts) |
| Tickets and tenant access grants | `apps/api/src/modules/platform-support/` |
| Directory, shifts, on-call | `apps/api/src/modules/platform-people/` |
| Access reviews, sessions, elevation | `apps/api/src/modules/platform-security/` |
| Ops dashboard, exports, bulk jobs | `apps/api/src/modules/platform-reports/` |

## Portal layout

The sidebar is grouped into workspaces. Each item only shows if you hold a permission for it; **Ctrl+K** opens a command palette over every page you can reach.

| Workspace | Pages |
|-----------|-------|
| Home | Dashboard, Ops overview, Approvals inbox, My access reviews |
| Customers | Tenants, Users report, Tenant labs |
| Support | Tickets, Tenant access grants, Shifts & on-call |
| Finance | Plans, Subscriptions |
| Growth | Marketing CMS, inquiries, promo email, App Ops |
| People & access | Directory, Org chart, Platform accounts, Departments & teams, Roles, Role assignments |
| Governance | Staff activity log, Tenant audit log, Approval policies, Access reviews, Sessions, Security policy, Exports & bulk jobs, Settings, Health |

The bell shows notifications (approvals waiting for you, decisions on your requests, ticket assignments, review campaigns).

## Employees, departments and teams

Every staff account has an **employee profile** with a permanent employee ID (`EMP-0001`, …), title, department, team, manager, location and employment status. The employee ID is stamped on every logged action and shown next to the person's name throughout the portal.

- **Departments** group **teams**; teams can nest (for example Support → L1 / L2 / Escalations).
- A team can have a lead and its own **IP allowlist**.
- The **Org chart** is built from the manager field. The **Directory** searches by name, email or employee ID and supports CSV bulk invite.

## Roles and permissions

Access = the **primary role** on the account + any number of **role assignments**.

- **System roles** (seeded, not editable): Owner, Support, Sales, Marketing, Finance, Viewer. They match the old fixed roles, so existing accounts keep the same access.
- **Custom roles** are built from the permission catalog in **People & access → Roles**. Each permission has a risk level (low / medium / high / critical); a role's risk is its highest permission.
- **Assignments** attach a role to a person or a whole team and can be:
  - **Scoped**: global, a region, or a fixed set of tenants. Tenant-scoped staff only see and act on those tenants (lists, detail pages, exports).
  - **Time-bound**: an expiry after which the assignment stops applying automatically.
- Access is resolved server-side on every request (cached for ~30 seconds). Changes to roles, assignments or team membership apply without a new login; the portal refreshes your access every minute.
- Any Super Admin API route that does not declare a permission is Owner-only.

| System role | Typical owner | Can do | Cannot do |
|-------------|---------------|--------|-----------|
| **Owner** | Founders, CTO | Everything, including settings/integration keys, Labs SQL, deleting tenants, approval policies | — |
| **Support** | Customer Success | Dashboard, health, audit, tenants (read, suspend/activate), tickets, request tenant access, reset/suspend tenant users, plans (read), App Ops | Onboard or delete tenants, plans/subscriptions, wallet, settings, marketing CMS |
| **Sales** | Sales | Dashboard, view and onboard tenants, edit tenant environment, subscriptions, plans (read), marketing inquiries | Suspend/delete, tenant access, plan edits, wallet, settings |
| **Marketing** | Marketing / Growth | Dashboard, marketing CMS, inquiries, promo email, App Ops | Tenant data, billing, settings |
| **Finance** | Finance | Dashboard, audit, view tenants, plan catalog, subscriptions and collection, wallet adjustments | Suspend/delete, tenant access, tenant users, settings, marketing |
| **Viewer** | Interns, auditors | Read-only dashboard, health, audit, tenants, plans | Any change |

**App Ops** requires `guest_ops.manage`. Other staff are refused at sign-in.

### Temporary access (just-in-time elevation)

Anyone can use **Request temporary access** (profile page or command palette) to ask for a role for 15 minutes to 8 hours with a justification and optional ticket. With the default policy an Owner approves it; the role is then granted as an expiring assignment and disappears on its own.

## Approvals (maker-checker)

Sensitive actions do not run immediately. The API answers *"sent for approval"*, records a request with the exact payload, and notifies approvers. When enough approvers agree, the requester (or an approver) presses **Execute** on the request; the API replays the stored payload and refuses anything that changed.

- You must give a **justification** (and can link a ticket). The portal asks for it automatically.
- You cannot approve your own request. Each approver counts once.
- Requests expire after the policy's expiry window.
- Owners edit policies in **Governance → Approval policies**: number of approvals, approver roles or a specific approver team, expiry, on/off, and simple conditions (for example only wallet adjustments above ₹50,000).

Default policies (seeded once, then owned by the Owners):

| Action | Approvals | Approvers | Default |
|--------|-----------|-----------|---------|
| Delete tenant | 2 | Owner | On |
| Suspend tenant | 1 | Owner, Support | Off |
| Change subscription | 1 | Owner, Finance | Off |
| Create / change plan | 1 | Owner, Finance | On |
| Wallet adjustment > ₹50,000 | 1 | Owner, Finance | On |
| Platform settings / integration keys | 1 | Owner | On |
| Security policy change | 1 | Owner | On |
| Grant a role with a critical permission | 1 | Owner | On |
| Create / change custom role | 1 | Owner | On |
| Temporary elevation | 1 | Owner | On |
| Read-only tenant access | 1 | Owner, Support | On |
| Full tenant access | 1 | Owner | On |
| Export staff activity log | 1 | Owner | On |
| Export with personal data | 1 | Owner | On |
| Bulk tenant operation | 1 | Owner | On |

## Opening a restaurant account (ticket-backed access)

Staff never get a standing "log in as tenant" button. Access to a restaurant's Admin requires an approved, time-boxed **tenant access grant** tied to a support ticket:

1. A **ticket** exists for the restaurant (Support → Tickets). Tickets have priority, SLA due times, team and assignee, internal notes and a full timeline.
2. On the ticket, **Request access**: choose **Read-only** or **Full**, a duration (15 min – 8 h) and the reason.
3. An approver approves it per the policy above. The requester is notified.
4. The requester presses **Start session** (on the ticket, the grant list or the tenant page). The session token carries the grant, the ticket and the access level, and expires with the grant.
5. **Read-only** sessions can view everything but every write is refused by the API. **Full** sessions can change data.
6. Every action in the session is written to the tenant's audit log with the staff member's employee ID and ticket reference, and to the staff activity log. Grants can be revoked at any time (Support → Tenant access grants); revoking ends the session.

## Activity log

Every Super Admin request (reads and changes, apart from background polling such as notification counts) and every request made inside a tenant access session is recorded in **Governance → Staff activity log** with the employee ID, target tenant, approval and ticket references, IP and outcome. Request bodies of changes are stored with secrets and personal data redacted.

The log is append-only and hash-chained; **Verify chain** detects any edited or deleted row. Exporting it is itself an approval-gated action.

## Security controls

| Control | Where | Notes |
|---------|-------|-------|
| IP allowlist | Security policy (global), team, role | Every level that applies must allow the IP. Test a change from your own IP before saving a global list. |
| Step-up OTP | Security policy | High-risk actions ask for a fresh email OTP; the token is valid for a few minutes. Labs SQL always requires it. |
| Sessions | Governance → Sessions; your profile | See and sign out any session; offboarding revokes all. |
| Access reviews | Governance → Access reviews | Campaigns ask each manager to certify or revoke their reports' roles. Unreviewed items are revoked when the campaign closes. Nobody reviews their own access. |

## Onboarding a new employee

1. An **Owner** (or anyone with `team.manage`) opens **People & access → Platform accounts → Invite team member**, or uses **Directory → Bulk invite** with a CSV.
2. Enter work email, name, primary role, and optionally title, department, team and manager. Use the least-privileged role; add custom roles or scoped assignments afterwards.
3. The invitee receives a temporary password by email (also shown once to the inviter in case email fails; share it privately). They must change it on first sign-in. Email OTP applies as for all platform logins.

Rules the API enforces: the email cannot belong to a restaurant user, and cannot already be on the platform team.

## Moving someone (team or role change)

Edit the employee profile (department, team, manager, title) or their assignments. Changing the primary role on **Platform accounts** revokes their sessions; assignment and team changes apply within a minute without a new login. You cannot change your own role.

## Offboarding

The same day someone leaves or no longer needs access:

1. Open their profile in the **Directory** → **Offboard**, pick who takes over their tickets, and give a reason. This deactivates the account, revokes every session, role assignment and tenant access grant, hands open tickets over, cancels their pending approval requests, removes them from on-call rotations and future shifts, and marks the employee as exited. (**Deactivate** on Platform accounts only blocks sign-in.)
2. Check their on-call rotations still have enough people.
3. If they were an **Owner**, confirm another active Owner remains. The API refuses to remove the last active Owner.
4. Rotate any integration secrets they could have viewed in **Settings** if the departure is not amicable.

Reactivate restores the account with its previous primary role. **Reset password** issues a new temporary password and revokes existing sessions. You cannot deactivate or reset your own account.

## Reports, exports and bulk jobs

- **Ops overview** shows ticket load and SLA breaches by team and person, approval turnaround, tenant status and staff activity.
- **Exports** (tenants, tenant users, tickets, activity) and **bulk suspend/reactivate** run as background jobs after approval. Exports respect your tenant scope, are capped at 50,000 rows, and only the requester can download the file.
- **Saved views** keep filters on list pages; they can be personal or shared.

## Separation from restaurant staff

Platform roles are unrelated to tenant roles (Owner/Manager/Cashier/… inside a restaurant's Admin). Platform tokens are signed with the Super Admin secret; tenant tokens never carry platform permissions. Staff who need to see a restaurant's Admin use a ticket-backed access grant (above), never a tenant login.
