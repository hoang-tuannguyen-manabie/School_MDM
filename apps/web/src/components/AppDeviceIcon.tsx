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

// 1. Canva (com.canva.editor)
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

// 2. ChatGPT (com.openai.chatgpt)
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

// 3. Google Gemini (com.google.android.apps.bard)
export function GeminiIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Gemini">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gemini-star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1C7EFF" />
            <stop offset="52%" stopColor="#A855F7" />
            <stop offset="100%" stopColor="#F43F5E" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path
          d="M24 8C24 16.8366 31.1634 24 40 24C31.1634 24 24 31.1634 24 40C24 31.1634 16.8366 24 8 24C16.8366 24 24 16.8366 24 8Z"
          fill="url(#gemini-star-grad)"
        />
      </svg>
    </div>
  );
}

// 4. Google Chrome (com.android.chrome)
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

// 5. Camera (com.android.camera2)
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

// 6. Settings (com.android.settings)
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

// 7. Calculator (com.android.calculator2)
export function CalculatorIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Máy tính">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#0284C7" />
        <path d="M16 13v8M12 17h8" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M28 17h8" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M13 29l6 6M19 29l-6 6" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="32" cy="28" r="1.5" fill="#FFFFFF" />
        <path d="M28 32h8" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="32" cy="36" r="1.5" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// 8. Files by Google (com.google.android.apps.nbu.files)
export function FilesIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Files by Google">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M11 17a3.5 3.5 0 0 1 3.5-3.5h7.5l3.5 3.5h11a3.5 3.5 0 0 1 3.5 3.5v13a3.5 3.5 0 0 1-3.5 3.5h-22A3.5 3.5 0 0 1 11 33.5V17z" fill="#4285F4" />
        <path d="M22 13.5h-7.5A3.5 3.5 0 0 0 11 17v2h11v-5.5z" fill="#EA4335" />
        <path d="M22 13.5l3.5 3.5H22v-3.5z" fill="#FBBC05" />
        <path d="M37 20.5H11v13a3.5 3.5 0 0 0 3.5 3.5h19a3.5 3.5 0 0 0 3.5-3.5v-13z" fill="#34A853" opacity="0.92" />
        <path d="M15 26h13M15 30h8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 9. YouTube (com.google.android.youtube)
export function YouTubeIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="YouTube">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <rect x="9" y="14" width="30" height="20" rx="6" fill="#FF0000" />
        <path d="M21 19.5l8.5 4.5-8.5 4.5v-9z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// 10. YouTube Kids (com.google.android.apps.youtube.kids)
export function YouTubeKidsIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="YouTube Kids">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <g transform="rotate(-7 24 24)">
          <rect x="9" y="14" width="30" height="20" rx="6" fill="#FF0000" stroke="#1E293B" strokeWidth="2" />
          <path d="M21 19l8 5-8 5v-10z" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  );
}

// 11. YouTube Music (com.google.android.apps.youtube.music)
export function YouTubeMusicIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="YouTube Music">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FF0000" />
        <circle cx="24" cy="24" r="11.5" fill="none" stroke="#FFFFFF" strokeWidth="2.2" />
        <path d="M21.5 19l8 5-8 5v-10z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// 12. Google Sheets (com.google.android.apps.docs.editors.sheets)
export function SheetsIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Trang tính">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M15 10h12l7 7v19a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" fill="#0F9D58" />
        <path d="M27 10l7 7h-5a2 2 0 0 1-2-2v-5z" fill="#87CEAC" />
        <rect x="17" y="21" width="14" height="11" rx="1" fill="none" stroke="#FFFFFF" strokeWidth="1.8" />
        <path d="M17 26.5h14M23.5 21v11" stroke="#FFFFFF" strokeWidth="1.8" />
      </svg>
    </div>
  );
}

// 13. Google Drive (com.google.android.apps.docs)
export function DriveIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Drive">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M20.5 12h7l10.5 18h-7L20.5 12z" fill="#FBBC04" />
        <path d="M10 30l10.5-18 3.5 6-10.5 18L10 30z" fill="#0F9D58" />
        <path d="M13.5 36h21l3.5-6h-21l-3.5 6z" fill="#4285F4" />
      </svg>
    </div>
  );
}

// 14. Google Keep (com.google.android.keep)
export function KeepIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Ghi chú Keep">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M15 10h12l7 7v19a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" fill="#FBBC04" />
        <path d="M27 10l7 7h-5a2 2 0 0 1-2-2v-5z" fill="#FDE293" />
        <path d="M24 19a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9z" fill="#FFFFFF" />
        <rect x="21.5" y="31.5" width="5" height="2" rx="1" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// 15. Google Play Books (com.google.android.apps.books)
