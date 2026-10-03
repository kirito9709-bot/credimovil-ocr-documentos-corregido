import React, { useState } from 'react';
import { X, AlertCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(username.trim(), password);
      localStorage.setItem('credimovil_auth_user', JSON.stringify(res.user));
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'No fue posible iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center mb-4 mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-black text-center text-white mb-1">
          Credi<span className="text-red-500">Móvil</span> Asesor
        </h3>
        <p className="text-xs text-center text-slate-400 mb-6">
          Inicia sesión para acceder a expedientes y documentos privados.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Usuario</label>
            <input
              autoFocus
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="usuario.asesor"
              className="w-full py-3 px-4 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full py-3 pl-4 pr-12 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-2.5 p-1.5 text-slate-400 hover:text-white"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 p-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><ShieldCheck className="w-4 h-4" /> Ingresar</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
