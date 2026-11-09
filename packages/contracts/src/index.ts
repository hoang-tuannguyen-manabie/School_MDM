export const ROLES = {
  ADMIN: 'ADMIN',
  TEACHER: 'TEACHER',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

export const DEVICE_STATUSES = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN',
  PENDING: 'PENDING',
  ERROR: 'ERROR',
} as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[keyof typeof DEVICE_STATUSES];

export const COMMAND_STATUSES = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  TIMEOUT: 'TIMEOUT',
  UNSUPPORTED: 'UNSUPPORTED',
} as const;

export type CommandStatus = (typeof COMMAND_STATUSES)[keyof typeof COMMAND_STATUSES];

export const COMMAND_TYPES = {
  SYNC_DEVICE: 'SYNC_DEVICE',
  INSTALL_APP: 'INSTALL_APP',
  UPDATE_APP: 'UPDATE_APP',
  REMOVE_APP: 'REMOVE_APP',
  APPLY_CONFIGURATION: 'APPLY_CONFIGURATION',
  LOCK_DEVICE: 'LOCK_DEVICE',
  REBOOT_DEVICE: 'REBOOT_DEVICE',
  APPLY_KIOSK_POLICY: 'APPLY_KIOSK_POLICY',
  APPLY_ALLOWLIST: 'APPLY_ALLOWLIST',
} as const;

export type CommandType = (typeof COMMAND_TYPES)[keyof typeof COMMAND_TYPES];

export const MDM_PROVIDER_TYPES = {
  HEADWIND_COMMUNITY: 'HEADWIND_COMMUNITY',
  CLASSROOM_DPC: 'CLASSROOM_DPC',
} as const;

export type MdmProviderType = (typeof MDM_PROVIDER_TYPES)[keyof typeof MDM_PROVIDER_TYPES];

export const REALTIME_EVENTS = {
  DEVICE_STATUS_UPDATED: 'device.status.updated',
  DEVICE_HEARTBEAT_RECEIVED: 'device.heartbeat.received',
  COMMAND_STATUS_UPDATED: 'command.status.updated',
  SESSION_STATUS_UPDATED: 'session.status.updated',
  SESSION_DEVICE_UPDATED: 'session.device.updated',
  NOTIFICATION_CREATED: 'notification.created',
} as const;