export function PlayBooksIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Play Sách">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M14 11.5v25c0 1.4 1.5 2.2 2.7 1.5l20-12.5c1.1-.7 1.1-2.3 0-3l-20-12.5c-1.2-.7-2.7.1-2.7 1.5z" fill="#0284C7" />
        <path d="M19 13.5h7v12l-3.5-2.5L19 25.5v-12z" fill="#38BDF8" />
      </svg>
    </div>
  );
}

// 16. Google Calendar (com.google.android.calendar)
export function CalendarIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Lịch">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <rect x="12" y="12" width="24" height="24" rx="4" fill="#FFFFFF" stroke="#4285F4" strokeWidth="3.5" />
        <path d="M12 18h24" stroke="#EA4335" strokeWidth="3" />
        <text x="24" y="30" textAnchor="middle" fill="#1A73E8" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
          31
        </text>
      </svg>
    </div>
  );
}

// 17. Google Clock (com.google.android.deskclock)
export function ClockIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Đồng hồ">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#1A73E8" />
        <circle cx="24" cy="24" r="16" fill="#E8F0FE" />
        <path d="M24 14v10l6 4" stroke="#1A73E8" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <circle cx="24" cy="24" r="2" fill="#1A73E8" />
      </svg>
    </div>
  );
}

// 18. Sound Recorder (com.android.soundrecorder)
export function SoundRecorderIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Ghi âm">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#EF4444" />
        <rect x="20" y="12" width="8" height="15" rx="4" fill="#FFFFFF" />
        <path d="M15 23a9 9 0 0 0 18 0M24 32v5M19 37h10" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}

// 19. Gmail (com.google.android.gm)
export function GmailIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Gmail">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M11 17v15a2 2 0 0 0 2 2h3V21l8 6 8-6v13h3a2 2 0 0 0 2-2V17a2 2 0 0 0-3.2-1.6L24 23l-9.8-7.6A2 2 0 0 0 11 17z" fill="#EA4335" />
        <path d="M11 17v15a2 2 0 0 0 2 2h3V21l-5-4z" fill="#4285F4" />
        <path d="M37 17v15a2 2 0 0 1-2 2h-3V21l5-4z" fill="#34A853" />
      </svg>
    </div>
  );
}

// 20. Google Meet (com.google.android.apps.tachyon)
export function MeetIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Meet">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <rect x="11" y="15" width="18" height="18" rx="3.5" fill="#00897B" />
        <path d="M11 18.5A3.5 3.5 0 0 1 14.5 15H22v7H11v-3.5z" fill="#FBBC04" />
        <path d="M11 26h11v7h-7.5A3.5 3.5 0 0 1 11 29.5V26z" fill="#4285F4" />
        <path d="M29 21l8-5v16l-8-5V21z" fill="#34A853" />
      </svg>
    </div>
  );
}

// 21. Google Contacts (com.google.android.contacts)
export function ContactsIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Danh bạ">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#1A73E8" />
        <circle cx="24" cy="18" r="5.5" fill="#FFFFFF" />
        <path d="M13 35c0-5 5-8.5 11-8.5s11 3.5 11 8.5" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// 22. Google Search (com.google.android.googlequicksearchbox)
export function GoogleSearchIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M35.6 24.3c0-.9-.1-1.7-.2-2.5H24v4.8h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.9z" fill="#4285F4" />
        <path d="M24 36c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H13.2v3.1C15.2 33.3 19.3 36 24 36z" fill="#34A853" />
        <path d="M17.3 26.3c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3v-3.1h-4.1C12.4 20.2 12 22.1 12 24s.4 3.8 1.2 5.4l4.1-3.1z" fill="#FBBC05" />
        <path d="M24 16.7c1.8 0 3.4.6 4.6 1.8l3.5-3.5C30 13.1 27.2 12 24 12c-4.7 0-8.8 2.7-10.8 6.6l4.1 3.1c.9-2.9 3.6-5 6.7-5z" fill="#EA4335" />
      </svg>
    </div>
  );
}

// 23. Google Assistant (com.google.android.apps.googleassistant)
export function AssistantIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Trợ lý Google">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <circle cx="17.5" cy="20" r="6.5" fill="#4285F4" />
        <circle cx="29.5" cy="22" r="3.5" fill="#EA4335" />
        <circle cx="29.5" cy="30.5" r="4" fill="#FBBC05" />
        <circle cx="35.5" cy="18.5" r="2" fill="#34A853" />
      </svg>
    </div>
  );
}

