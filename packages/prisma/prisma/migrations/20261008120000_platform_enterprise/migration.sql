-- CreateEnum
CREATE TYPE "PlatformEmploymentStatus" AS ENUM ('active', 'on_leave', 'notice', 'exited');

-- CreateEnum
CREATE TYPE "PlatformScopeType" AS ENUM ('global', 'region', 'tenant_set');

-- CreateEnum
CREATE TYPE "PlatformApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'expired', 'cancelled', 'executing', 'executed');

-- CreateEnum
CREATE TYPE "PlatformTicketStatus" AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "PlatformTicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "PlatformAccessLevel" AS ENUM ('read_only', 'full');

-- CreateEnum
CREATE TYPE "PlatformAccessGrantStatus" AS ENUM ('pending', 'active', 'rejected', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "PlatformReviewDecision" AS ENUM ('pending', 'certified', 'revoked');

-- CreateEnum
CREATE TYPE "PlatformJobStatus" AS ENUM ('pending_approval', 'queued', 'running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "platform_departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "head_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_teams" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "lead_user_id" TEXT,
    "ip_allowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_employees" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "title" TEXT,
    "department_id" TEXT,
    "team_id" TEXT,
    "manager_id" TEXT,
    "region" TEXT,
    "location" TEXT,
    "employment_status" "PlatformEmploymentStatus" NOT NULL DEFAULT 'active',
    "joined_at" TIMESTAMP(3),
    "exited_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role_defs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "ip_allowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_role_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "platform_role_permissions_pkey" PRIMARY KEY ("role_id","permission")
);

-- CreateTable
CREATE TABLE "platform_role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "scope_type" "PlatformScopeType" NOT NULL DEFAULT 'global',
    "scope_values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3),
    "granted_by_id" TEXT,
    "reason" TEXT,
    "approval_request_id" TEXT,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_activity_logs" (
    "id" TEXT NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "user_id" TEXT,
    "employee_code" TEXT,
    "actor_email" TEXT,
    "session_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" TEXT,
    "method" TEXT,
    "route" TEXT,
    "status_code" INTEGER,
    "target_org_id" TEXT,
    "request_id" TEXT,
    "ip" TEXT,
    "user_agent" TEXT,
    "approval_request_id" TEXT,
    "ticket_id" TEXT,
    "grant_id" TEXT,
    "diff" JSONB,
    "metadata" JSONB,
    "prev_hash" TEXT,
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_approval_policies" (
    "id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "required_approvals" INTEGER NOT NULL DEFAULT 1,
    "approver_role_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approver_team_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "block_self_approval" BOOLEAN NOT NULL DEFAULT true,
    "expiry_hours" INTEGER NOT NULL DEFAULT 72,
    "conditions" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_approval_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_approval_requests" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "action_key" TEXT NOT NULL,
    "policy_id" TEXT,
    "status" "PlatformApprovalStatus" NOT NULL DEFAULT 'pending',
    "title" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "body_enc" TEXT,
    "payload_hash" TEXT NOT NULL,
    "justification" TEXT NOT NULL,
    "ticket_id" TEXT,
    "target_org_id" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "required_approvals" INTEGER NOT NULL,
    "approver_role_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approver_team_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "block_self_approval" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "decided_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "execution_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_approval_decisions" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "approver_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_approval_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "organization_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "priority" "PlatformTicketPriority" NOT NULL DEFAULT 'normal',
    "status" "PlatformTicketStatus" NOT NULL DEFAULT 'open',
    "requester_name" TEXT,
    "requester_email" TEXT,
    "requester_phone" TEXT,
    "assignee_team_id" TEXT,
    "assignee_user_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "sla_due_at" TIMESTAMP(3),
    "first_response_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_comments" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "author_id" TEXT,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT true,
    "attachments" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_access_grants" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "access_level" "PlatformAccessLevel" NOT NULL DEFAULT 'read_only',
    "justification" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "status" "PlatformAccessGrantStatus" NOT NULL DEFAULT 'pending',
    "approval_request_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "starts_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_by_id" TEXT,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_shifts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "team_id" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'shift',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_on_call_rotations" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "member_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rotation_days" INTEGER NOT NULL DEFAULT 7,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_on_call_rotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_access_review_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "due_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_access_review_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_access_review_items" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "assignment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "reviewer_id" TEXT,
    "decision" "PlatformReviewDecision" NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "decided_by_id" TEXT,

    CONSTRAINT "platform_access_review_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_saved_views" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_jobs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "PlatformJobStatus" NOT NULL DEFAULT 'queued',
    "params" JSONB NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "processed" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "result_csv" TEXT,
    "errors" JSONB,
    "approval_request_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_departments_name_key" ON "platform_departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_departments_code_key" ON "platform_departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "platform_teams_code_key" ON "platform_teams"("code");

-- CreateIndex
CREATE INDEX "platform_teams_department_id_idx" ON "platform_teams"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_employees_user_id_key" ON "platform_employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_employees_employee_code_key" ON "platform_employees"("employee_code");

-- CreateIndex
CREATE INDEX "platform_employees_team_id_idx" ON "platform_employees"("team_id");

-- CreateIndex
CREATE INDEX "platform_employees_department_id_idx" ON "platform_employees"("department_id");

-- CreateIndex
CREATE INDEX "platform_employees_manager_id_idx" ON "platform_employees"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_role_defs_key_key" ON "platform_role_defs"("key");

-- CreateIndex
CREATE INDEX "platform_role_assignments_user_id_revoked_at_idx" ON "platform_role_assignments"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "platform_role_assignments_role_id_idx" ON "platform_role_assignments"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_activity_logs_seq_key" ON "platform_activity_logs"("seq");

-- CreateIndex
CREATE INDEX "platform_activity_logs_employee_code_created_at_idx" ON "platform_activity_logs"("employee_code", "created_at");

-- CreateIndex
CREATE INDEX "platform_activity_logs_user_id_created_at_idx" ON "platform_activity_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_activity_logs_target_org_id_created_at_idx" ON "platform_activity_logs"("target_org_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_activity_logs_action_created_at_idx" ON "platform_activity_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "platform_activity_logs_grant_id_idx" ON "platform_activity_logs"("grant_id");

-- CreateIndex
CREATE INDEX "platform_activity_logs_created_at_idx" ON "platform_activity_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_approval_policies_action_key_key" ON "platform_approval_policies"("action_key");

-- CreateIndex
CREATE UNIQUE INDEX "platform_approval_requests_seq_key" ON "platform_approval_requests"("seq");

-- CreateIndex
CREATE INDEX "platform_approval_requests_status_created_at_idx" ON "platform_approval_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "platform_approval_requests_requested_by_id_created_at_idx" ON "platform_approval_requests"("requested_by_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_approval_requests_action_key_idx" ON "platform_approval_requests"("action_key");

-- CreateIndex
CREATE UNIQUE INDEX "platform_approval_decisions_request_id_approver_id_key" ON "platform_approval_decisions"("request_id", "approver_id");

-- CreateIndex
CREATE INDEX "platform_notifications_user_id_read_at_created_at_idx" ON "platform_notifications"("user_id", "read_at", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_seq_key" ON "support_tickets"("seq");

-- CreateIndex
CREATE INDEX "support_tickets_status_priority_created_at_idx" ON "support_tickets"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "support_tickets_assignee_user_id_status_idx" ON "support_tickets"("assignee_user_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_assignee_team_id_status_idx" ON "support_tickets"("assignee_team_id", "status");

-- CreateIndex
CREATE INDEX "support_tickets_organization_id_created_at_idx" ON "support_tickets"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "support_ticket_comments_ticket_id_created_at_idx" ON "support_ticket_comments"("ticket_id", "created_at");

-- CreateIndex
CREATE INDEX "tenant_access_grants_user_id_status_idx" ON "tenant_access_grants"("user_id", "status");

-- CreateIndex
CREATE INDEX "tenant_access_grants_organization_id_status_idx" ON "tenant_access_grants"("organization_id", "status");

-- CreateIndex
CREATE INDEX "platform_shifts_user_id_starts_at_idx" ON "platform_shifts"("user_id", "starts_at");

-- CreateIndex
CREATE INDEX "platform_shifts_team_id_starts_at_idx" ON "platform_shifts"("team_id", "starts_at");

-- CreateIndex
CREATE INDEX "platform_on_call_rotations_team_id_idx" ON "platform_on_call_rotations"("team_id");

-- CreateIndex
CREATE INDEX "platform_access_review_items_campaign_id_decision_idx" ON "platform_access_review_items"("campaign_id", "decision");

-- CreateIndex
CREATE INDEX "platform_access_review_items_reviewer_id_decision_idx" ON "platform_access_review_items"("reviewer_id", "decision");

-- CreateIndex
CREATE INDEX "platform_saved_views_page_user_id_idx" ON "platform_saved_views"("page", "user_id");

-- CreateIndex
CREATE INDEX "platform_jobs_created_by_id_created_at_idx" ON "platform_jobs"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_jobs_status_idx" ON "platform_jobs"("status");

-- AddForeignKey
ALTER TABLE "platform_teams" ADD CONSTRAINT "platform_teams_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "platform_departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_teams" ADD CONSTRAINT "platform_teams_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "platform_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_employees" ADD CONSTRAINT "platform_employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_employees" ADD CONSTRAINT "platform_employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "platform_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_employees" ADD CONSTRAINT "platform_employees_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "platform_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_employees" ADD CONSTRAINT "platform_employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "platform_employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_role_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_assignments" ADD CONSTRAINT "platform_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_role_assignments" ADD CONSTRAINT "platform_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "platform_role_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_approval_decisions" ADD CONSTRAINT "platform_approval_decisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "platform_approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_ticket_comments" ADD CONSTRAINT "support_ticket_comments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_access_grants" ADD CONSTRAINT "tenant_access_grants_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_access_review_items" ADD CONSTRAINT "platform_access_review_items_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "platform_access_review_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: every existing platform staff member gets an employee record and code.
INSERT INTO "platform_employees" ("id", "user_id", "employee_code", "employment_status", "joined_at", "created_at", "updated_at")
SELECT gen_random_uuid()::text,
       u."id",
       'RKY-' || lpad(row_number() OVER (ORDER BY u."created_at", u."id")::text, 6, '0'),
       CASE WHEN u."status" = 'active' THEN 'active'::"PlatformEmploymentStatus" ELSE 'exited'::"PlatformEmploymentStatus" END,
       u."created_at",
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "users" u
WHERE u."is_super_admin" = true
ON CONFLICT ("user_id") DO NOTHING;

-- The activity log is append-only: block edits and deletes at the database level.
CREATE OR REPLACE FUNCTION platform_activity_logs_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'platform_activity_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER platform_activity_logs_no_update
  BEFORE UPDATE OR DELETE ON "platform_activity_logs"
  FOR EACH ROW EXECUTE FUNCTION platform_activity_logs_immutable();
