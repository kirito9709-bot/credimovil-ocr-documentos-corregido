import React from 'react';
import {
  Car,
  FileText,
  FolderSync,
  ShieldCheck,
  Building2,
  Lock,
  Unlock,
  CheckCircle2,
  Phone,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { LoteAuto } from '../types';

interface AppSidebarProps {
  currentTab: 'captura' | 'fondeo' | 'admin' | 'lotes';
  onSelectTab: (tab: 'captura' | 'fondeo' | 'admin' | 'lotes') => void;
  isAdminAuth: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenLotes: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  lotes: LoteAuto[];
}

export const AppSidebar: React.FC<AppSidebarProps> = ({
  currentTab,
  onSelectTab,
  isAdminAuth,
  onOpenLogin,
  onLogout,
  onOpenLotes,
  isOpenMobile,
  onCloseMobile,
  lotes,
}) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-72 bg-[#181b22] text-slate-200 z-50 flex flex-col border-r border-[#262b36] transition-transform duration-300 lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand header */}
        <div className="h-18 px-5 flex items-center justify-between border-b border-[#262b36]">
          <div
            onClick={() => {
              onSelectTab('captura');
              onCloseMobile();
            }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center text-white shadow-lg shadow-red-950/40 border border-amber-400/30">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-wider text-white">
                  CREDI<span className="text-red-500">MÓVIL</span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium tracking-tight">
                Crédito & Fondeo Automotriz
              </p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Group 1: Menú Principal */}
          <div>
            <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Menú principal
            </span>

            <nav className="space-y-1">
              <button
                onClick={() => {
                  onSelectTab('captura');
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentTab === 'captura'
                    ? 'bg-red-600 text-white shadow-md shadow-red-950/50'
                    : 'text-slate-300 hover:bg-[#202530] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className={`w-4 h-4 ${currentTab === 'captura' ? 'text-white' : 'text-slate-400'}`} />
                  <span>Nueva Solicitud (Análisis)</span>
                </div>
                {currentTab === 'captura' && <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => {
                  onSelectTab('fondeo');
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentTab === 'fondeo'
                    ? 'bg-red-600 text-white shadow-md shadow-red-950/50'
                    : 'text-slate-300 hover:bg-[#202530] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FolderSync className={`w-4 h-4 ${currentTab === 'fondeo' ? 'text-white' : 'text-slate-400'}`} />
                  <span>Búsqueda & Fondeo Lote</span>
                </div>
                {currentTab === 'fondeo' && <ChevronRight className="w-3.5 h-3.5" />}
              </button>

              <button
                onClick={() => {
                  if (!isAdminAuth) {
                    onOpenLogin();
                  } else {
                    onSelectTab('admin');
                  }
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                  currentTab === 'admin'
                    ? 'bg-red-600 text-white shadow-md shadow-red-950/50'
                    : 'text-slate-300 hover:bg-[#202530] hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck className={`w-4 h-4 ${currentTab === 'admin' ? 'text-white' : 'text-amber-400'}`} />
                  <span>Control de Expedientes</span>
                </div>
                {!isAdminAuth ? (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                ) : currentTab === 'admin' ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : null}
              </button>
            </nav>
          </div>

          {/* Group 2: Gestión y Lotes */}
          <div>
            <span className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              Gestión & Lotes
            </span>

            <nav className="space-y-1">
              <button
                onClick={() => {
                  onOpenLotes();
                  onCloseMobile();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-[#202530] hover:text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <span>Directorio de Lotes</span>
                </div>
                <span className="text-[10px] bg-[#2a303e] text-slate-300 px-1.5 py-0.5 rounded-md font-mono">
                  {lotes.length}
                </span>
              </button>

              <div className="px-3 py-2 rounded-xl bg-[#1e232d] border border-[#2b3140] text-[11px] space-y-1.5 mt-2">
                <span className="font-bold text-amber-400 block flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Requisitos para Análisis:
                </span>
                <ul className="text-slate-400 space-y-1 text-[10.5px]">
                  <li>• INE por ambos lados</li>
                  <li>• Comprobante domicilio (Agua/Luz)</li>
                  <li>• Estados de cuenta (3 meses)</li>
                </ul>
              </div>
            </nav>
          </div>
        </div>

        {/* Footer info & Admin login */}
        <div className="p-4 border-t border-[#262b36] space-y-3 bg-[#13161c]">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span>🇲🇽</span>
              <span>México (MXN)</span>
            </span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
              Sistema v2.5
            </span>
          </div>

          <a
            href="https://wa.me/528112345678"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-slate-300 hover:text-emerald-400 transition"
          >
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Soporte Asesor WhatsApp</span>
          </a>

          {isAdminAuth ? (
            <div className="flex items-center justify-between pt-1 border-t border-[#262b36]">
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <Unlock className="w-3 h-3" /> Asesor Activo
              </span>
              <button
                onClick={onLogout}
                className="text-[10px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="w-full py-2 px-3 bg-[#242a36] hover:bg-[#2e3646] text-slate-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 border border-[#343d4f] cursor-pointer"
            >
              <Lock className="w-3 h-3 text-red-400" />
              <span>Acceso Asesor (PIN)</span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
