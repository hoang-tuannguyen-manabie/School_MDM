import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  AuthenticatedUser,
  DeviceStatus,
  MdmDeviceInstalledApp,
  MdmProviderType,
} from '@school-mdm/contracts';
import { AuthRepositoryPort } from '../auth/auth.repository';
import { MdmProviderService } from './mdm-provider.service';

export interface SyncedSchoolDeviceRecord {
  id: string;
  assetTag: string;
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
  providerType: MdmProviderType;
  externalDeviceId: string;
  installedApps: MdmDeviceInstalledApp[];
  updatedAt: string;
}

export interface MdmSyncRunRecord {
  id: string;
  providerId: string;
  providerType: MdmProviderType;
  triggerType: 'INITIAL' | 'SCHEDULED' | 'MANUAL';
  status: 'RUNNING' | 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED';
  devicesFound: number;
  devicesCreated: number;
  devicesUpdated: number;
  errorCount: number;
  errorSummary: string | null;
  startedAt: string;
  completedAt: string | null;
}

@Injectable()
export class DeviceSyncService {
  /**
   * Keyed by internal School DB device UUID
   */
  private readonly devicesById = new Map<string, SyncedSchoolDeviceRecord>();

  /**
   * Enforces unique constraint: (providerType, externalDeviceId) -> internal deviceId
   */
  private readonly externalLinks = new Map<string, string>();

  /**
   * Enforces duplicate detection by physical serialNumber -> internal deviceId
   */
  private readonly serialNumberIndex = new Map<string, string>();

  private readonly syncRuns: MdmSyncRunRecord[] = [];

  constructor(
    private readonly providerService: MdmProviderService,
    private readonly authRepo: AuthRepositoryPort,
  ) {}

  async syncDevices(
    triggerType: 'INITIAL' | 'SCHEDULED' | 'MANUAL',
    actor: AuthenticatedUser | null,
    providerType?: MdmProviderType,
  ): Promise<MdmSyncRunRecord> {
    const providerConfig = providerType
      ? this.providerService.getProviderConfig(providerType)
      : this.providerService.getDefaultProviderConfig();

    const adapter = this.providerService.getAdapter(providerConfig.providerType);
    const startedAt = new Date().toISOString();

    let devicesFound = 0;
    let devicesCreated = 0;
    let devicesUpdated = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const externalDevices = await adapter.getDevices();
      devicesFound = externalDevices.length;

      for (const ext of externalDevices) {
        try {
          const linkKey = `${providerConfig.providerType}:${ext.externalDeviceId}`;
          let internalDeviceId = this.externalLinks.get(linkKey);

          // Duplicate detection by physical serialNumber if not linked yet
          if (!internalDeviceId && ext.serialNumber) {
            internalDeviceId = this.serialNumberIndex.get(ext.serialNumber);
          }

          const installedApps = await adapter.getDeviceApplications(ext.externalDeviceId);
          const nowIso = new Date().toISOString();

          if (!internalDeviceId) {
            internalDeviceId = randomUUID();
            const createdRecord: SyncedSchoolDeviceRecord = {
              id: internalDeviceId,
              assetTag: `TAB-${ext.externalDeviceId.slice(-6).toUpperCase()}`,
              serialNumber: ext.serialNumber ?? null,
              imei: ext.imei ?? null,
              displayName: `${ext.manufacturer} ${ext.model} (${ext.externalDeviceId})`,
              manufacturer: ext.manufacturer,
              model: ext.model,
              androidVersion: ext.androidVersion,
              sdkVersion: ext.sdkVersion,
              status: ext.status,
              batteryLevel: ext.batteryLevel ?? null,
              lastSeenAt: ext.lastSeenAt,
              providerType: providerConfig.providerType,
              externalDeviceId: ext.externalDeviceId,
              installedApps,
              updatedAt: nowIso,
            };

            this.devicesById.set(internalDeviceId, createdRecord);
            this.externalLinks.set(linkKey, internalDeviceId);
            if (ext.serialNumber) {
              this.serialNumberIndex.set(ext.serialNumber, internalDeviceId);
            }
            devicesCreated++;
          } else {
            const existing = this.devicesById.get(internalDeviceId);
            if (existing) {
              existing.manufacturer = ext.manufacturer;
              existing.model = ext.model;
              existing.androidVersion = ext.androidVersion;
              existing.sdkVersion = ext.sdkVersion;
              existing.status = ext.status;
              existing.batteryLevel = ext.batteryLevel ?? existing.batteryLevel;
              existing.lastSeenAt = ext.lastSeenAt;
              existing.installedApps = installedApps;
              existing.updatedAt = nowIso;
            }
            this.externalLinks.set(linkKey, internalDeviceId);
            if (ext.serialNumber) {
              this.serialNumberIndex.set(ext.serialNumber, internalDeviceId);
            }
            devicesUpdated++;
          }
        } catch (deviceErr) {
          errorCount++;
          errors.push(
            deviceErr instanceof Error
              ? `${ext.externalDeviceId}: ${deviceErr.message}`
              : `${ext.externalDeviceId}: Lỗi không xác định`,
          );
        }
      }
    } catch (syncErr) {
      errorCount++;
      errors.push(syncErr instanceof Error ? syncErr.message : 'Lỗi kết nối provider khi đồng bộ');
    }

