import React from 'react';

export interface AppDeviceIconProps {
  packageName?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 min-w-5 min-h-5',
  sm: 'w-7 h-7 min-w-7 min-h-7',
  md: 'w-10 h-10 min-w-10 min-h-10',
  lg: 'w-12 h-12 min-w-12 min-h-12',
  xl: 'w-16 h-16 min-w-16 min-h-16',
};

// 1. Authentic Canva Icon (Matching Teclast P30 Taskbar)
export function CanvaIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Canva">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="canva-gradient-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00C4CC" />
            <stop offset="48%" stopColor="#0072B2" />
            <stop offset="100%" stopColor="#7D2AE8" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="23" fill="url(#canva-gradient-bg)" />
        {/* Authentic Canva Script Wordmark */}
        <g transform="translate(6, 6) scale(1.5)">
          <path
            fill="#FFFFFF"
            fillRule="evenodd"
            d="M6.962 7.68c.754 0 1.337.549 1.405 1.2c.069.583-.171 1.097-.822 1.406c-.343.171-.48.172-.549.069c-.034-.069 0-.137.069-.206c.617-.514.617-.926.548-1.508c-.034-.378-.308-.618-.583-.618c-1.2 0-2.914 2.674-2.674 4.629c.103.754.549 1.646 1.509 1.646c.308 0 .65-.103.96-.24c.5-.264.799-.47 1.097-.8c-.073-.885.704-2.046 1.851-2.046c.515 0 .926.205.96.583c.068.514-.377.582-.514.582s-.378-.034-.378-.17c-.034-.138.309-.07.275-.378c-.035-.206-.24-.274-.446-.274c-.72 0-1.131.994-1.029 1.611c.035.275.172.549.447.549c.205 0 .514-.31.617-.755c.068-.308.343-.514.583-.514c.102 0 .17.034.205.171v.138c-.034.137-.137.548-.102.651c0 .069.034.171.17.171c.092 0 .436-.18.777-.459c.117-.59.253-1.298.253-1.357c.034-.24.137-.48.617-.48c.103 0 .171.034.205.171v.138l-.136.617c.445-.583 1.097-.994 1.508-.994c.172 0 .309.102.309.274c0 .103 0 .274-.069.446c-.137.377-.309.96-.412 1.474c0 .137.035.274.207.274s.685-.206 1.096-.754l.007-.004c-.002-.068-.007-.134-.007-.202c0-.411.035-.754.104-.994c.068-.274.411-.514.617-.514c.103 0 .205.069.205.171c0 .035 0 .103-.034.137c-.137.446-.24.857-.24 1.269c0 .24.034.582.102.788c0 .034.035.069.07.069c.068 0 .548-.445.89-1.028c-.308-.206-.48-.549-.48-.96c0-.72.446-1.097.858-1.097c.343 0 .617.24.617.72c0 .308-.103.65-.274.96h.102a.77.77 0 0 0 .584-.24a.3.3 0 0 1 .134-.117c.335-.425.83-.74 1.41-.74c.48 0 .924.205.959.582c.068.515-.378.618-.515.618l-.002-.002c-.138 0-.377-.035-.377-.172s.309-.068.274-.376c-.034-.206-.24-.275-.446-.275c-.686 0-1.13.891-1.028 1.611c.034.275.171.583.445.583c.206 0 .515-.31.618-.755c.068-.308.342-.514.582-.514c.103 0 .172.034.206.171v.138c-.035.137-.137.548-.103.651c0 .069.035.171.172.171c.068 0 .342-.103.616-.308c.515-.412 1.029-.926 1.029-1.612c0-1.2-1.372-2.15-2.949-2.15c-1.371 0-2.468.618-3.085 1.543c-.48-.925-1.509-1.543-2.915-1.543c-1.474 0-2.605.652-3.256 1.646c-.309.48-.48 1.029-.515 1.578c-.891-.995-2.091-1.646-3.6-1.646c-1.577 0-2.982.96-3.462 2.332c-.343.96-.309 1.989.103 2.949c.549 1.269 1.646 2.092 3.12 2.092c1.337 0 2.365-.618 2.879-1.577c.309.205.652.377.96.514c.686.309 1.474.48 2.228.48c2.949 0 4.697-2.057 4.697-4.731c0-1.68-.857-3.086-2.228-3.669c-.789-.343-1.68-.48-2.606-.48c-.685 0-1.371.069-2.057.24C7.822 8.366 7.41 7.68 6.962 7.68m.72 6.754c-.652 0-1.166-.48-1.337-1.166c-.138-.617.068-1.337.583-1.68c.24-.172.583-.24.925-.24c.755 0 1.44 0 1.92.343c.343.24.549.617.549 1.029c0 .891-.891 1.714-2.65 1.714"
          />
        </g>
      </svg>
    </div>
  );
}

