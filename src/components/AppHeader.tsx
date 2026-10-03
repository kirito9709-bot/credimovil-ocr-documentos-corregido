import React from 'react';
import { Menu, Lock, Unlock, Plus, FileText, CheckCircle2 } from 'lucide-react';

interface AppHeaderProps {
  currentTab: 'captura' | 'fondeo' | 'admin' | 'lotes';
  onSelectTab: (tab: 'captura' | 'fondeo' | 'admin' | 'lotes') => void;
  isAdminAuth: boolean;
  onOpenLogin: () => void;
  onOpenMobileMenu: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  currentTab,
  onSelectTab,
  isAdminAuth,
  onOpenLogin,
  onOpenMobileMenu,
}) => {
  const getTabTitle = () => {
    switch (currentTab) {
      case 'captura':
        return 'Nueva Solicitud para Análisis de Crédito';
      case 'fondeo':
        return 'Checklist de Documentación & Fondeo';
      case 'admin':
        return 'Control de Expedientes y Fondeo (Asesor)';
      default:
        return 'CrediMóvil';
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Mobile menu toggle + Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="p-2 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden cursor-pointer"
            title="Abrir menú"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {getTabTitle()}
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              Crédito Automotriz directo para lotes y asesores sin intermediarios
            </p>
          </div>
        </div>

        {/* Right buttons */}
        <div className="flex items-center gap-2.5 self-end md:self-auto">
          {currentTab !== 'captura' && (
            <button
              onClick={() => onSelectTab('captura')}
              className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Solicitud</span>
            </button>
          )}

          {!isAdminAuth ? (
            <button
              onClick={onOpenLogin}
              className="py-2 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-red-600" />
              <span>Acceso Asesor</span>
            </button>
          ) : (
            <button
              onClick={() => onSelectTab('admin')}
              className="py-2 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Panel Asesor Activo</span>
            </button>
          )}
        </div>
      </div>

      {/* Info Callout Banner matching user image reference */}
      <div className="bg-blue-50/80 border-t border-b border-blue-100 px-4 sm:px-6 lg:px-8 py-2.5 text-xs text-blue-900 flex items-start sm:items-center gap-2.5">
        <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 font-bold text-[10px]">
          i
        </div>
        <div className="flex-1 leading-relaxed">
          <strong className="font-bold text-blue-950">Documentos indispensables para mandar a análisis: </strong>
          <span>
            Es obligatorio adjuntar <strong>1) Identificación Oficial INE por ambos lados</strong>, <strong>2) Comprobante de domicilio reciente (Agua o Luz CFE)</strong> y <strong>3) Estados de cuenta bancarios de los últimos 3 meses</strong>.
          </span>
        </div>
      </div>
    </header>
  );
};
