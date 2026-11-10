import React from 'react';

export interface AdbStatusData {
  adbConnected: boolean;
  unauthorizedPromptPending: boolean;
  adbSerial: string | null;
  batteryLevel: number | null;
  foregroundPackage: string | null;
  isScreenAwake: boolean | null;
  isClassroomLocked: boolean;
  activeKioskPackage: string | null;
  connectedCount: number;
}

export function HardwareControlBanner(_props: {
  defaultIp?: string;
  onStatusChange?: (status: AdbStatusData) => void;
}): React.ReactElement | null {
  // Removed per user request so the interface remains clean and unobstructed
  return null;
}