    const status: MdmSyncRunRecord['status'] =
      errorCount === 0
        ? 'SUCCESS'
        : devicesCreated + devicesUpdated > 0
          ? 'PARTIAL_FAILURE'
          : 'FAILED';

    const syncRun: MdmSyncRunRecord = {
      id: randomUUID(),
      providerId: providerConfig.id,
      providerType: providerConfig.providerType,
      triggerType,
      status,
      devicesFound,
      devicesCreated,
      devicesUpdated,
      errorCount,
      errorSummary: errors.length > 0 ? errors.join('; ') : null,
      startedAt,
      completedAt: new Date().toISOString(),
    };

    this.syncRuns.unshift(syncRun);

    await this.authRepo.recordAuditLog({
      actorUserId: actor?.id ?? null,
      actorRole: actor?.roles[0] ?? 'SYSTEM',
      action: 'MDM_DEVICE_SYNC_EXECUTED',
      targetType: 'MDM_PROVIDER',
      targetId: providerConfig.id,
      result: status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
      requestId: randomUUID(),
      ipAddress: null,
      userAgent: null,
      metadata: {
        providerType: providerConfig.providerType,
        triggerType,
        devicesFound,
        devicesCreated,
        devicesUpdated,
        errorCount,
      },
    });

    return syncRun;
  }

  listSyncedDevices(now = new Date()): SyncedSchoolDeviceRecord[] {
    return Array.from(this.devicesById.values()).map((d) => this.withEvaluatedStatus(d, now));
  }

  getSyncedDeviceById(deviceId: string, now = new Date()): SyncedSchoolDeviceRecord | null {
    const d = this.devicesById.get(deviceId);
    if (!d) {
      return null;
    }
    return this.withEvaluatedStatus(d, now);
  }

  listSyncRuns(): MdmSyncRunRecord[] {
    return this.syncRuns.map((r) => ({ ...r }));
  }

  private withEvaluatedStatus(
    record: SyncedSchoolDeviceRecord,
    now: Date,
  ): SyncedSchoolDeviceRecord {
    const thresholdSec = Number(process.env.CLASSROOM_OFFLINE_THRESHOLD_SEC ?? 45);
    const thresholdMs = thresholdSec * 1000;
    let evaluatedStatus: DeviceStatus = record.status;

    if (!record.lastSeenAt) {
      evaluatedStatus = 'UNKNOWN';
    } else {
      const elapsedMs = now.getTime() - new Date(record.lastSeenAt).getTime();
      evaluatedStatus = elapsedMs <= thresholdMs ? 'ONLINE' : 'OFFLINE';
    }

    return {
      ...record,
      status: evaluatedStatus,
      installedApps: [...record.installedApps],
    };
  }
}