// 2. Authentic ChatGPT Icon (Matching Teclast P30 Taskbar)
export function ChatGPTIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="ChatGPT">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <g transform="translate(9, 9) scale(1.25)">
          <path
            fill="#101828"
            d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1683a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4947zm-9.6647-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1448-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1683a.0757.0757 0 0 1-.071 0l-4.8303-2.7866A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1635a.0804.0804 0 0 1-.038-.0567V6.0748a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.4598a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"
          />
        </g>
      </svg>
    </div>
  );
}

// 3. Authentic Google Chrome Icon (Matching Teclast P30 Taskbar)
export function ChromeIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Chrome">
      <svg viewBox="0 0 190.5 190.5" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <path fill="#FFFFFF" d="M95.252 142.873c26.304 0 47.627-21.324 47.627-47.628s-21.323-47.628-47.627-47.628-47.627 21.324-47.627 47.628 21.323 47.628 47.627 47.628z"/>
        <path fill="#229342" d="m54.005 119.07-41.24-71.43a95.227 95.227 0 0 0-.003 95.25 95.234 95.234 0 0 0 82.496 47.61l41.24-71.43v-.011a47.613 47.613 0 0 1-17.428 17.443 47.62 47.62 0 0 1-47.632.007 47.62 47.62 0 0 1-17.433-17.437z"/>
        <path fill="#FBC116" d="m136.495 119.067-41.239 71.43a95.229 95.229 0 0 0 82.489-47.622A95.24 95.24 0 0 0 190.5 95.248a95.237 95.237 0 0 0-12.772-47.623H95.249l-.01.007a47.62 47.62 0 0 1 23.819 6.372 47.618 47.618 0 0 1 17.439 17.431 47.62 47.62 0 0 1-.001 47.633z"/>
        <path fill="#1A73E8" d="M95.252 132.961c20.824 0 37.705-16.881 37.705-37.706S116.076 57.55 95.252 57.55 57.547 74.431 57.547 95.255s16.881 37.706 37.705 37.706z"/>
        <path fill="#E33B2E" d="M95.252 47.628h82.479A95.237 95.237 0 0 0 142.87 12.76 95.23 95.23 0 0 0 95.245 0a95.222 95.222 0 0 0-47.623 12.767 95.23 95.23 0 0 0-34.856 34.872l41.24 71.43.011.006a47.62 47.62 0 0 1-.015-47.633 47.61 47.61 0 0 1 41.252-23.815z"/>
      </svg>
    </div>
  );
}

// 4. Authentic Camera Icon (Matching Teclast P30 Taskbar)
export function CameraIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Máy ảnh">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="cam-glass-bg" cx="40%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="35%" stopColor="#1D4ED8" />
            <stop offset="70%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </radialGradient>
          <linearGradient id="cam-rim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#334155" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="23" fill="url(#cam-rim)" />
        <circle cx="24" cy="24" r="17.5" fill="#1E293B" stroke="#64748B" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="14" fill="#0F172A" />
        <circle cx="24" cy="24" r="12" fill="url(#cam-glass-bg)" />
        <ellipse cx="20" cy="19" rx="4" ry="2.2" transform="rotate(-30 20 19)" fill="#FFFFFF" opacity="0.75" />
        <circle cx="28" cy="28" r="1.5" fill="#38BDF8" opacity="0.6" />
        <circle cx="24" cy="24" r="5" fill="#020617" opacity="0.85" />
      </svg>
    </div>
  );
}

// 5. Authentic Android Settings Icon (Matching Teclast P30 Taskbar)
export function SettingsIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Cài đặt hệ thống">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="settings-green-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="100%" stopColor="#16A34A" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="23" fill="url(#settings-green-grad)" />
        <path
          fill="#FFFFFF"
          d="M26.8 6.5l-.6 3.2a14.7 14.7 0 0 0-4.4 0l-.6-3.2a1.8 1.8 0 0 0-1.5-1.4l-3.3.6a1.8 1.8 0 0 0-1.3 1.3l-1.3 3a14.7 14.7 0 0 0-3.1 3.1l-3-1.3a1.8 1.8 0 0 0-1.8.3l-2.4 2.4a1.8 1.8 0 0 0-.3 1.8l1.3 3a14.7 14.7 0 0 0 0 4.4l-3.2.6a1.8 1.8 0 0 0-1.4 1.5l.6 3.3a1.8 1.8 0 0 0 1.3 1.3l3 1.3a14.7 14.7 0 0 0 3.1 3.1l-1.3 3a1.8 1.8 0 0 0 .3 1.8l2.4 2.4a1.8 1.8 0 0 0 1.8.3l3-1.3a14.7 14.7 0 0 0 4.4 0l.6 3.2a1.8 1.8 0 0 0 1.5 1.4l3.3-.6a1.8 1.8 0 0 0 1.3-1.3l1.3-3a14.7 14.7 0 0 0 3.1-3.1l3 1.3a1.8 1.8 0 0 0 1.8-.3l2.4-2.4a1.8 1.8 0 0 0 .3-1.8l-1.3-3a14.7 14.7 0 0 0 0-4.4l3.2-.6a1.8 1.8 0 0 0 1.4-1.5l-.6-3.3a1.8 1.8 0 0 0-1.3-1.3l-3-1.3a14.7 14.7 0 0 0-3.1-3.1l1.3-3a1.8 1.8 0 0 0-.3-1.8l-2.4-2.4a1.8 1.8 0 0 0-1.8-.3l-3 1.3a14.7 14.7 0 0 0-4.4 0l-.6-3.2a1.8 1.8 0 0 0-1.5-1.4l-3.3.6a1.8 1.8 0 0 0-1.3 1.3zM24 18a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"
        />
      </svg>
    </div>
  );
}

