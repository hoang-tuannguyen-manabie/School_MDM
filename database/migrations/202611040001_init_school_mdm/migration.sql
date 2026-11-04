-- ============================================================================
-- Migration: 202611040001_init_school_mdm
-- Description: Initial schema for School MDM Portal (23 core domain tables)
-- Rollback script: ./rollback.sql
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE "RoleCode" AS ENUM ('ADMIN', 'TEACHER');
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'UNKNOWN', 'PENDING', 'ERROR');
CREATE TYPE "MdmProviderType" AS ENUM ('HEADWIND_COMMUNITY', 'CLASSROOM_DPC');
CREATE TYPE "SyncRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL_FAILURE', 'FAILED');
CREATE TYPE "PolicyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ClassSessionStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "SessionDeviceState" AS ENUM ('JOINED', 'ONLINE', 'OFFLINE', 'POLICY_APPLIED', 'RECONCILING', 'RELEASED', 'ERROR');
CREATE TYPE "CommandType" AS ENUM (
  'SYNC_DEVICE',
  'INSTALL_APP',
  'UPDATE_APP',
  'REMOVE_APP',
  'APPLY_CONFIGURATION',
  'LOCK_DEVICE',
  'REBOOT_DEVICE',
  'APPLY_KIOSK_POLICY',
  'APPLY_ALLOWLIST'
);
CREATE TYPE "CommandStatus" AS ENUM (
  'PENDING',
  'SENT',
  'ACKNOWLEDGED',
  'SUCCESS',
  'FAILED',
  'TIMEOUT',
  'UNSUPPORTED'
);
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- 1. IDENTITY
CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL,
  "password_hash" VARCHAR(512) NOT NULL,
  "full_name" VARCHAR(255) NOT NULL,
  "phone" VARCHAR(50),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMPTZ(6),
  "last_login_at" TIMESTAMPTZ(6),
  "password_changed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_key" UNIQUE ("email")
);
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_is_active_deleted_at_idx" ON "users"("is_active", "deleted_at");

CREATE TABLE "roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" "RoleCode" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "roles_code_key" UNIQUE ("code")
);

CREATE TABLE "user_roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_roles_user_id_role_id_key" UNIQUE ("user_id", "role_id"),
  CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");

CREATE TABLE "refresh_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" VARCHAR(255) NOT NULL,
  "family_id" UUID NOT NULL,
  "user_agent" VARCHAR(512),
  "ip_address" VARCHAR(64),
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "revoked_at" TIMESTAMPTZ(6),
  "replaced_by_token_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_token_hash_key" UNIQUE ("token_hash"),
  CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- 2. SCHOOL
CREATE TABLE "academic_years" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "academic_years_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "academic_years_code_key" UNIQUE ("code")
);
CREATE INDEX "academic_years_is_current_deleted_at_idx" ON "academic_years"("is_current", "deleted_at");

CREATE TABLE "classes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "academic_year_id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "grade_level" INTEGER NOT NULL,
  "room_name" VARCHAR(100),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "classes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "classes_academic_year_id_code_key" UNIQUE ("academic_year_id", "code"),
  CONSTRAINT "classes_academic_year_id_fkey" FOREIGN KEY ("academic_year_id") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "classes_grade_level_is_active_idx" ON "classes"("grade_level", "is_active");

CREATE TABLE "teacher_classes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "teacher_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "role_in_class" VARCHAR(50) NOT NULL DEFAULT 'HOMEROOM',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "teacher_classes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "teacher_classes_teacher_id_class_id_key" UNIQUE ("teacher_id", "class_id"),
  CONSTRAINT "teacher_classes_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "teacher_classes_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "teacher_classes_class_id_is_active_idx" ON "teacher_classes"("class_id", "is_active");

CREATE TABLE "students" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_id" UUID,
  "student_code" VARCHAR(64) NOT NULL,
  "full_name" VARCHAR(255) NOT NULL,
  "date_of_birth" DATE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "students_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "students_student_code_key" UNIQUE ("student_code"),
  CONSTRAINT "students_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "students_class_id_is_active_idx" ON "students"("class_id", "is_active");

-- 3. DEVICES
CREATE TABLE "devices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "asset_tag" VARCHAR(100) NOT NULL,
  "serial_number" VARCHAR(128),
  "imei" VARCHAR(64),
  "display_name" VARCHAR(255) NOT NULL,
  "manufacturer" VARCHAR(120) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "android_version" VARCHAR(50) NOT NULL,
  "sdk_version" INTEGER NOT NULL,
  "has_google_play" BOOLEAN NOT NULL DEFAULT true,
  "status" "DeviceStatus" NOT NULL DEFAULT 'UNKNOWN',
  "battery_level" INTEGER,
  "is_charging" BOOLEAN,
  "ip_address" VARCHAR(64),
  "mac_address" VARCHAR(64),
  "last_seen_at" TIMESTAMPTZ(6),
  "enrolled_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "devices_asset_tag_key" UNIQUE ("asset_tag"),
  CONSTRAINT "devices_serial_number_key" UNIQUE ("serial_number"),
  CONSTRAINT "devices_imei_key" UNIQUE ("imei")
);
CREATE INDEX "devices_status_last_seen_at_idx" ON "devices"("status", "last_seen_at");
CREATE INDEX "devices_deleted_at_idx" ON "devices"("deleted_at");