export type RealtimeEventName = (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export interface MdmCapabilityDetail {
  supported: boolean;
  reason?: string;
}

export interface MdmCapabilityMatrix {
  providerType: MdmProviderType;
  providerVersion: string;
  verifiedAt: string;
  capabilities: {
    deviceInventory: MdmCapabilityDetail;
    appCatalog: MdmCapabilityDetail;
    installApplication: MdmCapabilityDetail;
    removeApplication: MdmCapabilityDetail;
    applyConfiguration: MdmCapabilityDetail;
    kioskMode: MdmCapabilityDetail;
    appAllowlist: MdmCapabilityDetail;
    remoteLock: MdmCapabilityDetail;
    remoteReboot: MdmCapabilityDetail;
    urlFiltering: MdmCapabilityDetail;
  };
}

export interface MdmExternalDevice {
  externalDeviceId: string;
  androidId?: string;
  serialNumber?: string;
  imei?: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkVersion: number;
  batteryLevel?: number;
  lastSeenAt: string | null;
  status: DeviceStatus;
}

export interface MdmExternalApplication {
  externalAppId: string;
  packageName: string;
  name: string;
  versionName: string;
  versionCode: number;
  apkUrl?: string;
}

export interface MdmDeviceInstalledApp {
  packageName: string;
  name: string;
  versionName: string;
  versionCode: number;
  installedAt?: string;
}

export interface MdmCommandEnvelope {
  idempotencyKey: string;
  externalDeviceId: string;
  commandType: CommandType;
  payload: Record<string, unknown>;
  expiresAt: string;
}

export interface MdmCommandDispatchResult {
  externalCommandId: string | null;
  status: CommandStatus;
  reason?: string;
  dispatchedAt: string;
}

export interface MdmCommandStatusResult {
  externalCommandId: string;
  status: CommandStatus;
  reason?: string;
  updatedAt: string;
}

export interface MdmDeviceQuery {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface MdmAdapter {
  connect(): Promise<{ connected: boolean; providerVersion: string; message?: string }>;
  getDevices(query?: MdmDeviceQuery): Promise<MdmExternalDevice[]>;
  getDevice(externalDeviceId: string): Promise<MdmExternalDevice | null>;
  getApplications(): Promise<MdmExternalApplication[]>;
  getDeviceApplications(externalDeviceId: string): Promise<MdmDeviceInstalledApp[]>;
  sendCommand(command: MdmCommandEnvelope): Promise<MdmCommandDispatchResult>;
  getCommandStatus(externalCommandId: string): Promise<MdmCommandStatusResult>;
  getCapabilities(): Promise<MdmCapabilityMatrix>;
}

export interface ApiMeta {
  requestId: string;
  timestamp: string;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roles: RoleName[];
  assignedClassIds: string[];
}

export interface AuthSessionSummary {
  id: string;
  familyId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface AuthTokensResponse {
  accessToken: string;
  expiresInSeconds: number;
  user: AuthenticatedUser;
}

export interface AcademicYearDto {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface SchoolClassDto {
  id: string;
  academicYearId: string;
  code: string;
  name: string;
  gradeLevel: number;
  roomName: string | null;
  isActive: boolean;
  teacherIds: string[];
  createdAt: string;
}

export interface TeacherClassAssignmentDto {
  id: string;
  teacherId: string;
  classId: string;
  roleInClass: 'HOMEROOM' | 'SUBJECT';
  isActive: boolean;
  assignedAt: string;
}

export interface StudentDto {
  id: string;
  classId: string | null;
  studentCode: string;
  fullName: string;
  dateOfBirth: string | null;
  isActive: boolean;
}

export interface UserSummaryDto {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  roles: RoleName[];
  assignedClassIds: string[];
  createdAt: string;
}

export interface DeviceAssignmentRecordDto {
  id: string;
  deviceId: string;
  classId: string;
  studentId: string | null;
  assignedById: string | null;
  isActive: boolean;
  assignedAt: string;
  unassignedAt: string | null;
  notes: string | null;
}

export interface DeviceCommandSummaryDto {
  id: string;
  idempotencyKey: string;
  deviceId: string;
  commandType: CommandType;
  status: CommandStatus;
  externalCommandId: string | null;
  failureReason: string | null;
  actorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceSummaryDto {
  id: string;
  assetTag: string;
  androidId?: string | null;
  serialNumber: string | null;
  imei: string | null;
  displayName: string;
  manufacturer: string;
  model: string;
  androidVersion: string;
  sdkVersion: number;
  status: DeviceStatus;
  batteryLevel: number | null;
  lastSeenAt: string | null;
  activeClassId: string | null;
  activeStudentId: string | null;
  providerType: MdmProviderType;
  externalDeviceId: string;
  updatedAt: string;
}

export interface DeviceDetailDto extends DeviceSummaryDto {
  installedApps: MdmDeviceInstalledApp[];
  assignmentHistory: DeviceAssignmentRecordDto[];
  commandHistory: DeviceCommandSummaryDto[];
}

export interface CommandAttemptDto {
  id: string;
  commandId: string;
  attemptNumber: number;
  status: CommandStatus;
  externalCommandId: string | null;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface DeviceCommandDetailDto extends DeviceCommandSummaryDto {
  providerType: MdmProviderType;
  sessionId: string | null;
  payload: Record<string, unknown>;
  maxRetries: number;
  retryCount: number;
  expiresAt: string;
  sentAt: string | null;
  acknowledgedAt: string | null;
  completedAt: string | null;
  attempts: CommandAttemptDto[];
}

export interface ApplicationCatalogItemDto {
  id: string;
  packageName: string;
  name: string;
  category: string;
  versionName: string;
  versionCode: number;
  apkUrl: string | null;
  isApproved: boolean;
  isMandatory: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDeviceInstallStatusDto {
  deviceId: string;
  displayName: string;
  installedVersionName: string;
  installedVersionCode: number;
  isUpToDate: boolean;
}

export interface ApplicationDetailDto extends ApplicationCatalogItemDto {
  installedDevices: ApplicationDeviceInstallStatusDto[];
  providerSupportsInstall: boolean;
  providerSupportsRemove: boolean;
}

export type PolicyCapabilityKey = keyof MdmCapabilityMatrix['capabilities'];

export interface PolicyVersionDto {
  id: string;
  policyId: string;
  versionNumber: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  kioskModeEnabled: boolean;
  kioskPackageName: string | null;
  appAllowlistEnabled: boolean;
  allowedPackages: string[];
  urlFilteringEnabled: boolean;
  allowedDomains: string[];
  lockScreenDisabled: boolean;
  requiredCapabilities: PolicyCapabilityKey[];
  publishedById: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface PolicySummaryDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currentVersionId: string | null;
  isActive: boolean;
  versions: PolicyVersionDto[];
  createdAt: string;
  updatedAt: string;
}

export type ClassSessionStatus = 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';

export type SessionDeviceSyncState =
  | 'PENDING_APPLY'
  | 'WAITING_DEVICE_ONLINE'
  | 'POLICY_SENT'
  | 'POLICY_APPLIED'
  | 'PENDING_RELEASE'
  | 'WAITING_RELEASE_ONLINE'
  | 'RELEASE_SENT'
  | 'RELEASED'
  | 'FAILED'
  | 'UNSUPPORTED';

export interface ClassSessionDeviceDto {
  id: string;
  sessionId: string;
  deviceId: string;
  deviceDisplayName: string;
  deviceStatus: DeviceStatus;
  syncState: SessionDeviceSyncState;
  applyCommandId: string | null;
  releaseCommandId: string | null;
  lastError: string | null;
  appliedAt: string | null;
  releasedAt: string | null;
  updatedAt: string;
}

export interface ClassSessionDetailDto {
  id: string;
  classId: string;
  teacherId: string;
  policyId: string;
  policyVersionId: string;
  title: string;
  subjectName: string;
  status: ClassSessionStatus;
  scheduledStartAt: string;
  scheduledEndAt: string;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  notes: string | null;
  devices: ClassSessionDeviceDto[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogItemDto {
  id: string;
  actorUserId: string | null;
  actorRole: RoleName | 'SYSTEM';
  action: string;
  entityType: string;
  entityId: string | null;
  classId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface NotificationItemDto {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  isRead: boolean;
  createdAt: string;
}

export interface DashboardSummaryDto {
  totalClasses: number;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  activeSessions: number;
  pendingCommands: number;
  failedCommandsLast24h: number;
}

export interface ReportOverviewDto {
  generatedAt: string;
  deviceStatusBreakdown: Record<DeviceStatus, number>;
  commandStatusBreakdown: Record<CommandStatus, number>;
  sessionsByStatus: Record<ClassSessionStatus, number>;
  topInstalledApps: Array<{
    packageName: string;
    name: string;
    installedDeviceCount: number;
  }>;
}

export const CORE_DOMAIN_TABLES = [
  'users',
  'roles',
  'user_roles',
  'refresh_tokens',
  'academic_years',
  'classes',
  'teacher_classes',
  'students',
  'devices',
  'device_assignments',
  'device_heartbeats',
  'device_applications',
  'mdm_providers',
  'mdm_device_links',
  'mdm_sync_runs',
  'applications',
  'policies',
  'policy_versions',
  'policy_apps',
  'class_sessions',
  'session_devices',
  'device_commands',
  'command_attempts',
  'audit_logs',
  'notifications',
] as const;

export function mapCommandTypeToCapabilityKey(
  commandType: CommandType,
): keyof MdmCapabilityMatrix['capabilities'] {
  switch (commandType) {
    case COMMAND_TYPES.SYNC_DEVICE:
      return 'deviceInventory';
    case COMMAND_TYPES.INSTALL_APP:
    case COMMAND_TYPES.UPDATE_APP:
      return 'installApplication';
    case COMMAND_TYPES.REMOVE_APP:
      return 'removeApplication';
    case COMMAND_TYPES.APPLY_CONFIGURATION:
      return 'applyConfiguration';
    case COMMAND_TYPES.LOCK_DEVICE:
      return 'remoteLock';
    case COMMAND_TYPES.REBOOT_DEVICE:
      return 'remoteReboot';
    case COMMAND_TYPES.APPLY_KIOSK_POLICY:
      return 'kioskMode';
    case COMMAND_TYPES.APPLY_ALLOWLIST:
      return 'appAllowlist';
  }
}
