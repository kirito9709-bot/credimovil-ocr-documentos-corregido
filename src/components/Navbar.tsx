import React, { useState } from 'react';
import {
  Car,
  Scan,
  FolderSync,
  ShieldCheck,
  Lock,
  Building2,
  UserRound,
  Menu,
  X,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'captura' | 'fondeo' | 'admin' | 'lotes' | 'loteportal';
  onSelectTab: (tab: 'captura' | 'fondeo' | 'admin' | 'lotes' | 'loteportal') => void;
  isAdminAuth: boolean;
  onOpenAdminAuth: () => void;
  onOpenLoteAuth: () => void;
  onLogoutAdmin: () => void;
  authUser?: { role?: 'admin' | 'asesor' | 'lote'; nombre?: string } | null;
  activeLoteCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  isAdminAuth,
  onOpenAdminAuth,
  onOpenLoteAuth,
  onLogoutAdmin,
  authUser,
  activeLoteCount,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectTab = (tab: 'captura' | 'fondeo' | 'admin' | 'lotes' | 'loteportal') => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand: CrediMóvil */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => selectTab('captura')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-500/25 group-hover:scale-105 transition">
              <Car className="w-5 h-5 text-white font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  Credi<span className="text-red-500">Móvil</span>
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  OCR & Fondeo
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Tu auto, más cerca de tus planes
              </p>
            </div>
          </div>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Navigation Tabs */}
          <nav className={`${mobileOpen ? 'absolute left-3 right-3 top-16' : 'hidden'} md:static md:flex items-center gap-1 sm:gap-2 md:bg-transparent bg-slate-950 border md:border-0 border-slate-800 rounded-2xl p-2 md:p-0 shadow-2xl md:shadow-none z-50`}>
            <button
              onClick={() => onSelectTab('captura')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                currentTab === 'captura'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Scan className="w-4 h-4" />
              <span>CrediMóvil OCR</span>
            </button>

            <button
              onClick={() => selectTab('fondeo')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 relative ${
                currentTab === 'fondeo'
                  ? 'bg-red-600 text-white shadow-md shadow-red-600/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <FolderSync className="w-4 h-4" />
              <span>Fondeo Lotes</span>
            </button>

            {authUser?.role !== 'lote' && (
              <button
                onClick={() => selectTab('admin')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                  currentTab === 'admin'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {isAdminAuth ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Lock className="w-4 h-4 text-slate-400" />
                )}
                <span>Panel Asesor</span>
              </button>
            )}

            <button
              onClick={() => authUser?.role === 'lote' ? selectTab('loteportal') : onOpenLoteAuth()}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                currentTab === 'loteportal'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <UserRound className="w-4 h-4" />
              <span>{authUser?.role === 'lote' ? 'Mi Portal' : 'Acceso Lote'}</span>
            </button>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => selectTab('lotes')}
              className="hidden lg:flex items-center gap-1.5 text-xs text-slate-300 hover:text-red-400 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 transition"
              title="Directorio de Lotes Asociados"
            >
              <Building2 className="w-3.5 h-3.5 text-red-400" />
              <span>{activeLoteCount} Lotes</span>
            </button>

            {isAdminAuth ? (
              <div className="flex items-center gap-2">
                {authUser?.role === 'lote' && (
                  <span className="hidden xl:inline text-[11px] text-slate-400 max-w-40 truncate">{authUser.nombre}</span>
                )}
                <button
                  onClick={onLogoutAdmin}
                  className="text-xs px-2.5 py-1.5 text-red-300 hover:text-white hover:bg-red-950/40 rounded-lg border border-red-800/40 transition"
                >
                  Cerrar Sesión
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenAdminAuth}
                className="text-xs px-3 py-1.5 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition flex items-center gap-1"
              >
                <Lock className="w-3 h-3 text-red-400" />
                <span>Acceso Asesor</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
