import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  FileText,
  DollarSign,
  Car,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  Printer,
  Share2,
  Trash2,
  Lock,
  Unlock,
  KeyRound,
  Download,
  Plus,
  RefreshCw,
  FolderOpen,
  MessageCircle,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import { ExpedienteCredito, LoteAuto, EstatusCredito } from '../types';
import { api } from '../services/api';
import { ChatLoteModal } from './ChatLoteModal';
import { AdvisorDashboard } from './AdvisorDashboard';

interface AdminPanelProps {
  isAdminAuth: boolean;
  onOpenAuth: () => void;
  onLogout: () => void;
  lotes: LoteAuto[];
  onOpenExpediente: (expediente: ExpedienteCredito) => void;
  onOpenPrint: (expediente: ExpedienteCredito) => void;
  onOpenLotesManager: () => void;
  onGoToCaptura: () => void;
  authUser?: { username: string; role: 'admin' | 'asesor'; nombre: string } | null;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isAdminAuth,
  onOpenAuth,
  onLogout,
  lotes,
  onOpenExpediente,
  onOpenPrint,
  onOpenLotesManager,
  onGoToCaptura,
  authUser,
}) => {
  const [expedientes, setExpedientes] = useState<ExpedienteCredito[]>([]);
  const [allExpedientes, setAllExpedientes] = useState<ExpedienteCredito[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEstatus, setSelectedEstatus] = useState<string>('TODOS');
  const [selectedLoteId, setSelectedLoteId] = useState<string>('TODOS');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    nuevos: 0,
    preAprobados: 0,
    enEvaluacion: 0,
    aprobados: 0,
    contratos: 0,
    gps: 0,
    fondeo: 0,
    fondeoRevision: 0,
    fondeados: 0,
    montoTotalFinanciado: 0,
  });

  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [asesores, setAsesores] = useState<any[]>([]);
  const [newAdvisorName, setNewAdvisorName] = useState('');
  const [newAdvisorUsername, setNewAdvisorUsername] = useState('');
  const [newAdvisorPassword, setNewAdvisorPassword] = useState('');
  const [advisorMessage, setAdvisorMessage] = useState<string | null>(null);

  const [showLoteUsersModal, setShowLoteUsersModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [loteUsuarios, setLoteUsuarios] = useState<any[]>([]);
  const [newLoteUserLoteId, setNewLoteUserLoteId] = useState('');
  const [newLoteUserName, setNewLoteUserName] = useState('');
  const [newLoteUsername, setNewLoteUsername] = useState('');
  const [newLotePassword, setNewLotePassword] = useState('');
  const [loteUserMessage, setLoteUserMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [expRes, allExpRes, statsRes] = await Promise.all([
        api.getExpedientes({
          q: searchQuery || undefined,
          estatus: selectedEstatus !== 'TODOS' ? selectedEstatus : undefined,
          loteId: selectedLoteId !== 'TODOS' ? selectedLoteId : undefined,
        }),
        api.getExpedientes(),
        api.getStats(),
      ]);

      if (expRes.success) setExpedientes(expRes.expedientes);
      if (allExpRes.success) setAllExpedientes(allExpRes.expedientes);
      if (statsRes.success) setStats(statsRes.stats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminAuth) {
      loadData();
    }
  }, [isAdminAuth, selectedEstatus, selectedLoteId]);

  useEffect(() => {
    if (authUser?.role === 'admin') loadAsesores();
  }, [authUser?.role]);

  useEffect(() => {
    if (!isAdminAuth) return;
    const timer = setTimeout(() => {
      loadData();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isAdminAuth) {
    return (
      <section className="w-full min-h-[calc(100vh-160px)] flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0D1830] p-7 text-center shadow-2xl">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-red-400" />
          </div>
          <h2 className="mt-4 text-2xl font-black text-white">Acceso al Panel del Asesor</h2>
          <p className="mt-2 text-sm text-slate-400">Inicia sesión para consultar expedientes, documentos, estatus y métricas.</p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-6 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-sm inline-flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            Iniciar sesión
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <AdvisorDashboard
        expedientes={expedientes}
        allExpedientes={allExpedientes}
        stats={stats}
        loading={loading}
        lotes={lotes}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedEstatus={selectedEstatus}
        setSelectedEstatus={setSelectedEstatus}
        selectedLoteId={selectedLoteId}
        setSelectedLoteId={setSelectedLoteId}
        loadData={loadData}
        onGoToCaptura={onGoToCaptura}
        onOpenExpediente={onOpenExpediente}
        onOpenPrint={onOpenPrint}
      />

      {showAdvisorModal && authUser?.role === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white">Usuarios de Asesor</h3>
                <p className="text-xs text-slate-400">Crea accesos individuales para que cada asesor vea expedientes y documentos sin compartir contraseña.</p>
              </div>
              <button
                onClick={() => setShowAdvisorModal(false)}
                className="py-1.5 px-3 text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateAdvisor} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-6">
              <input
                required
                value={newAdvisorName}
                onChange={(e) => setNewAdvisorName(e.target.value)}
                placeholder="Nombre del asesor"
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white"
              />
              <input
                required
                value={newAdvisorUsername}
                onChange={(e) => setNewAdvisorUsername(e.target.value)}
                placeholder="usuario"
                autoComplete="off"
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white"
              />
              <input
                required
                minLength={8}
                type="password"
                value={newAdvisorPassword}
                onChange={(e) => setNewAdvisorPassword(e.target.value)}
                placeholder="Contraseña (8+)"
                autoComplete="new-password"
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white"
              />
              <button
                type="submit"
                className="sm:col-span-3 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl"
              >
                Crear Usuario de Asesor
              </button>
            </form>

            {advisorMessage && (
              <div className="mb-4 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                {advisorMessage}
              </div>
            )}

            <div className="space-y-2">
              {asesores.length === 0 ? (
                <div className="text-xs text-slate-500 py-5 text-center">Aún no hay asesores adicionales.</div>
              ) : asesores.map((asesor) => (
                <div key={asesor.id} className="flex items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-white">{asesor.nombre}</div>
                    <div className="text-[11px] text-slate-400">@{asesor.username}</div>
                  </div>
                  <button
                    onClick={() => handleDeleteAdvisor(asesor.id, asesor.nombre)}
                    className="py-1.5 px-3 bg-rose-950/40 border border-rose-800/50 text-rose-300 rounded-lg text-xs"
                  >
                    Eliminar acceso
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showChatModal && authUser && (
        <ChatLoteModal
          isOpen={showChatModal}
          onClose={() => setShowChatModal(false)}
          authUser={authUser}
          lotes={lotes}
        />
      )}

      {showLoteUsersModal && authUser?.role === 'admin' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-bold text-white">Accesos para Lotes Aliados</h3>
                <p className="text-xs text-slate-400">
                  Cada usuario queda vinculado a un lote y solo podrá consultar los créditos enviados por ese lote.
                </p>
              </div>
              <button onClick={() => setShowLoteUsersModal(false)} className="py-1.5 px-3 text-slate-400 hover:text-white">Cerrar</button>
            </div>

            <form onSubmit={handleCreateLoteUsuario} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-6">
              <select
                required
                value={newLoteUserLoteId}
                onChange={(e) => setNewLoteUserLoteId(e.target.value)}
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white"
              >
                <option value="">Selecciona el lote...</option>
                {lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nombre}</option>)}
              </select>

              <input
                required
                value={newLoteUserName}
                onChange={(e) => setNewLoteUserName(e.target.value)}
                placeholder="Nombre del contacto"
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white"
              />

              <input
                required
                value={newLoteUsername}
                onChange={(e) => setNewLoteUsername(e.target.value)}
                placeholder="Usuario (ej. credimotors)"
                autoComplete="off"
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white"
              />

              <input
                required
                minLength={8}
                type="password"
                value={newLotePassword}
                onChange={(e) => setNewLotePassword(e.target.value)}
                placeholder="Contraseña (8+)"
                autoComplete="new-password"
                className="py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white"
              />

              <button type="submit" className="sm:col-span-2 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl">
                Crear Acceso del Lote
              </button>
            </form>

            {loteUserMessage && (
              <div className="mb-4 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                {loteUserMessage}
              </div>
            )}

            <div className="space-y-2">
              {loteUsuarios.length === 0 ? (
                <div className="text-xs text-slate-500 py-5 text-center">Aún no hay accesos de lotes.</div>
              ) : loteUsuarios.map((usuario) => (
                <div key={usuario.id} className="flex items-center justify-between gap-3 p-3 bg-slate-950 border border-slate-800 rounded-xl">
                  <div>
                    <div className="text-sm font-bold text-white">{usuario.nombre}</div>
                    <div className="text-[11px] text-slate-400">
                      @{usuario.username} • {lotes.find((l) => l.id === usuario.lote_id)?.nombre || 'Lote'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteLoteUsuario(usuario.id, usuario.nombre)}
                    className="py-1.5 px-3 bg-rose-950/40 border border-rose-800/50 text-rose-300 rounded-lg text-xs"
                  >
                    Eliminar acceso
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </>
  );
};