// 6. Authentic Google Calculator Icon
export function CalculatorIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Máy tính học sinh">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="calc-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
        <rect width="46" height="46" x="1" y="1" rx="14" fill="url(#calc-blue-grad)" />
        <path d="M16 11v10M11 16h10" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M27 16h10" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M12.5 30.5l7 7M19.5 30.5l-7 7" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M27 31.5h10M27 36.5h10" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 7. Authentic Files by Google Icon
export function FilesIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Quản lý Học liệu">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <rect width="46" height="46" x="1" y="1" rx="14" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M10 16a4 4 0 0 1 4-4h8l4 4h12a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V16z" fill="#4285F4" />
        <path d="M22 12h-8a4 4 0 0 0-4 4v2h12v-6z" fill="#EA4335" />
        <path d="M22 12l4 4h-4v-4z" fill="#FBBC05" />
        <path d="M38 20H10v14a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4V20z" fill="#34A853" opacity="0.9" />
        <path d="M14 26h14M14 30h8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" opacity="0.9" />
      </svg>
    </div>
  );
}

// 8. Authentic YouTube Icon
export function YouTubeIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="YouTube">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <rect width="46" height="46" x="1" y="1" rx="14" fill="#FF0000" />
        <path d="M19.5 15.5l13 8.5-13 8.5v-17z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// General App Icon Dispatcher matching exact packages on Teclast P30
export function AppDeviceIcon({
  packageName = '',
  name = '',
  size = 'md',
  className = '',
}: AppDeviceIconProps): React.ReactElement {
  const sizeClass = SIZE_MAP[size] ?? SIZE_MAP.md;
  const combinedClass = `${sizeClass} ${className}`;
  const lowerPkg = packageName.toLowerCase();
  const lowerName = name.toLowerCase();

  // 1. Canva
  if (lowerPkg.includes('canva') || lowerName.includes('canva')) {
    return <CanvaIcon className={combinedClass} />;
  }

  // 2. ChatGPT
  if (lowerPkg.includes('chatgpt') || lowerPkg.includes('openai') || lowerName.includes('chatgpt')) {
    return <ChatGPTIcon className={combinedClass} />;
  }

  // 3. Chrome
  if (lowerPkg.includes('chrome') || lowerName.includes('chrome')) {
    return <ChromeIcon className={combinedClass} />;
  }

  // 4. Camera
  if (lowerPkg.includes('camera') || lowerName.includes('máy ảnh') || lowerName.includes('camera')) {
    return <CameraIcon className={combinedClass} />;
  }

  // 5. Settings
  if (lowerPkg.includes('settings') || lowerName.includes('cài đặt')) {
    return <SettingsIcon className={combinedClass} />;
  }

  // 6. Calculator
  if (lowerPkg.includes('calculator') || lowerName.includes('máy tính')) {
    return <CalculatorIcon className={combinedClass} />;
  }

  // 7. Files
  if (lowerPkg.includes('files') || lowerName.includes('học liệu') || lowerName.includes('tệp')) {
    return <FilesIcon className={combinedClass} />;
  }

  // 8. YouTube
  if (lowerPkg.includes('youtube') || lowerName.includes('youtube')) {
    return <YouTubeIcon className={combinedClass} />;
  }

  // Generic fallback with clean Android adaptive icon styling
  return (
    <div
      className={`rounded-xl bg-slate-800 text-white font-bold flex items-center justify-center shadow-xs border border-slate-700 text-xs ${combinedClass}`}
      title={name || packageName}
    >
      {(name || packageName).slice(0, 2).toUpperCase()}
    </div>
  );
}
