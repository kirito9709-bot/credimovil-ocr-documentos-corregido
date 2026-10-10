import React, { useState } from 'react';
import {
  Scan,
  FolderSync,
  Calculator,
  ShieldCheck,
  Lock,
  Building2,
  UserRound,
  Menu,
  X,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'captura' | 'cotizar' | 'fondeo' | 'admin' | 'lotes' | 'lotesdashboard' | 'loteportal';
  onSelectTab: (tab: 'captura' | 'cotizar' | 'fondeo' | 'admin' | 'lotes' | 'lotesdashboard' | 'loteportal') => void;
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

  const selectTab = (tab: 'captura' | 'cotizar' | 'fondeo' | 'admin' | 'lotes' | 'lotesdashboard' | 'loteportal') => {
    onSelectTab(tab);
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0B132B]/98 backdrop-blur-md border-b border-[#C81E2B] shadow-sm">
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
                  src="/credimovil-logo.svg"
                  alt="CrediMóvil · Crédito y Fondeo Automotriz"
                  width={720}
                  height={160}
                  className="w-full h-auto object-contain"
                  onError={(event) => {
                    // Fallback local text mark if the logo asset cannot be loaded.
                    event.currentTarget.style.display = 'none';
                  }}
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
          <nav className={`${mobileOpen ? 'absolute left-3 right-3 top-16' : 'hidden'} md:static md:flex items-center gap-1 sm:gap-2 md:bg-transparent bg-[#0B132B] border md:border-0 border-white/10 rounded-2xl p-2 md:p-0 shadow-2xl md:shadow-none z-50`}>
            <button
              onClick={() => onSelectTab('captura')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                currentTab === 'captura'
                  ? 'bg-[#C81E2B] text-white shadow-md shadow-[#C81E2B]/25'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <Scan className="w-4 h-4" />
              <span>CrediMóvil OCR</span>
            </button>

            <button
              onClick={() => selectTab('cotizar')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                currentTab === 'cotizar'
                  ? 'bg-[#C81E2B] text-white shadow-md shadow-[#C81E2B]/25'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>Cotizar mi Crédito</span>
            </button>

            <button
              onClick={() => selectTab('fondeo')}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 relative ${
                currentTab === 'fondeo'
                  ? 'bg-[#C81E2B] text-white shadow-md shadow-[#C81E2B]/25'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <FolderSync className="w-4 h-4" />
              <span>Fondeo Lotes</span>
            </button>

            {authUser?.role !== 'lote' && (
              <button
                onClick={() => selectTab('lotesdashboard')}
                className={'px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ' +
                  (currentTab === 'lotesdashboard'
                    ? 'bg-[#C81E2B] text-white'
                    : 'text-white/85 hover:text-white hover:bg-white/10')}
              >
                <Building2 className="w-4 h-4 text-red-400" />
                <span>Panel de Lotes</span>
              </button>
            )}

            {authUser?.role !== 'lote' && (
              <button
                onClick={() => selectTab('admin')}
                className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-1.5 ${
                  currentTab === 'admin'
                    ? 'bg-[#C81E2B] text-white'
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
                  ? 'bg-[#C81E2B] text-white'
                  : 'text-white/85 hover:text-white hover:bg-white/10'
              }`}
            >
              <UserRound className="w-4 h-4" />
              <span>{authUser?.role === 'lote' ? 'Mi Portal' : 'Acceso Lote'}</span>
            </button>
            <div className="md:hidden mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2">
              {isAdminAuth && (
                <button
                  onClick={onLogoutAdmin}
                  className="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white"
                >
                  Cerrar sesión
                </button>
              )}
            </div>
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            {isAdminAuth && (
              <div className="flex items-center gap-2">
                {authUser?.role === 'lote' && (
                  <span className="hidden xl:inline text-[11px] text-slate-400 max-w-40 truncate">{authUser.nombre}</span>
                )}
                <button
                  onClick={onLogoutAdmin}
                  className="text-xs px-2.5 py-1.5 text-white hover:text-white hover:bg-[#C81E2B] rounded-lg border border-[#2E3A59] transition"
                >
                  Cerrar Sesión
                </button>
              </div>
            )}
          </div>        </div>
      </div>
    </header>
  );
};
