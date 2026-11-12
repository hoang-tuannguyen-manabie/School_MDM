import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
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
  private timerGraceUntil = 0;

  // Chrome / Web browsing restriction states
  private chromeRestrictionsEnabled = false;
  private chromeBlockNewTabs = true;
  private chromeAllowedUrls: string[] = [
    'quizizz.com',
    'kahoot.it',
    'forms.google.com',
    'canva.com',
    'manabie.com',
    'khanacademy.org',
  ];
  private activeLessonUrl: string | null = null;
  private chromeKioskMode = false;

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
  private readonly knownIpPorts = new Map<string, string>([
    ['192.168.20.32', '5555'],
    ['192.168.1.28', '5555'],
  ]);
  private readonly knownPortsCachePath: string;

  constructor() {
    this.adbPath = this.resolveAdbBinaryPath();
    this.knownPortsCachePath = path.resolve(path.dirname(this.adbPath), 'adb-known-ports.json');
    this.loadKnownPortsFromDisk();
  }

  /**
   * Identifies file upload pickers, media selectors, and system intent dialogs
   * that students need to upload or attach files during lessons (e.g. Scratch project files,
   * Canva images, forms, documents). When active, MDM will not force-reload or jump back to Chrome.
   */
  isFileUploadOrSystemPackage(pkg: string | undefined): boolean {
    if (!pkg) return false;
    const lower = pkg.toLowerCase();

    // Standard Android DocumentsUI & File Pickers
    if (
      lower === 'com.android.documentsui' ||
      lower === 'com.google.android.documentsui' ||
      lower === 'com.google.android.apps.nbu.files' ||
      lower === 'com.android.filemanager' ||
      lower === 'com.sprd.fileexplorer'
    ) {
      return true;
    }

    // Photo / Media Pickers & Downloads UI
    if (
      lower === 'com.android.photopicker' ||
      lower === 'com.google.android.providers.media.module' ||
      lower === 'com.android.providers.media.module' ||
      lower === 'com.android.providers.media' ||
      lower === 'com.sprd.providers.photos' ||
      lower === 'com.android.gallery3d' ||
      lower === 'com.google.android.apps.photos' ||
      lower === 'com.android.providers.downloads.ui' ||
      lower === 'com.android.providers.downloads' ||
      lower === 'com.android.externalstorage' ||
      lower === 'com.android.storagemanager'
    ) {
      return true;
    }

    // System Intent Resolver / App Chooser dialogs ("Mở bằng...", "Hoàn tất bằng...")
    if (lower === 'android') {
      return true;
    }

    // Runtime Permission Prompts ("Cho phép ứng dụng truy cập tệp...")
    if (
      lower.includes('permissioncontroller') ||
      lower.includes('packageinstaller') ||
      lower.includes('systemui')
    ) {
      return true;
    }

    // Camera for direct photo capture / file upload
    if (lower === 'com.android.camera2' || lower === 'com.android.camera') {
      return true;
    }

    // Generic file picker keywords
    if (lower.includes('picker') || lower.includes('document')) {
      return true;
    }

    return false;
  }

  private loadKnownPortsFromDisk() {
    try {
      if (fs.existsSync(this.knownPortsCachePath)) {
        const raw = JSON.parse(fs.readFileSync(this.knownPortsCachePath, 'utf8')) as Record<string, string>;
        for (const [ip, port] of Object.entries(raw)) {
          if (ip && port) this.knownIpPorts.set(ip, port);
        }
      }
    } catch {
      // Ignore cache read errors
    }
  }

  private saveKnownPort(ip: string, port: string) {
    this.knownIpPorts.set(ip, port);
    try {
      const obj = Object.fromEntries(this.knownIpPorts.entries());
      fs.writeFileSync(this.knownPortsCachePath, JSON.stringify(obj, null, 2), 'utf8');
    } catch {
      // Ignore cache write errors
    }
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
    }, 1000);

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
        if (line.includes('_adb-tls-connect._tcp') || line.includes('_adb._tcp')) {
          const match = line.match(/([0-9]{1,3}(?:\.[0-9]{1,3}){3}):([0-9]{2,5})/);
          if (match) {
            const ip = match[1];
            const port = match[2];
            this.saveKnownPort(ip, port);
            await this.execAdb(['connect', `${ip}:${port}`], 3000);
          }
        }
      }
    }

    // Also try reconnecting to any saved IP:port if not currently connected (e.g., when tablet screen is asleep and mDNS is paused)
    if (this.connectedDevices.size === 0) {
      for (const [ip, port] of this.knownIpPorts.entries()) {
        await this.execAdb(['connect', `${ip}:${port}`], 2500);
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
   * Queries the connected physical tablet via ADB for all user-launchable applications
   * (activities with ACTION_MAIN + CATEGORY_LAUNCHER) and their versionCodes.
   */
  async getInstalledTabletPackages(): Promise<{
    connected: boolean;
    serial: string | null;
    packages: Array<{ packageName: string; versionCode: number }>;
  }> {
    await this.refreshDevices();
    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );
    const targetDevice =
      activeDevices.find((d) => d.ipAddress || /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/.test(d.serial)) ??
      activeDevices[0];

    if (!targetDevice) {
      return { connected: false, serial: null, packages: [] };
    }

    const [launcherRes, versionRes] = await Promise.all([
      this.execAdb(
        [
          '-s',
          targetDevice.serial,
          'shell',
          'cmd package query-activities --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER',
        ],
        5000,
      ),
      this.execAdb(
        ['-s', targetDevice.serial, 'shell', 'pm list packages --show-versioncode'],
        5000,
      ),
    ]);

    if (!launcherRes.ok || !launcherRes.stdout) {
      return { connected: true, serial: targetDevice.serial, packages: [] };
    }

    const versionMap = new Map<string, number>();
    if (versionRes.ok && versionRes.stdout) {
      for (const line of versionRes.stdout.split(/\r?\n/)) {
        const m = line.match(/package:([^\s]+)\s+versionCode:([0-9]+)/);
        if (m && m[1] && m[2]) {
          versionMap.set(m[1], parseInt(m[2], 10));
        }
      }
    }

    const seenPackages = new Set<string>();
    const packages: Array<{ packageName: string; versionCode: number }> = [];

    for (const rawLine of launcherRes.stdout.split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      const match = trimmed.match(/^([a-zA-Z0-9_.]+)\/([^\s]+)$/);
      if (match && match[1]) {
        const pkg = match[1];
        if (pkg === 'com.android.launcher3') continue;
        if (!seenPackages.has(pkg)) {
          seenPackages.add(pkg);
          packages.push({
            packageName: pkg,
            versionCode: versionMap.get(pkg) ?? 1,
          });
        }
      }
    }

    return {
      connected: true,
      serial: targetDevice.serial,
      packages,
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
    const ipDevice = activeDevices.find((d) =>
      /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/.test(d.serial),
    );
    const targetDevices = ipDevice ? [ipDevice] : activeDevices.slice(0, 1);
    await Promise.all(
      targetDevices.map((dev) => this.applyPackagePoliciesOnDevice(dev.serial)),
    );
  }

  private async applyPackagePoliciesOnDevice(serial: string): Promise<void> {
    const allManagedPackages = new Set([
      ...this.approvedPackages,
      ...this.blockedPackages,
    ]);

    const toUnsuspend: string[] = [];
    const toSuspend: string[] = [];

    for (const pkg of allManagedPackages) {
      // Do not OS-suspend com.android.settings or launcher (Watchdog handles Settings via Home redirect)
      if (pkg === 'com.android.settings' || pkg === 'com.android.launcher3') continue;

      // Always allow com.google.android.deskclock (Clock) to run in parallel alongside any Kiosk app
      const shouldAllow = this.activeKioskPackage
        ? pkg === this.activeKioskPackage || pkg === 'com.google.android.deskclock'
        : this.approvedPackages.has(pkg);

      if (shouldAllow) {
        toUnsuspend.push(pkg);
      } else {
        toSuspend.push(pkg);
      }
    }

    const shellCommands: string[] = [];
    if (toUnsuspend.length > 0) {
      shellCommands.push(`cmd package unsuspend ${toUnsuspend.join(' ')}`);
    }
    if (toSuspend.length > 0) {
      shellCommands.push(`cmd package suspend ${toSuspend.join(' ')}`);
    }

    if (shellCommands.length > 0) {
      await this.execAdb(['-s', serial, 'shell', shellCommands.join('; ')], 8000);
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
   * Runs a parallel classroom activity countdown timer on all connected tablets
   * alongside whatever app (Canva, ChatGPT, Sheets, Chrome) is currently active.
   */
  async dispatchClassroomTimerEvent(params: {
    action: 'START' | 'PAUSE' | 'RESUME' | 'ADD_MINUTE' | 'UPDATE' | 'EXPIRE' | 'CANCEL';
    title: string;
    remainingSeconds?: number;
    autoLockOnExpire?: boolean;
    openClockAppOnTablet?: boolean;
  }): Promise<{
    ok: boolean;
    affectedDevices: number;
    locked?: boolean;
  }> {
    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );
    const ipDevice = activeDevices.find((d) =>
      /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/.test(d.serial),
    );
    const targetDevices = ipDevice ? [ipDevice] : activeDevices.slice(0, 1);

    const cleanTitle = (params.title || 'Hoạt động trên lớp').replace(/["`$]/g, '').trim();
    const secs = Math.max(0, Math.floor(params.remainingSeconds ?? 0));
    const mm = String(Math.floor(secs / 60)).padStart(2, '0');
    const ss = String(secs % 60).padStart(2, '0');

    await Promise.all(
      targetDevices.map(async (dev) => {
        // Ensure Clock app is never suspended so it can run in parallel
        await this.execAdb([
          '-s',
          dev.serial,
          'shell',
          'cmd package unsuspend com.google.android.deskclock',
        ]);

        if (params.action === 'START') {
          this.timerGraceUntil = Date.now() + 4500;
          await this.execAdb(['-s', dev.serial, 'shell', 'input', 'keyevent', '224']);
          // Clear any old timers first so there is NEVER more than 1 timer, then start & display in floating window
          if (secs > 0) {
            await this.execAdb(
              [
                '-s',
                dev.serial,
                'shell',
                [
                  'settings put global enable_freeform_support 1',
                  'settings put global force_resizable_activities 1',
                  'pm clear com.google.android.deskclock',
                  'sleep 0.4',
                  `am start -n com.google.android.deskclock/com.android.deskclock.HandleSetApiCalls -a android.intent.action.SET_TIMER --ei android.intent.extra.alarm.LENGTH ${secs} --es android.intent.extra.alarm.MESSAGE "${cleanTitle}" --ez android.intent.extra.alarm.SKIP_UI false`,
                  'sleep 0.6',
                  'am start --windowingMode 5 -n com.google.android.deskclock/com.android.deskclock.HandleApiCalls -a android.intent.action.SHOW_TIMERS',
                  'am start --windowingMode 5 -n com.google.android.deskclock/com.android.deskclock.DeskClock',
                ].join('; '),
              ],
              8000,
            );
          }
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
            `⏱️ Đang đếm ngược: ${cleanTitle} (${mm}:${ss})`,
            'classroom_timer',
            `Thời gian hoạt động: ${mm}:${ss}. Đồng hồ đang hiển thị song song trên màn hình.`,
          ]);
        } else if (params.action === 'PAUSE') {
          this.timerGraceUntil = Date.now() + 3000;
          await this.execAdb(
            [
              '-s',
              dev.serial,
              'shell',
              [
                'am start --windowingMode 5 -n com.google.android.deskclock/com.android.deskclock.DeskClock',
                'sleep 0.3',
                'input tap 684 415',
              ].join('; '),
            ],
            5000,
          );
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
            `⏸️ Tạm dừng đếm ngược: ${cleanTitle} (${mm}:${ss})`,
            'classroom_timer',
            `Giáo viên đang tạm dừng đồng hồ tại ${mm}:${ss}.`,
          ]);
        } else if (params.action === 'RESUME') {
          this.timerGraceUntil = Date.now() + 3000;
          await this.execAdb(
            [
              '-s',
              dev.serial,
              'shell',
              [
                'am start --windowingMode 5 -n com.google.android.deskclock/com.android.deskclock.DeskClock',
                'sleep 0.3',
                'input tap 684 415',
              ].join('; '),
            ],
            5000,
          );
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
            `▶️ Tiếp tục đếm ngược: ${cleanTitle} (${mm}:${ss})`,
            'classroom_timer',
            `Đồng hồ tiếp tục đếm ngược từ ${mm}:${ss}.`,
          ]);
        } else if (params.action === 'ADD_MINUTE') {
          this.timerGraceUntil = Date.now() + 3000;
          await this.execAdb(
            [
              '-s',
              dev.serial,
              'shell',
              [
                'am start --windowingMode 5 -n com.google.android.deskclock/com.android.deskclock.DeskClock',
                'sleep 0.3',
                'input tap 595 415',
              ].join('; '),
            ],
            5000,
          );
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
            `➕ Đã cộng +1 phút: ${cleanTitle} (${mm}:${ss})`,
            'classroom_timer',
            `Thời gian hoạt động hiện tại: ${mm}:${ss}.`,
          ]);
        } else if (params.action === 'CANCEL') {
          this.timerGraceUntil = Date.now() + 2500;
          await this.execAdb([
            '-s',
            dev.serial,
            'shell',
            'pm clear com.google.android.deskclock; am force-stop com.google.android.deskclock',
          ]);
        } else if (params.action === 'UPDATE') {
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
            `⏱️ Còn ${mm}:${ss} — ${cleanTitle}`,
            'classroom_timer',
            `Thời gian còn lại cho hoạt động [${cleanTitle}]: ${mm}:${ss}`,
          ]);
        } else if (params.action === 'EXPIRE') {
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
            `⏰ ĐÃ HẾT GIỜ: ${cleanTitle}`,
            'classroom_timer',
            `Đã hết thời gian cho hoạt động [${cleanTitle}]. Các em dừng thao tác trên máy tính bảng!`,
          ]);
        }
      }),
    );

    if (params.action === 'EXPIRE' && params.autoLockOnExpire) {
      await this.setClassroomLock(true);
      return {
        ok: true,
        affectedDevices: targetDevices.length,
        locked: true,
      };
    }

    return {
      ok: true,
      affectedDevices: targetDevices.length,
      locked: this.isClassroomLocked,
    };
  }

  getChromeRestrictions() {
    return {
      enabled: this.chromeRestrictionsEnabled,
      blockNewTabs: this.chromeBlockNewTabs,
      allowedUrls: this.chromeAllowedUrls,
      activeLessonUrl: this.activeLessonUrl,
      kioskMode: this.chromeKioskMode,
    };
  }

  async setChromeRestrictions(params: {
    enabled?: boolean;
    blockNewTabs?: boolean;
    allowedUrls?: string[];
    activeLessonUrl?: string | null;
    kioskMode?: boolean;
  }) {
    if (params.enabled !== undefined) this.chromeRestrictionsEnabled = params.enabled;
    if (params.blockNewTabs !== undefined) this.chromeBlockNewTabs = params.blockNewTabs;
    if (params.allowedUrls) {
      this.chromeAllowedUrls = params.allowedUrls
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean);
    }
    if (params.activeLessonUrl !== undefined) this.activeLessonUrl = params.activeLessonUrl;
    if (params.kioskMode !== undefined) this.chromeKioskMode = params.kioskMode;

    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );

    await Promise.all(
      activeDevices.map(async (dev) => {
        if (this.chromeRestrictionsEnabled) {
          await this.execAdb([
            '-s',
            dev.serial,
            'shell',
            'echo "chrome --disable-fre --no-default-browser-check --disable-new-tab-first-run" > /data/local/tmp/chrome-command-line; chmod 777 /data/local/tmp/chrome-command-line',
          ]);
          await this.execAdb([
            '-s',
            dev.serial,
            'shell',
            'cmd notification post -S bigtext -t "🔒 Đang kích hoạt Chế độ Duyệt Web An toàn" chrome_policy "Hệ thống đang khóa mở Tab mới & chỉ cho phép các trang web học tập do giáo viên chỉ định."',
          ]);
          // Enforce immediately
          await this.enforceChromeRestrictionsOnDevice(dev.serial);
        } else {
          await this.execAdb([
            '-s',
            dev.serial,
            'shell',
            'rm -f /data/local/tmp/chrome-command-line',
          ]);
          await this.execAdb([
            '-s',
            dev.serial,
            'shell',
            'cmd notification post -S bigtext -t "🔓 Đã mở khóa duyệt web" chrome_policy "Giáo viên đã mở khóa duyệt web thông thường."',
          ]);
        }
      }),
    );

    return this.getChromeRestrictions();
  }

  async launchLessonWebPage(params: {
    url: string;
    kioskMode?: boolean;
    title?: string;
  }) {
    let cleanUrl = params.url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    this.activeLessonUrl = cleanUrl;
    this.chromeRestrictionsEnabled = true;
    this.chromeBlockNewTabs = true;
    this.chromeKioskMode = Boolean(params.kioskMode);

    if (this.chromeKioskMode) {
      this.activeKioskPackage = 'com.android.chrome';
    }

    try {
      const parsed = new URL(cleanUrl);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
      if (host && !this.chromeAllowedUrls.includes(host)) {
        this.chromeAllowedUrls.push(host);
      }
    } catch {
      // Ignore URL parse error
    }

    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );

    await Promise.all(
      activeDevices.map(async (dev) => {
        await this.execAdb([
          '-s',
          dev.serial,
          'shell',
          'cmd package unsuspend com.android.chrome',
        ]);
        await this.execAdb([
          '-s',
          dev.serial,
          'shell',
          'input keyevent 224; wm dismiss-keyguard; cmd statusbar collapse',
        ]);
        await this.execAdb([
          '-s',
          dev.serial,
          'shell',
          `echo "chrome --app=\\"${cleanUrl}\\" --disable-fre --no-default-browser-check" > /data/local/tmp/chrome-command-line; chmod 777 /data/local/tmp/chrome-command-line`,
        ]);
        await this.execAdb([
          '-s',
          dev.serial,
          'shell',
          `am start -a android.intent.action.VIEW -d "${cleanUrl}" -n com.android.chrome/com.google.android.apps.chrome.Main --ez org.chromium.chrome.browser.customtabs.EXTRA_INCOGNITO false`,
        ]);
        const pageTitle = params.title || cleanUrl;
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
          '📖 Bài học trực tuyến từ Giáo viên',
          'lesson_web',
          `Đã mở bài tập: ${pageTitle}. Đang áp dụng Chế độ Khóa Duyệt Web An Toàn.`,
        ]);
        // Enforce CDP restrictions on the newly launched page
        setTimeout(() => {
          void this.enforceChromeRestrictionsOnDevice(dev.serial);
        }, 800);
      }),
    );

    return {
      success: true,
      url: cleanUrl,
      kioskMode: this.chromeKioskMode,
      affectedDevices: activeDevices.length,
    };
  }

  async closeLessonWebPage() {
    this.activeLessonUrl = null;
    this.chromeKioskMode = false;
    if (this.activeKioskPackage === 'com.android.chrome') {
      this.activeKioskPackage = null;
    }

    const activeDevices = Array.from(this.connectedDevices.values()).filter(
      (d) => d.status === 'device',
    );

    await Promise.all(
      activeDevices.map(async (dev) => {
        await this.execAdb([
          '-s',
          dev.serial,
          'shell',
          'rm -f /data/local/tmp/chrome-command-line',
        ]);
        await this.execAdb([
          '-s',
          dev.serial,
          'shell',
          'cmd notification post -S bigtext -t "⏹️ Đã hoàn thành bài học web" lesson_web "Giáo viên đã kết thúc bài học trên web."',
        ]);
      }),
    );

    return {
      success: true,
      affectedDevices: activeDevices.length,
    };
  }

  /**
   * Continuous 2-second watchdog that enforces Screen Lock, Kiosk App Pinning, and Blocked Apps
   */
  private async runWatchdogCycle(): Promise<void> {
    if (this.isWatchdogRunning) return;
    if (Date.now() < this.timerGraceUntil) return;
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

          const isAllowedCompanion =
            fgPkg === this.activeKioskPackage ||
            fgPkg === 'com.google.android.deskclock' ||
            this.isFileUploadOrSystemPackage(fgPkg);

          if (fgPkg && !isAllowedCompanion) {
            await this.execAdb(['-s', dev.serial, 'shell', 'cmd', 'statusbar', 'collapse']);
            if (this.activeKioskPackage === 'com.android.chrome' && this.activeLessonUrl) {
              await this.execAdb([
                '-s',
                dev.serial,
                'shell',
                `am start -a android.intent.action.VIEW -d "${this.activeLessonUrl}" -n com.android.chrome/com.google.android.apps.chrome.Main --ez org.chromium.chrome.browser.customtabs.EXTRA_INCOGNITO false`,
              ]);
            } else {
              await this.launchAppOnDevice(dev.serial, this.activeKioskPackage);
            }
          } else if (
            fgPkg === 'com.android.chrome' &&
            (this.chromeRestrictionsEnabled || this.chromeBlockNewTabs)
          ) {
            await this.enforceChromeRestrictionsOnDevice(dev.serial);
          }
          continue;
        }

        // ENFORCEMENT 3: Blocked Apps in Multi-App Mode & Google Search Lock
        const isSearchAppBlocked =
          (this.chromeRestrictionsEnabled || this.chromeBlockNewTabs) &&
          (fgPkg === 'com.google.android.googlequicksearchbox' || fgPkg === 'com.android.vending');

        if (
          fgPkg &&
          !this.isFileUploadOrSystemPackage(fgPkg) &&
          (this.blockedPackages.has(fgPkg) || isSearchAppBlocked)
        ) {
          if (fgPkg === 'com.android.settings' && Date.now() < this.settingsGraceUntil) {
            continue;
          }
          // Return tablet immediately to Home screen
          await this.execAdb(['-s', dev.serial, 'shell', 'input keyevent 4; input keyevent 3']);
          if (fgPkg !== 'com.android.settings') {
            await this.execAdb(['-s', dev.serial, 'shell', 'am', 'force-stop', fgPkg]);
            if (!isSearchAppBlocked) {
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
          if (isSearchAppBlocked && this.activeLessonUrl) {
            await this.execAdb([
              '-s',
              dev.serial,
              'shell',
              `am start -a android.intent.action.VIEW -d "${this.activeLessonUrl}" -n com.android.chrome/com.google.android.apps.chrome.Main --ez org.chromium.chrome.browser.customtabs.EXTRA_INCOGNITO false`,
            ]);
          }
        }

        // ENFORCEMENT 4: Chrome Tab & Search Lock Enforcement
        if (
          fgPkg === 'com.android.chrome' &&
          (this.chromeRestrictionsEnabled || this.chromeBlockNewTabs)
        ) {
          await this.enforceChromeRestrictionsOnDevice(dev.serial);
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

  private fetchCdpJson<T>(url: string, timeoutMs = 800): Promise<T | null> {
    return new Promise((resolve) => {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as T);
          } catch {
            resolve(null);
          }
        });
      });
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  private callCdpEndpoint(url: string, timeoutMs = 800): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(url, { timeout: timeoutMs }, (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private async ensureChromeDevToolsForwarded(serial: string): Promise<boolean> {
    try {
      const res = await this.execAdb(
        ['-s', serial, 'forward', 'tcp:9222', 'localabstract:chrome_devtools_remote'],
        2000,
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  private async enforceChromeRestrictionsOnDevice(serial: string): Promise<void> {
    try {
      // 1. Query open Chrome tabs via DevTools Protocol
      await this.ensureChromeDevToolsForwarded(serial);
      interface CdpTab {
        id: string;
        title: string;
        url: string;
        type: string;
      }
      const tabs = await this.fetchCdpJson<CdpTab[]>('http://127.0.0.1:9222/json/list', 1000);
      if (!tabs || !Array.isArray(tabs)) return;

      const pageTabs = tabs.filter((t) => t.type === 'page');

      // Determine allowed criteria
      let lessonDomain = '';
      if (this.activeLessonUrl) {
        try {
          lessonDomain = new URL(this.activeLessonUrl).hostname.replace(/^www\./, '').toLowerCase();
        } catch {}
      }

      let activeApprovedTabId: string | null = null;
      const tabsToClose: string[] = [];
      let currentTabNeedsRedirect = false;

      for (const tab of pageTabs) {
        const rawUrl = (tab.url || '').toLowerCase();
        let tabHost = '';
        try {
          tabHost = new URL(rawUrl).hostname.replace(/^www\./, '').toLowerCase();
        } catch {}

        const isSchoolMdmConnect =
          rawUrl.includes('/connect') ||
          tabHost === 'localhost' ||
          tabHost === '127.0.0.1' ||
          tabHost.startsWith('192.168.') ||
          tabHost.startsWith('10.');

        if (isSchoolMdmConnect) {
          activeApprovedTabId = tab.id;
          continue;
        }

        const isNewTab =
          rawUrl.startsWith('chrome-native://') ||
          rawUrl.startsWith('chrome://') ||
          rawUrl === 'about:blank' ||
          rawUrl.includes('google.com/search') ||
          rawUrl === 'https://www.google.com/' ||
          rawUrl === 'http://www.google.com/';

        if (this.activeLessonUrl && lessonDomain) {
          const isLessonMatch =
            tabHost === lessonDomain ||
            rawUrl.includes(lessonDomain) ||
            this.chromeAllowedUrls.some(
              (allowed) => tabHost.includes(allowed) || allowed.includes(tabHost),
            );

          if (isLessonMatch && !isNewTab) {
            activeApprovedTabId = tab.id;
          } else {
            if (pageTabs.length > 1) {
              tabsToClose.push(tab.id);
            } else {
              currentTabNeedsRedirect = true;
            }
          }
        } else {
          // No single active lesson, but restrictions or blockNewTabs active
          if (this.chromeBlockNewTabs && isNewTab) {
            if (pageTabs.length > 1) {
              tabsToClose.push(tab.id);
            }
          } else if (this.chromeAllowedUrls.length > 0 && tabHost) {
            const isAllowed = this.chromeAllowedUrls.some(
              (allowed) => tabHost.includes(allowed) || allowed.includes(tabHost),
            );
            if (!isAllowed) {
              if (pageTabs.length > 1) {
                tabsToClose.push(tab.id);
              }
            } else if (!activeApprovedTabId) {
              activeApprovedTabId = tab.id;
            }
          }
        }
      }

      // Close all unallowed tabs
      for (const tabId of tabsToClose) {
        await this.callCdpEndpoint(`http://127.0.0.1:9222/json/close/${tabId}`);
      }

      // If we closed tabs or student opened switcher, bring the approved tab back to front
      if (activeApprovedTabId && tabsToClose.length > 0) {
        await this.callCdpEndpoint(`http://127.0.0.1:9222/json/activate/${activeApprovedTabId}`);
      } else if (currentTabNeedsRedirect && this.activeLessonUrl) {
        // Current sole tab navigated away to Google or unauthorized site -> redirect back to lesson
        await this.execAdb(
          [
            '-s',
            serial,
            'shell',
            `am start -a android.intent.action.VIEW -d "${this.activeLessonUrl}" -n com.android.chrome/com.google.android.apps.chrome.Main --ez org.chromium.chrome.browser.customtabs.EXTRA_INCOGNITO false`,
          ],
          3000,
        );
      }
    } catch {
      // Ignore transient Chrome CDP inspection errors
    }
  }
}
