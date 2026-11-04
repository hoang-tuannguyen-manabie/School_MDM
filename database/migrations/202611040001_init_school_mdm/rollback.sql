-- ============================================================================
-- Rollback Script: 202611040001_init_school_mdm
-- Description: Safely reverts the initial 23 tables and enum types in reverse
-- dependency order.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS "notifications";
DROP TABLE IF EXISTS "audit_logs";
DROP TABLE IF EXISTS "command_attempts";
DROP TABLE IF EXISTS "device_commands";
DROP TABLE IF EXISTS "session_devices";
DROP TABLE IF EXISTS "class_sessions";
DROP TABLE IF EXISTS "policy_apps";
DROP TABLE IF EXISTS "policy_versions";
DROP TABLE IF EXISTS "policies";
DROP TABLE IF EXISTS "device_applications";
DROP TABLE IF EXISTS "applications";
DROP TABLE IF EXISTS "mdm_sync_runs";
DROP TABLE IF EXISTS "mdm_device_links";
DROP TABLE IF EXISTS "mdm_providers";
DROP TABLE IF EXISTS "device_heartbeats";
DROP TABLE IF EXISTS "device_assignments";
DROP TABLE IF EXISTS "devices";
DROP TABLE IF EXISTS "students";
DROP TABLE IF EXISTS "teacher_classes";
DROP TABLE IF EXISTS "classes";
DROP TABLE IF EXISTS "academic_years";
DROP TABLE IF EXISTS "refresh_tokens";
DROP TABLE IF EXISTS "user_roles";
DROP TABLE IF EXISTS "roles";
DROP TABLE IF EXISTS "users";

DROP TYPE IF EXISTS "NotificationSeverity";
DROP TYPE IF EXISTS "CommandStatus";
DROP TYPE IF EXISTS "CommandType";
DROP TYPE IF EXISTS "SessionDeviceState";
DROP TYPE IF EXISTS "ClassSessionStatus";
DROP TYPE IF EXISTS "PolicyVersionStatus";
DROP TYPE IF EXISTS "SyncRunStatus";
DROP TYPE IF EXISTS "MdmProviderType";
DROP TYPE IF EXISTS "DeviceStatus";
DROP TYPE IF EXISTS "RoleCode";

COMMIT;