CREATE TABLE "device_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "class_id" UUID NOT NULL,
  "student_id" UUID,
  "assigned_by_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unassigned_at" TIMESTAMPTZ(6),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_assignments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "device_assignments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "device_assignments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "device_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "device_assignments_device_id_is_active_idx" ON "device_assignments"("device_id", "is_active");
CREATE INDEX "device_assignments_class_id_is_active_idx" ON "device_assignments"("class_id", "is_active");
-- Enforce rule: Only ONE active assignment per device at any point in time
CREATE UNIQUE INDEX "idx_device_assignments_single_active" ON "device_assignments"("device_id") WHERE "is_active" = true;

CREATE TABLE "device_heartbeats" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "battery_level" INTEGER,
  "is_charging" BOOLEAN,
  "wifi_ssid" VARCHAR(128),
  "ip_address" VARCHAR(64),
  "foreground_package" VARCHAR(255),
  "storage_free_mb" INTEGER,
  "ram_free_mb" INTEGER,
  "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_heartbeats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_heartbeats_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "device_heartbeats_device_id_reported_at_idx" ON "device_heartbeats"("device_id", "reported_at" DESC);

-- 4. MDM
CREATE TABLE "mdm_providers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(64) NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "provider_type" "MdmProviderType" NOT NULL,
  "base_url" VARCHAR(512),
  "provider_version" VARCHAR(100),
  "capabilities_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "last_verified_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mdm_providers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mdm_providers_code_key" UNIQUE ("code")
);
CREATE INDEX "mdm_providers_is_active_is_default_idx" ON "mdm_providers"("is_active", "is_default");

CREATE TABLE "mdm_device_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "device_id" UUID NOT NULL,
  "external_device_id" VARCHAR(255) NOT NULL,
  "external_number" VARCHAR(255),
  "sync_status" VARCHAR(50) NOT NULL DEFAULT 'LINKED',
  "last_synced_at" TIMESTAMPTZ(6),
  "raw_snapshot_json" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mdm_device_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mdm_device_links_provider_id_external_device_id_key" UNIQUE ("provider_id", "external_device_id"),
  CONSTRAINT "mdm_device_links_provider_id_device_id_key" UNIQUE ("provider_id", "device_id"),
  CONSTRAINT "mdm_device_links_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "mdm_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "mdm_device_links_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "mdm_device_links_device_id_idx" ON "mdm_device_links"("device_id");

CREATE TABLE "mdm_sync_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider_id" UUID NOT NULL,
  "trigger_type" VARCHAR(50) NOT NULL,
  "status" "SyncRunStatus" NOT NULL DEFAULT 'RUNNING',
  "devices_found" INTEGER NOT NULL DEFAULT 0,
  "devices_created" INTEGER NOT NULL DEFAULT 0,
  "devices_updated" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "error_summary" TEXT,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mdm_sync_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mdm_sync_runs_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "mdm_providers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "mdm_sync_runs_provider_id_started_at_idx" ON "mdm_sync_runs"("provider_id", "started_at" DESC);

-- 5. APPS & POLICIES
CREATE TABLE "applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "package_name" VARCHAR(255) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(100) NOT NULL DEFAULT 'EDUCATION',
  "version_name" VARCHAR(100) NOT NULL,
  "version_code" INTEGER NOT NULL,
  "apk_url" VARCHAR(1024),
  "sha256_checksum" VARCHAR(128),
  "is_approved" BOOLEAN NOT NULL DEFAULT false,
  "is_mandatory" BOOLEAN NOT NULL DEFAULT false,
  "description" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "applications_package_name_key" UNIQUE ("package_name")
);
CREATE INDEX "applications_is_approved_deleted_at_idx" ON "applications"("is_approved", "deleted_at");

CREATE TABLE "device_applications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "device_id" UUID NOT NULL,
  "application_id" UUID,
  "package_name" VARCHAR(255) NOT NULL,
  "app_name" VARCHAR(255) NOT NULL,
  "version_name" VARCHAR(100) NOT NULL,
  "version_code" INTEGER NOT NULL,
  "is_system_app" BOOLEAN NOT NULL DEFAULT false,
  "is_suspended" BOOLEAN NOT NULL DEFAULT false,
  "installed_at" TIMESTAMPTZ(6),
  "last_synced_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_applications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_applications_device_id_package_name_key" UNIQUE ("device_id", "package_name"),
  CONSTRAINT "device_applications_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "device_applications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "device_applications_package_name_idx" ON "device_applications"("package_name");

CREATE TABLE "policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "created_by_id" UUID,
  "current_version_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),
  CONSTRAINT "policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "policies_code_key" UNIQUE ("code"),
  CONSTRAINT "policies_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "policies_is_active_deleted_at_idx" ON "policies"("is_active", "deleted_at");

