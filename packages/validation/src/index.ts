import { z } from 'zod';
import {
  COMMAND_STATUSES,
  COMMAND_TYPES,
  DEVICE_STATUSES,
  MDM_PROVIDER_TYPES,
  ROLES,
} from '@school-mdm/contracts';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  PUBLIC_LAN_URL: z.string().url().default('https://mdm.school.local'),
  DATABASE_URL: z.string().min(10, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().min(1).default('localhost'),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true')
    .default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  MDM_DEFAULT_PROVIDER: z
    .enum([MDM_PROVIDER_TYPES.HEADWIND_COMMUNITY, MDM_PROVIDER_TYPES.CLASSROOM_DPC])
    .default(MDM_PROVIDER_TYPES.CLASSROOM_DPC),
  HEADWIND_BASE_URL: z.string().url().optional(),
  HEADWIND_API_KEY: z.string().optional(),
  HEADWIND_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
  CLASSROOM_DPC_SHARED_SECRET: z.string().min(16).optional(),
  CLASSROOM_HEARTBEAT_INTERVAL_SEC: z.coerce.number().int().min(5).max(300).default(15),
  CLASSROOM_OFFLINE_THRESHOLD_SEC: z.coerce.number().int().min(15).max(900).default(45),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export function validateEnvironment(rawEnv: Record<string, unknown>): ValidatedEnv {
  return envSchema.parse(rawEnv);
}

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

export type LoginRequestInput = z.infer<typeof loginRequestSchema>;

export const changePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(8, 'Mật khẩu hiện tại tối thiểu 8 ký tự'),
    newPassword: z
      .string()
      .min(8, 'Mật khẩu mới tối thiểu 8 ký tự')
      .max(128, 'Mật khẩu mới tối đa 128 ký tự'),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
    path: ['newPassword'],
  });

export type ChangePasswordRequestInput = z.infer<typeof changePasswordRequestSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
});

export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;

export const dispatchDeviceCommandSchema = z.object({
  idempotencyKey: z.string().uuid('Idempotency key phải là UUID hợp lệ'),
  commandType: z.enum([
    COMMAND_TYPES.SYNC_DEVICE,
    COMMAND_TYPES.INSTALL_APP,
    COMMAND_TYPES.UPDATE_APP,
    COMMAND_TYPES.REMOVE_APP,
    COMMAND_TYPES.APPLY_CONFIGURATION,
    COMMAND_TYPES.LOCK_DEVICE,
    COMMAND_TYPES.REBOOT_DEVICE,
    COMMAND_TYPES.APPLY_KIOSK_POLICY,
    COMMAND_TYPES.APPLY_ALLOWLIST,
  ]),
  payload: z.record(z.unknown()).default({}),
  expiresInSeconds: z.number().int().min(30).max(86400).default(300),
});