// 24. Google Maps (com.google.android.apps.maps)
export function MapsIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Maps">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M24 10c-5.5 0-10 4.3-10 9.7 0 7.2 10 18.3 10 18.3s10-11.1 10-18.3C34 14.3 29.5 10 24 10z" fill="#34A853" />
        <path d="M24 10c-5.5 0-10 4.3-10 9.7 0 2.3.9 4.7 2.3 7L29 11.4C27.5 10.5 25.8 10 24 10z" fill="#EA4335" />
        <path d="M16.3 26.7c2.4 3.9 5.8 8.3 7.7 10.5 1.8-2.1 5-6.2 7.4-10L24 19.7l-7.7 7z" fill="#FBBC04" />
        <circle cx="24" cy="19.5" r="4" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// 25. Google Photos (com.google.android.apps.photos)
export function PhotosIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Photos">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M24 24V11a6.5 6.5 0 0 1 6.5 6.5A6.5 6.5 0 0 1 24 24z" fill="#EA4335" />
        <path d="M24 24h13a6.5 6.5 0 0 1-6.5 6.5A6.5 6.5 0 0 1 24 24z" fill="#4285F4" />
        <path d="M24 24v13a6.5 6.5 0 0 1-6.5-6.5A6.5 6.5 0 0 1 24 24z" fill="#34A853" />
        <path d="M24 24H11a6.5 6.5 0 0 1 6.5-6.5A6.5 6.5 0 0 1 24 24z" fill="#FBBC05" />
      </svg>
    </div>
  );
}

// 26. Google TV (com.google.android.videos)
export function GoogleTvIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google TV">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <rect x="11" y="14" width="26" height="18" rx="4" fill="none" stroke="#4285F4" strokeWidth="3.2" />
        <path d="M11 18a4 4 0 0 1 4-4h9" stroke="#EA4335" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M37 28a4 4 0 0 1-4 4h-9" stroke="#34A853" strokeWidth="3.2" strokeLinecap="round" fill="none" />
        <path d="M19 36h10" stroke="#FBBC05" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 27. FM Radio (com.android.fmradio)
export function FmRadioIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Đài FM">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#F59E0B" />
        <rect x="12" y="18" width="24" height="17" rx="3" fill="#FFFFFF" />
        <path d="M16 18l14-6" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="28" cy="26.5" r="4" fill="#F59E0B" />
        <path d="M15 24h7M15 29h7" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 28. Google Play Games (com.google.android.play.games)
export function PlayGamesIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Play Trò chơi">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M14 11.5v25c0 1.4 1.5 2.2 2.7 1.5l20-12.5c1.1-.7 1.1-2.3 0-3l-20-12.5c-1.2-.7-2.7.1-2.7 1.5z" fill="#10B981" />
        <path d="M19 24h5M21.5 21.5v5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="28" cy="22.5" r="1.3" fill="#FFFFFF" />
        <circle cx="26" cy="25.5" r="1.3" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// 29. Google Play Store (com.android.vending)
export function PlayStoreIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Cửa hàng Google Play">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M14 11.5v25l13.5-12.5L14 11.5z" fill="#38BDF8" />
        <path d="M14 11.5l13.5 12.5 4.5-4.2-15.5-9.5c-1.2-.7-2.5.1-2.5 1.2z" fill="#34A853" />
        <path d="M14 36.5l13.5-12.5 4.5 4.2-15.5 9.5c-1.2.7-2.5-.1-2.5-1.2z" fill="#EA4335" />
        <path d="M32 19.8L27.5 24l4.5 4.2 5-3c1.1-.7 1.1-1.7 0-2.4l-5-3z" fill="#FBBC04" />
      </svg>
    </div>
  );
}

// 30. Google Kids Space (com.google.android.apps.kids.home)
export function KidsSpaceIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Google Kids Space">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M24 11l4 8 8.8 1.3-6.4 6.2 1.5 8.8L24 31.2l-7.9 4.1 1.5-8.8-6.4-6.2L20 19l4-8z" fill="#FBBC04" stroke="#EA4335" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="4.5" fill="#4285F4" />
      </svg>
    </div>
  );
}

// 31. Find Device (com.google.android.apps.adm)
export function FindDeviceIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Tìm thiết bị">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#10B981" />
        <circle cx="24" cy="24" r="13" fill="none" stroke="#FFFFFF" strokeWidth="2.2" opacity="0.6" />
        <circle cx="24" cy="24" r="5" fill="#FFFFFF" />
        <path d="M24 24l9-9" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// 32. Device Info HW (com.liuzh.deviceinfo)