CREATE TABLE "policy_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "policy_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "status" "PolicyVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "kiosk_mode_enabled" BOOLEAN NOT NULL DEFAULT false,
  "kiosk_package_name" VARCHAR(255),
  "app_allowlist_enabled" BOOLEAN NOT NULL DEFAULT false,
  "browser_restrictions_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "network_restrictions_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "device_restrictions_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "required_capabilities_json" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "published_by_id" UUID,
  "published_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "policy_versions_policy_id_version_number_key" UNIQUE ("policy_id", "version_number"),
  CONSTRAINT "policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "policy_versions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "policy_versions_policy_id_status_idx" ON "policy_versions"("policy_id", "status");

CREATE TABLE "policy_apps" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "policy_version_id" UUID NOT NULL,
  "application_id" UUID NOT NULL,
  "action_type" VARCHAR(50) NOT NULL DEFAULT 'ALLOW',
  "auto_install" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "policy_apps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "policy_apps_policy_version_id_application_id_key" UNIQUE ("policy_version_id", "application_id"),
  CONSTRAINT "policy_apps_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "policy_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "policy_apps_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- 6. SESSIONS
CREATE TABLE "class_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "class_id" UUID NOT NULL,
  "teacher_id" UUID NOT NULL,
  "policy_id" UUID,
  "policy_version_id" UUID,
  "title" VARCHAR(255) NOT NULL,
  "subject_name" VARCHAR(150),
  "status" "ClassSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
  "started_at" TIMESTAMPTZ(6),
  "ended_at" TIMESTAMPTZ(6),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "class_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "class_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "class_sessions_teacher_id_fkey" FOREIGN KEY ("teacher_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "class_sessions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "class_sessions_policy_version_id_fkey" FOREIGN KEY ("policy_version_id") REFERENCES "policy_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "class_sessions_class_id_status_idx" ON "class_sessions"("class_id", "status");
CREATE INDEX "class_sessions_teacher_id_status_idx" ON "class_sessions"("teacher_id", "status");

CREATE TABLE "session_devices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "session_id" UUID NOT NULL,
  "device_id" UUID NOT NULL,
  "state" "SessionDeviceState" NOT NULL DEFAULT 'JOINED',
  "joined_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "policy_applied_at" TIMESTAMPTZ(6),
  "policy_released_at" TIMESTAMPTZ(6),
  "last_offline_at" TIMESTAMPTZ(6),
  "last_reconnected_at" TIMESTAMPTZ(6),
  "last_error_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_devices_session_id_device_id_key" UNIQUE ("session_id", "device_id"),
  CONSTRAINT "session_devices_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "session_devices_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "session_devices_device_id_state_idx" ON "session_devices"("device_id", "state");

-- 7. COMMANDS & AUDIT
CREATE TABLE "device_commands" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "idempotency_key" VARCHAR(128) NOT NULL,
  "device_id" UUID NOT NULL,
  "provider_id" UUID NOT NULL,
  "session_id" UUID,
  "actor_user_id" UUID,
  "command_type" "CommandType" NOT NULL,
  "payload_json" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "status" "CommandStatus" NOT NULL DEFAULT 'PENDING',
  "external_command_id" VARCHAR(255),
  "max_retries" INTEGER NOT NULL DEFAULT 3,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "failure_reason" TEXT,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "sent_at" TIMESTAMPTZ(6),
  "acknowledged_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_commands_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "device_commands_idempotency_key_key" UNIQUE ("idempotency_key"),
  CONSTRAINT "device_commands_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "device_commands_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "mdm_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "device_commands_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "device_commands_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "device_commands_device_id_status_idx" ON "device_commands"("device_id", "status");
CREATE INDEX "device_commands_status_expires_at_idx" ON "device_commands"("status", "expires_at");
CREATE INDEX "device_commands_session_id_idx" ON "device_commands"("session_id");

CREATE TABLE "command_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "command_id" UUID NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "status" "CommandStatus" NOT NULL,
  "external_command_id" VARCHAR(255),
  "request_payload" JSONB,
  "response_payload" JSONB,
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMPTZ(6),
  CONSTRAINT "command_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "command_attempts_command_id_attempt_number_key" UNIQUE ("command_id", "attempt_number"),
  CONSTRAINT "command_attempts_command_id_fkey" FOREIGN KEY ("command_id") REFERENCES "device_commands"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "command_attempts_command_id_idx" ON "command_attempts"("command_id");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_user_id" UUID,
  "actor_role" VARCHAR(50),
  "action" VARCHAR(150) NOT NULL,
  "target_type" VARCHAR(100) NOT NULL,
  "target_id" VARCHAR(128),
  "result" VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
  "request_id" VARCHAR(128),
  "ip_address" VARCHAR(64),
  "user_agent" VARCHAR(512),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "audit_logs_actor_user_id_created_at_idx" ON "audit_logs"("actor_user_id", "created_at" DESC);
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "related_type" VARCHAR(100),
  "related_id" VARCHAR(128),
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at" DESC);

COMMIT;