export type DispatchDeviceCommandInput = z.infer<typeof dispatchDeviceCommandSchema>;

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email không hợp lệ'),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(128),
  fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(255),
  phone: z.string().trim().max(50).optional(),
  roles: z.array(z.enum([ROLES.ADMIN, ROLES.TEACHER])).min(1, 'Phải chọn ít nhất 1 vai trò'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const createAcademicYearSchema = z
  .object({
    code: z.string().trim().min(4).max(50),
    name: z.string().trim().min(4).max(150),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày bắt đầu phải có định dạng YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày kết thúc phải có định dạng YYYY-MM-DD'),
    isCurrent: z.boolean().default(false),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: 'Ngày kết thúc năm học phải sau ngày bắt đầu',
    path: ['endDate'],
  });

export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;

export const createSchoolClassSchema = z.object({
  academicYearId: z.string().uuid('academicYearId phải là UUID hợp lệ'),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(2).max(150),
  gradeLevel: z.number().int().min(1).max(12),
  roomName: z.string().trim().max(100).optional(),
});

export type CreateSchoolClassInput = z.infer<typeof createSchoolClassSchema>;

export const updateSchoolClassSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  gradeLevel: z.number().int().min(1).max(12).optional(),
  roomName: z.string().trim().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateSchoolClassInput = z.infer<typeof updateSchoolClassSchema>;

export const assignTeacherToClassSchema = z.object({
  teacherId: z.string().uuid('teacherId phải là UUID hợp lệ'),
  roleInClass: z.enum(['HOMEROOM', 'SUBJECT']).default('HOMEROOM'),
});

export type AssignTeacherToClassInput = z.infer<typeof assignTeacherToClassSchema>;

export const createStudentSchema = z.object({
  studentCode: z.string().trim().min(2).max(64),
  fullName: z.string().trim().min(2).max(255),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày sinh phải có định dạng YYYY-MM-DD')
    .optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const assignDeviceToClassSchema = z.object({
  classId: z.string().uuid('classId phải là UUID hợp lệ'),
  studentId: z.string().uuid('studentId phải là UUID hợp lệ').optional(),
  notes: z.string().trim().max(500).optional(),
});

export type AssignDeviceToClassInput = z.infer<typeof assignDeviceToClassSchema>;

export const deviceListFilterSchema = paginationQuerySchema.extend({
  classId: z.string().uuid().optional(),
  status: z
    .enum([
      DEVICE_STATUSES.ONLINE,
      DEVICE_STATUSES.OFFLINE,
      DEVICE_STATUSES.UNKNOWN,
      DEVICE_STATUSES.PENDING,
      DEVICE_STATUSES.ERROR,
    ])
    .optional(),
});

export type DeviceListFilterInput = z.infer<typeof deviceListFilterSchema>;

export const agentHeartbeatSchema = z.object({
  externalDeviceId: z.string().trim().min(2).max(255),
  serialNumber: z.string().trim().max(128).optional(),
  imei: z.string().trim().max(64).optional(),
  manufacturer: z.string().trim().min(1).max(120),
  model: z.string().trim().min(1).max(120),
  androidVersion: z.string().trim().min(1).max(50),
  sdkVersion: z.number().int().min(21).max(40),
  batteryLevel: z.number().int().min(0).max(100).optional(),
  installedApps: z
    .array(
      z.object({
        packageName: z.string().trim().min(3).max(255),
        name: z.string().trim().min(1).max(255),
        versionName: z.string().trim().min(1).max(100),
        versionCode: z.number().int().min(1),
      }),
    )
    .default([]),
});

export type AgentHeartbeatInput = z.infer<typeof agentHeartbeatSchema>;

export const agentCommandAckSchema = z.object({
  status: z.enum([
    COMMAND_STATUSES.ACKNOWLEDGED,
    COMMAND_STATUSES.SUCCESS,
    COMMAND_STATUSES.FAILED,
  ]),
  reason: z.string().trim().max(1000).optional(),
});

export type AgentCommandAckInput = z.infer<typeof agentCommandAckSchema>;

export const createApplicationSchema = z.object({
  packageName: z
    .string()
    .trim()
    .regex(/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/, 'Package name Android không hợp lệ'),
  name: z.string().trim().min(2).max(255),
  category: z.string().trim().min(2).max(100).default('EDUCATION'),
  versionName: z.string().trim().min(1).max(100),
  versionCode: z.number().int().min(1),
  apkUrl: z.string().url().optional(),
  isApproved: z.boolean().default(false),
  isMandatory: z.boolean().default(false),
  description: z.string().trim().max(1000).optional(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const policyRulesConfigSchema = z
  .object({
    kioskModeEnabled: z.boolean().default(false),
    kioskPackageName: z.string().trim().max(255).nullable().default(null),
    appAllowlistEnabled: z.boolean().default(false),
    allowedPackages: z.array(z.string().trim().min(3)).default([]),
    urlFilteringEnabled: z.boolean().default(false),
    allowedDomains: z.array(z.string().trim().min(3)).default([]),
    lockScreenDisabled: z.boolean().default(false),
  })
  .refine((data) => !data.kioskModeEnabled || Boolean(data.kioskPackageName), {
    message: 'Khi bật Kiosk Mode bắt buộc phải chỉ định kioskPackageName',
    path: ['kioskPackageName'],
  });

export type PolicyRulesConfigInput = z.infer<typeof policyRulesConfigSchema>;

export const createPolicySchema = z.object({
  code: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(1000).optional(),
  initialRules: policyRulesConfigSchema.default({
    kioskModeEnabled: false,
    kioskPackageName: null,
    appAllowlistEnabled: false,
    allowedPackages: [],
    urlFilteringEnabled: false,
    allowedDomains: [],
    lockScreenDisabled: false,
  }),
});

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;

export const clonePolicySchema = z.object({
  newCode: z.string().trim().min(2).max(100),
  newName: z.string().trim().min(2).max(255),
});

export type ClonePolicyInput = z.infer<typeof clonePolicySchema>;

export const createClassSessionSchema = z
  .object({
    classId: z.string().uuid('classId phải là UUID hợp lệ'),
    policyId: z.string().uuid('policyId phải là UUID hợp lệ'),
    policyVersionId: z.string().uuid('policyVersionId phải là UUID hợp lệ').optional(),
    title: z.string().trim().min(2, 'Tiêu đề tiết học tối thiểu 2 ký tự').max(255),
    subjectName: z.string().trim().min(2, 'Tên môn học tối thiểu 2 ký tự').max(120),
    scheduledStartAt: z.string().datetime({ message: 'scheduledStartAt phải là ISO datetime' }),
    scheduledEndAt: z.string().datetime({ message: 'scheduledEndAt phải là ISO datetime' }),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((data) => new Date(data.scheduledStartAt) < new Date(data.scheduledEndAt), {
    message: 'Thời gian kết thúc tiết học phải sau thời gian bắt đầu',
    path: ['scheduledEndAt'],
  });

export type CreateClassSessionInput = z.infer<typeof createClassSessionSchema>;
