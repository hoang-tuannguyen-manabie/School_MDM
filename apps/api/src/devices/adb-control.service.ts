import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface AdbDeviceState {
  serial: string;
  ipAddress?: string;
  status: 'device' | 'unauthorized' | 'offline';
  model?: string;
  batteryLevel?: number;
  foregroundPackage?: string;
  isScreenAwake?: boolean;
  lastUpdated: Date;
}

@Injectable()
export class AdbControlService implements OnModuleInit, OnModuleDestroy {
  private readonly adbPath: string;
  private watchdogTimer?: NodeJS.Timeout;
  private batterySyncTimer?: NodeJS.Timeout;
  private isWatchdogRunning = false;

  // Classroom hardware control states
  private isClassroomLocked = false;
  private activeKioskPackage: string | null = null;
  private settingsGraceUntil = 0;

  private readonly approvedPackages = new Set<string>([
    'com.openai.chatgpt',
    'com.canva.editor',
    'com.android.chrome',
    'com.google.android.calculator',
    'com.google.android.apps.nbu.files',
  ]);

  private readonly blockedPackages = new Set<string>([
    'com.android.camera2',
    'com.google.android.youtube',
    'com.android.settings',
  ]);

  private readonly connectedDevices = new Map<string, AdbDeviceState>();
  private readonly knownIpPorts = new Map<string, string>();

  constructor() {
    this.adbPath = this.resolveAdbBinaryPath();
  }

