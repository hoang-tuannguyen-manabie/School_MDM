import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, ArrowLeft, AlertCircle, Sparkles } from 'lucide-react';

interface AdminLoginProps {
  onSuccess: () => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export function AdminLogin({
  onSuccess,
  onCancel,
  isModal = false,
}: AdminLoginProps): React.ReactElement {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    setTimeout(() => {
      // Validate password Manabie@2026
      if (password === 'Manabie@2026') {
        sessionStorage.setItem('school_mdm_admin_auth', 'true');
        onSuccess();
      } else {
        setError('Mật khẩu quản trị viên không chính xác. Vui lòng kiểm tra lại.');
        setIsLoading(false);
      }
    }, 250);
  };

  const content = (
    <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-8 space-y-6">
      {/* Brand & Security Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-indigo-400 mx-auto flex items-center justify-center shadow-sm border border-slate-800">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Cổng Quản Trị Viên
        </h2>
        <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
          Khu vực bảo mật dành riêng cho cán bộ quản lý thiết bị và kỹ thuật viên nhà trường
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="admin-password"
            className="block text-xs font-semibold text-slate-700"
          >
            Mật khẩu Quản trị viên
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Nhập mật khẩu quản trị..."
              autoFocus
              required
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>Mật khẩu mặc định hệ thống: <strong className="font-mono text-slate-800">Manabie@2026</strong></span>
        </div>

        <button
          type="submit"
          disabled={isLoading || !password.trim()}
          className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition flex items-center justify-center gap-2"
        >
          {isLoading ? 'Đang xác thực...' : 'Đăng nhập vào Hệ thống Quản trị'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại Cổng Giáo viên</span>
          </button>
        )}
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      {content}
    </div>
  );
}