export function DeviceInfoHwIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Device Info HW">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#0F766E" />
        <rect x="14" y="14" width="20" height="20" rx="3" fill="#14B8A6" stroke="#FFFFFF" strokeWidth="2" />
        <path d="M18 10v4M24 10v4M30 10v4M18 34v4M24 34v4M30 34v4M10 18h4M10 24h4M10 30h4M34 18h4M34 24h4M34 30h4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <text x="24" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="8.5" fontWeight="bold" fontFamily="monospace">
          HW
        </text>
      </svg>
    </div>
  );
}

// 33. Teclast Apps (com.teclast.custom, com.teclast.teclastuserfeedback)
export function TeclastAppIcon({ className }: { className?: string }): React.ReactElement {
  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className ?? ''}`} title="Teclast">
      <svg viewBox="0 0 48 48" className="w-full h-full drop-shadow-xs" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="23" fill="#F97316" />
        <path d="M14 16h20v4h-7.5v14h-5V20H14v-4z" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// Dispatcher matching all 34 real applications on Teclast P30 (P30_ROW)
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

  if (lowerPkg.includes('canva') || lowerName.includes('canva')) {
    return <CanvaIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('chatgpt') || lowerPkg.includes('openai') || lowerName.includes('chatgpt')) {
    return <ChatGPTIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('bard') || lowerName.includes('gemini')) {
    return <GeminiIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('chrome') || lowerName.includes('chrome')) {
    return <ChromeIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('camera') || lowerName.includes('máy ảnh') || lowerName.includes('camera')) {
    return <CameraIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('settings') || lowerName.includes('cài đặt')) {
    return <SettingsIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('calculator') || lowerName.includes('máy tính')) {
    return <CalculatorIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('nbu.files') || lowerName.includes('files') || lowerName.includes('học liệu') || lowerName.includes('tệp')) {
    return <FilesIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('youtube.kids') || lowerName.includes('youtube kids')) {
    return <YouTubeKidsIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('youtube.music') || lowerName.includes('youtube music')) {
    return <YouTubeMusicIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('youtube') || lowerName.includes('youtube')) {
    return <YouTubeIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('editors.sheets') || lowerName.includes('trang tính') || lowerName.includes('sheets')) {
    return <SheetsIcon className={combinedClass} />;
  }
  if (lowerPkg === 'com.google.android.apps.docs' || lowerName.includes('drive')) {
    return <DriveIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('keep') || lowerName.includes('keep')) {
    return <KeepIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('apps.books') || lowerName.includes('play sách') || lowerName.includes('books')) {
    return <PlayBooksIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('calendar') || lowerName.includes('lịch')) {
    return <CalendarIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('deskclock') || lowerName.includes('đồng hồ') || lowerName.includes('clock')) {
    return <ClockIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('soundrecorder') || lowerName.includes('ghi âm')) {
    return <SoundRecorderIcon className={combinedClass} />;
  }
  if (lowerPkg === 'com.google.android.gm' || lowerName.includes('gmail')) {
    return <GmailIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('tachyon') || lowerName.includes('meet')) {
    return <MeetIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('contacts') || lowerName.includes('danh bạ')) {
    return <ContactsIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('googlequicksearchbox') || lowerName === 'google' || lowerName.includes('google search')) {
    return <GoogleSearchIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('googleassistant') || lowerName.includes('trợ lý google') || lowerName.includes('assistant')) {
    return <AssistantIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('apps.maps') || lowerName.includes('bản đồ') || lowerName.includes('maps')) {
    return <MapsIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('apps.photos') || lowerName.includes('photos') || lowerName.includes('ảnh')) {
    return <PhotosIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('android.videos') || lowerName.includes('google tv')) {
    return <GoogleTvIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('fmradio') || lowerName.includes('đài fm') || lowerName.includes('radio')) {
    return <FmRadioIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('play.games') || lowerName.includes('trò chơi') || lowerName.includes('play games')) {
    return <PlayGamesIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('vending') || lowerName.includes('ch play') || lowerName.includes('play store')) {
    return <PlayStoreIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('kids.home') || lowerName.includes('kids space')) {
    return <KidsSpaceIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('apps.adm') || lowerName.includes('tìm thiết bị') || lowerName.includes('find device')) {
    return <FindDeviceIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('deviceinfo') || lowerName.includes('device info')) {
    return <DeviceInfoHwIcon className={combinedClass} />;
  }
  if (lowerPkg.includes('teclast') || lowerName.includes('teclast')) {
    return <TeclastAppIcon className={combinedClass} />;
  }

  return (
    <div
      className={`rounded-full bg-slate-800 text-white font-bold flex items-center justify-center shadow-xs border border-slate-700 text-xs ${combinedClass}`}
      title={name || packageName}
    >
      {(name || packageName).slice(0, 2).toUpperCase()}
    </div>
  );
}