  private resolveAdbBinaryPath(): string {
    const candidates = [
      path.resolve(process.cwd(), 'tools/platform-tools/adb.exe'),
      path.resolve(process.cwd(), '../../tools/platform-tools/adb.exe'),
      path.resolve(__dirname, '../../../../tools/platform-tools/adb.exe'),
      path.resolve(__dirname, '../../../../../tools/platform-tools/adb.exe'),
      'C:\\Users\\Manabie\\OneDrive\\Documents\\manabie\\coding\\DMD_Manabie\\school-mdm\\tools\\platform-tools\\adb.exe',
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return 'adb';
  }

  onModuleInit() {
    // Start ADB daemon in background and begin watchdog
    void this.refreshDevices();

    this.watchdogTimer = setInterval(() => {
      void this.runWatchdogCycle();
    }, 2000);

    this.batterySyncTimer = setInterval(() => {
      void this.syncDeviceTelemetry();
    }, 8000);
  }

  onModuleDestroy() {
    if (this.watchdogTimer) clearInterval(this.watchdogTimer);
    if (this.batterySyncTimer) clearInterval(this.batterySyncTimer);
  }

  async execAdb(
    args: string[],
    timeoutMs = 5000,
  ): Promise<{ ok: boolean; stdout: string; stderr: string }> {
    try {
      const { stdout, stderr } = await execFileAsync(this.adbPath, args, {
        timeout: timeoutMs,
        windowsHide: true,
      });
      return { ok: true, stdout: stdout || '', stderr: stderr || '' };
    } catch (err: unknown) {
      const errorObj = err as { stdout?: string; stderr?: string; message?: string };
      return {
        ok: false,
        stdout: errorObj.stdout || '',
        stderr: errorObj.stderr || errorObj.message || 'ADB command failed',
      };
    }
  }

  /**
   * Refreshes list of connected ADB devices and auto-connects mDNS wireless debugging services
   */
  async refreshDevices(): Promise<AdbDeviceState[]> {
    // 1. Check mDNS for any Android 14 Wireless Debugging services on LAN
    const mdnsRes = await this.execAdb(['mdns', 'services'], 3000);
    if (mdnsRes.ok && mdnsRes.stdout) {
      const lines = mdnsRes.stdout.split(/\r?\n/);
      for (const line of lines) {
        if (line.includes('_adb-tls-connect._tcp')) {
          const match = line.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3}):([0-9]{2,5})/);
          if (match) {
            const ip = match[1];
            const port = match[2];
            this.knownIpPorts.set(ip, port);
            await this.execAdb(['connect', `${ip}:${port}`], 3000);
          }
        }
      }
    }

    // 2. Parse `adb devices -l`
    const res = await this.execAdb(['devices', '-l'], 4000);
    const currentSerials = new Set<string>();

    if (res.ok) {
      const lines = res.stdout.split(/\r?\n/).slice(1);
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('*')) continue;

        const parts = line.split(/\s+/);
        const serial = parts[0];
        const rawStatus = parts[1];
        if (!serial || !rawStatus) continue;

        if (
          rawStatus === 'device' ||
          rawStatus === 'unauthorized' ||
          rawStatus === 'offline'
        ) {
          currentSerials.add(serial);
          const ipMatch = serial.match(/^([0-9]{1,3}(?:\.[0-9]{1,3}){3}):([0-9]{2,5})$/);
          const modelMatch = line.match(/model:([^\s]+)/);

          const existing = this.connectedDevices.get(serial);
          this.connectedDevices.set(serial, {
            serial,
            ipAddress: ipMatch ? ipMatch[1] : existing?.ipAddress,
            status: rawStatus,
            model: modelMatch ? modelMatch[1].replace(/_/g, ' ') : existing?.model,
            batteryLevel: existing?.batteryLevel,
            foregroundPackage: existing?.foregroundPackage,
            isScreenAwake: existing?.isScreenAwake,
            lastUpdated: new Date(),
          });
        }
      }
    }

    for (const oldSerial of Array.from(this.connectedDevices.keys())) {
      if (!currentSerials.has(oldSerial)) {
        this.connectedDevices.delete(oldSerial);
      }
    }

    return Array.from(this.connectedDevices.values());
  }

  getControlStatus(targetIp?: string) {
    const all = Array.from(this.connectedDevices.values());
    const activeDevices = all.filter((d) => d.status === 'device');
    const unauthorizedDevices = all.filter((d) => d.status === 'unauthorized');

    let matchedDevice: AdbDeviceState | undefined;
    if (targetIp) {
      matchedDevice =
        activeDevices.find((d) => d.ipAddress === targetIp || d.serial.startsWith(targetIp)) ||
        activeDevices[0];
    } else {
      matchedDevice = activeDevices[0];
    }

    return {
      adbConnected: Boolean(matchedDevice && matchedDevice.status === 'device'),
      unauthorizedPromptPending: unauthorizedDevices.length > 0,
      adbSerial: matchedDevice?.serial ?? null,
      batteryLevel: matchedDevice?.batteryLevel ?? null,
      foregroundPackage: matchedDevice?.foregroundPackage ?? null,
      isScreenAwake: matchedDevice?.isScreenAwake ?? null,
      isClassroomLocked: this.isClassroomLocked,
      activeKioskPackage: this.activeKioskPackage,
      connectedCount: activeDevices.length,
      devices: all,
    };
  }

  /**
   * Pairs (Android 11-14 Wireless Debugging) and/or connects to the tablet over Wi-Fi / USB
   */
  async pairAndConnectDevice(params: {
    ipAddress: string;
    pairingPort?: string;
    pairingCode?: string;
    connectPort?: string;
  }): Promise<{
    success: boolean;
    adbConnected: boolean;
    serial?: string;
    message: string;
    details?: string;
  }> {
    const cleanIp = (params.ipAddress || '192.168.1.28').trim();
    const cleanPairingPort = (params.pairingPort || '').trim();
    const cleanPairingCode = (params.pairingCode || '').trim();
    const cleanConnectPort = (params.connectPort || '').trim();

    // Give a 20-second grace period on Settings so admin isn't kicked out of Settings immediately upon connect
    this.settingsGraceUntil = Date.now() + 20000;

    // 1. Check if a USB device is connected right now; if so, switch it to TCP/IP 5555 automatically!
    const currentList = await this.refreshDevices();
    const usbDevice = currentList.find(
      (d) => d.status === 'device' && !d.serial.includes(':'),
    );
    if (usbDevice && !cleanPairingCode) {
      await this.execAdb(['-s', usbDevice.serial, 'tcpip', '5555'], 5000);
      await new Promise((r) => setTimeout(r, 1500));
      const connRes = await this.execAdb(['connect', `${cleanIp}:5555`], 5000);
      await this.refreshDevices();
      if (connRes.stdout.includes('connected to')) {
        await this.syncDeviceTelemetry();
        await this.syncPoliciesToAllDevices();
        return {
          success: true,
          adbConnected: true,
          serial: `${cleanIp}:5555`,
          message: `Đã kích hoạt điều khiển phần cứng qua USB và chuyển sang Wi-Fi (${cleanIp}:5555) thành công! Bạn có thể rút cáp USB.`,
        };
      }
    }

    // 2. If Pairing Port & Pairing Code provided -> Run `adb pair ip:pairingPort code`
    let pairOutput = '';
    if (cleanPairingPort && cleanPairingCode) {
      const pairTarget = `${cleanIp}:${cleanPairingPort}`;
      const pairRes = await this.execAdb(['pair', pairTarget, cleanPairingCode], 8000);
      pairOutput = `${pairRes.stdout} ${pairRes.stderr}`.trim();

      if (
        !pairOutput.toLowerCase().includes('successfully paired') &&
        !pairRes.ok
      ) {
        return {
          success: false,
          adbConnected: false,
          message: `Ghép nối thất bại tại ${pairTarget}. Vui lòng kiểm tra lại Mã ghép nối 6 số và Cổng ghép nối trên màn hình máy tính bảng.`,
          details: pairOutput,
        };
      }
    }

    // 3. Connect to the wireless debugging port
    const portsToTry: string[] = [];
    if (cleanConnectPort) portsToTry.push(cleanConnectPort);
    const mdnsPort = this.knownIpPorts.get(cleanIp);
    if (mdnsPort && !portsToTry.includes(mdnsPort)) portsToTry.push(mdnsPort);
    if (!portsToTry.includes('5555')) portsToTry.push('5555');

    // Also refresh mDNS right after pairing because Android 14 advertises the connect port via mDNS!
    const mdnsRes = await this.execAdb(['mdns', 'services'], 3000);
    if (mdnsRes.ok && mdnsRes.stdout) {
      const matches = mdnsRes.stdout.matchAll(
        new RegExp(`${cleanIp.replace(/\./g, '\\.')}:([0-9]{2,5})`, 'g'),
      );
      for (const m of matches) {
        if (m[1] && !portsToTry.includes(m[1])) {
          portsToTry.unshift(m[1]);
        }
      }
    }

    let connectedSerial: string | null = null;
    let lastConnectOutput = '';

    for (const port of portsToTry) {
      const target = `${cleanIp}:${port}`;
      const connRes = await this.execAdb(['connect', target], 5000);
      const out = `${connRes.stdout} ${connRes.stderr}`.trim();
      lastConnectOutput = out;

      if (
        out.toLowerCase().includes('connected to') ||
        out.toLowerCase().includes('already connected')
      ) {
        // Verify with `adb devices`
        const devicesAfter = await this.refreshDevices();
        const found = devicesAfter.find(
          (d) => d.serial === target && (d.status === 'device' || d.status === 'unauthorized'),
        );
        if (found) {
          connectedSerial = target;
          // Also open standard port 5555 so future connections don't need random ports
          if (port !== '5555' && found.status === 'device') {
            await this.execAdb(['-s', target, 'tcpip', '5555'], 4000);
            await new Promise((r) => setTimeout(r, 1000));
            await this.execAdb(['connect', `${cleanIp}:5555`], 4000);
            await this.refreshDevices();
          }
          break;
        }
      }
    }

    const finalStatus = this.getControlStatus(cleanIp);
    if (finalStatus.adbConnected) {
      await this.syncDeviceTelemetry();
      await this.syncPoliciesToAllDevices();
      return {
        success: true,
        adbConnected: true,
        serial: finalStatus.adbSerial ?? connectedSerial ?? undefined,
        message: `Đã kết nối điều khiển phần cứng thành công với máy tính bảng (${finalStatus.adbSerial})! Mọi lệnh Khóa màn hình, Ghim App và Chặn App đã có hiệu lực trực tiếp trên máy.`,
      };
    }

    if (finalStatus.unauthorizedPromptPending) {
      return {
        success: false,
        adbConnected: false,
        message:
          'Máy tính bảng đang hiển thị bảng hỏi "Cho phép gỡ lỗi qua Wi-Fi / USB?". Vui lòng tích chọn "Luôn cho phép từ máy tính này" và bấm Cho phép trên màn hình tablet!',
      };
    }

    if (pairOutput.toLowerCase().includes('successfully paired')) {
      return {
        success: true,
        adbConnected: false,
        message:
          'Đã ghép nối Mã 6 số thành công! Bây giờ vui lòng nhập "Cổng kết nối (IP & Port)" hiển thị ở màn hình Gỡ lỗi qua Wi-Fi để hoàn tất kết nối.',
        details: lastConnectOutput,
      };
    }

    return {
      success: false,
      adbConnected: false,
      message: `Chưa thể kết nối điều khiển đến ${cleanIp}. Trên tablet Teclast P30, vui lòng bật "Gỡ lỗi qua Wi-Fi" (Wireless Debugging) trong Tùy chọn nhà phát triển và nhập Cổng kết nối / Mã ghép nối.`,
      details: lastConnectOutput,
    };
  }

  /**
   * Lock or Unlock all classroom tablets immediately
   */
  async setClassroomLock(locked: boolean): Promise<{
    locked: boolean;
    affectedDevices: number;
  }> {
    this.isClassroomLocked = locked;
    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );

    await Promise.all(
      activeDevices.map(async (dev) => {
        if (locked) {
          await this.execAdb(['-s', dev.serial, 'shell', 'cmd', 'statusbar', 'collapse']);
          await this.execAdb(['-s', dev.serial, 'shell', 'input', 'keyevent', '223']);
          dev.isScreenAwake = false;
        } else {
          await this.execAdb(['-s', dev.serial, 'shell', 'input', 'keyevent', '224']);
          await this.execAdb(['-s', dev.serial, 'shell', 'wm', 'dismiss-keyguard']);
          await this.execAdb([
            '-s',
            dev.serial,
            'shell',
            'input',
            'swipe',
            '500',
            '1100',
            '500',
            '300',
            '200',
          ]);
          dev.isScreenAwake = true;
          if (this.activeKioskPackage) {
            await this.launchAppOnDevice(dev.serial, this.activeKioskPackage);
          }
        }
      }),
    );

    return {
      locked: this.isClassroomLocked,
      affectedDevices: activeDevices.length,
    };
  }

  /**
   * Pin a specific app in Kiosk mode or unpin (null)
   */
  async setKioskApp(packageName: string | null): Promise<{
    activeKioskPackage: string | null;
    affectedDevices: number;
  }> {
    this.activeKioskPackage = packageName;
    if (packageName) {
      this.isClassroomLocked = false;
    }

    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );

    await Promise.all(
      activeDevices.map(async (dev) => {
        await this.applyPackagePoliciesOnDevice(dev.serial);
        if (packageName) {
          await this.execAdb(['-s', dev.serial, 'shell', 'input', 'keyevent', '224']);
          await this.execAdb(['-s', dev.serial, 'shell', 'wm', 'dismiss-keyguard']);
          await this.execAdb(['-s', dev.serial, 'shell', 'cmd', 'statusbar', 'collapse']);
          await this.launchAppOnDevice(dev.serial, packageName);
        }
      }),
    );

    return {
      activeKioskPackage: this.activeKioskPackage,
      affectedDevices: activeDevices.length,
    };
  }

  /**
   * Syncs approved and blocked package sets from ApplicationsService and immediately enforces on tablet
   */
  async syncAppCatalogPermissions(
    apps: Array<{ packageName: string; isApproved: boolean }>,
  ): Promise<void> {
    this.approvedPackages.clear();
    this.blockedPackages.clear();

    for (const app of apps) {
      if (app.isApproved) {
        this.approvedPackages.add(app.packageName);
      } else {
        this.blockedPackages.add(app.packageName);
      }
    }

    await this.syncPoliciesToAllDevices();
  }

  async syncPoliciesToAllDevices(): Promise<void> {
    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );
    await Promise.all(
      activeDevices.map((dev) => this.applyPackagePoliciesOnDevice(dev.serial)),
    );
  }

  private async applyPackagePoliciesOnDevice(serial: string): Promise<void> {
    const allManagedPackages = new Set([
      ...this.approvedPackages,
      ...this.blockedPackages,
    ]);

    for (const pkg of allManagedPackages) {
      // Do not OS-suspend com.android.settings (Watchdog handles Settings via Home redirect)
      if (pkg === 'com.android.settings') continue;

      const shouldAllow = this.activeKioskPackage
        ? pkg === this.activeKioskPackage
        : this.approvedPackages.has(pkg);

      if (shouldAllow) {
        await this.execAdb([
          '-s',
          serial,
          'shell',
          'cmd',
          'package',
          'unsuspend',
          pkg,
        ]);
      } else {
        await this.execAdb([
          '-s',
          serial,
          'shell',
          'cmd',
          'package',
          'suspend',
          pkg,
        ]);
        await this.execAdb(['-s', serial, 'shell', 'am', 'force-stop', pkg]);
      }
    }
  }

  private async launchAppOnDevice(serial: string, packageName: string): Promise<void> {
    await this.execAdb([
      '-s',
      serial,
      'shell',
      'monkey',
      '-p',
      packageName,
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ]);
  }

  /**
   * Broadcasts a teacher notification banner onto all connected tablets
   */
  async sendBroadcastMessage(message: string): Promise<{
    sent: boolean;
    affectedDevices: number;
  }> {
    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );
    const cleanMsg = message.replace(/["`$]/g, '');

    await Promise.all(
      activeDevices.map(async (dev) => {
        await this.execAdb(['-s', dev.serial, 'shell', 'input', 'keyevent', '224']);
        await this.execAdb([
          '-s',
          dev.serial,
          'shell',
          'cmd',
          'notification',
          'post',
          '-S',
          'bigtext',
          '-t',
          'Lời nhắc từ Giáo viên',
          'teacher_broadcast',
          cleanMsg,
        ]);
      }),
    );

    return {
      sent: true,
      affectedDevices: activeDevices.length,
    };
  }

  /**
   * Continuous 2-second watchdog that enforces Screen Lock, Kiosk App Pinning, and Blocked Apps
   */
  private async runWatchdogCycle(): Promise<void> {
    if (this.isWatchdogRunning) return;
    this.isWatchdogRunning = true;

    try {
      await this.refreshDevices();
      const activeDevices = Array.from(this.connectedDevices.values()).filter(
        (d) => d.status === 'device',
      );

      for (const dev of activeDevices) {
        // 1. Inspect window & power state in a single fast shell call
        const stateRes = await this.execAdb(
          [
            '-s',
            dev.serial,
            'shell',
            'dumpsys window displays | grep -E "mCurrentFocus|mFocusedApp"; dumpsys power | grep "mWakefulness="',
          ],
          2500,
        );

        if (!stateRes.ok) continue;
        const output = stateRes.stdout;

        const isAwake = output.includes('mWakefulness=Awake');
        dev.isScreenAwake = isAwake;

        // Extract current foreground package
        let fgPkg: string | undefined;
        const focusMatch =
          output.match(/mCurrentFocus=Window\{[^\}]*\s+([a-zA-Z0-9_.]+)\//) ||
          output.match(/mFocusedApp=ActivityRecord\{[^\}]*\s+([a-zA-Z0-9_.]+)\//);
        if (focusMatch && focusMatch[1]) {
          fgPkg = focusMatch[1];
          dev.foregroundPackage = fgPkg;
        }

        // ENFORCEMENT 1: Classroom Screen Lock
        if (this.isClassroomLocked) {
          if (isAwake) {
            await this.execAdb(['-s', dev.serial, 'shell', 'cmd', 'statusbar', 'collapse']);
            await this.execAdb(['-s', dev.serial, 'shell', 'input', 'keyevent', '223']);
            dev.isScreenAwake = false;
          }
          continue;
        }

        // ENFORCEMENT 2: Active Kiosk App Pinning
        if (this.activeKioskPackage) {
          if (!isAwake) {
            await this.execAdb(['-s', dev.serial, 'shell', 'input', 'keyevent', '224']);
            await this.execAdb(['-s', dev.serial, 'shell', 'wm', 'dismiss-keyguard']);
          }
          if (
            fgPkg &&
            fgPkg !== this.activeKioskPackage &&
            !fgPkg.includes('permissioncontroller') &&
            !fgPkg.includes('systemui')
          ) {
            await this.execAdb(['-s', dev.serial, 'shell', 'cmd', 'statusbar', 'collapse']);
            await this.launchAppOnDevice(dev.serial, this.activeKioskPackage);
          }
          continue;
        }

        // ENFORCEMENT 3: Blocked Apps in Multi-App Mode
        if (fgPkg && this.blockedPackages.has(fgPkg)) {
          if (fgPkg === 'com.android.settings' && Date.now() < this.settingsGraceUntil) {
            continue;
          }
          // Return tablet immediately to Home screen
          await this.execAdb(['-s', dev.serial, 'shell', 'input', 'keyevent', '3']);
          if (fgPkg !== 'com.android.settings') {
            await this.execAdb(['-s', dev.serial, 'shell', 'am', 'force-stop', fgPkg]);
            await this.execAdb([
              '-s',
              dev.serial,
              'shell',
              'cmd',
              'package',
              'suspend',
              fgPkg,
            ]);
          }
        }
      }
    } catch {
      // Ignore transient watchdog errors
    } finally {
      this.isWatchdogRunning = false;
    }
  }

  /**
   * Periodically reads real battery level from connected tablets
   */
  async syncDeviceTelemetry(): Promise<void> {
    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );

    for (const dev of activeDevices) {
      const batRes = await this.execAdb(['-s', dev.serial, 'shell', 'dumpsys', 'battery'], 3000);
      if (batRes.ok) {
        const levelMatch = batRes.stdout.match(/level:\s*([0-9]+)/);
        if (levelMatch && levelMatch[1]) {
          dev.batteryLevel = parseInt(levelMatch[1], 10);
        }
      }
    }
  }
}
