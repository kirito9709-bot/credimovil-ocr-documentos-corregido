import React, { useState } from 'react';
import {
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
    <header className="sticky top-0 z-40 bg-[#163F41]/98 backdrop-blur-md border-b border-[#2E766F] shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand: CrediMóvil */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => selectTab('captura')}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-[132px] sm:w-[150px] flex items-center justify-center">
                <img
                  src="https://credimovil.mx/wp-content/uploads/2024/05/logo-white-170px.png"
                  alt="CrediMóvil"
                  className="w-full h-auto object-contain"
                />
              </div>
              <div className="hidden sm:block">
                <p className="text-[11px] text-white/80">Tu auto, más cerca de tus planes</p>
              </div>
            </div>
          </div>

          {/* Mobile menu trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="md:hidden p-2 rounded-xl bg-white/10 border border-white/15 text-white"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Navigation Tabs */}
          <nav className={`${mobileOpen ? 'absolute left-3 right-3 top-16' : 'hidden'} md:static md:flex items-center gap-1 sm:gap-2 md:bg-transparent bg-[#163F41] border md:border-0 border-[#2E766F] rounded-2xl p-2 md:p-0 shadow-2xl md:shadow-none z-50`}>
            <button
              onClick={() => onSelectTab('captura')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                currentTab === 'captura'
                  ? 'bg-[#4E9B92] text-white shadow-md shadow-[#0E2E30]/20'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <Scan className="w-4 h-4" />
              <span>CrediMóvil OCR</span>
            </button>

            <button
              onClick={() => selectTab('fondeo')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 relative ${
                currentTab === 'fondeo'
                  ? 'bg-[#163F41] text-white shadow-md shadow-[#163F41]/20'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
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
                    ? 'bg-[#4E9B92] text-white'
                    : 'text-white/85 hover:text-white hover:bg-white/10'
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
                  ? 'bg-[#4E9B92] text-white'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <UserRound className="w-4 h-4" />
              <span>{authUser?.role === 'lote' ? 'Mi Portal' : 'Acceso Lote'}</span>
            </button>
            <div className="md:hidden mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
              <button
                onClick={() => selectTab('lotes')}
                className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white"
              >
                <Building2 className="w-4 h-4 inline mr-1.5 text-[#79C2BB]" />
                {activeLoteCount} Lotes
              </button>

              {isAdminAuth ? (
                <button
                  onClick={onLogoutAdmin}
                  className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white"
                >
                  Cerrar sesión
                </button>
              ) : (
                <button
                  onClick={() => { onOpenAdminAuth(); setMobileOpen(false); }}
                  className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white"
                >
                  <Lock className="w-4 h-4 inline mr-1.5 text-red-400" />
                  Acceso Asesor
                </button>
              )}
            </div>
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => selectTab('lotes')}
              className="hidden lg:flex items-center gap-1.5 text-xs text-white/85 hover:text-white px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 transition"
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
                  className="text-xs px-2.5 py-1.5 text-[#7c3f3f] hover:text-[#163F41] hover:bg-[#F8ECEC] rounded-lg border border-[#ead7d7] transition"
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
          </div>        </div>
      </div>
    </header>
  );
};
