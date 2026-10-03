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
} from 'lucide-react';
import { ExpedienteCredito, LoteAuto, EstatusCredito } from '../types';
import { api } from '../services/api';
import { ChatLoteModal } from './ChatLoteModal';

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
      const [expRes, statsRes] = await Promise.all([
        api.getExpedientes({
          q: searchQuery || undefined,
          estatus: selectedEstatus !== 'TODOS' ? selectedEstatus : undefined,
          loteId: selectedLoteId !== 'TODOS' ? selectedLoteId : undefined,
        }),
        api.getStats(),
      ]);

      if (expRes.success) setExpedientes(expRes.expedientes);
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

  const loadAsesores = async () => {
    if (authUser?.role !== 'admin') return;
    try {
      const res = await api.getAsesores();
      if (res.success) setAsesores(res.asesores || []);
    } catch (err: any) {
      setAdvisorMessage(err.message || 'No se pudieron cargar los asesores.');
    }
  };

  const loadLoteUsuarios = async () => {
    if (authUser?.role !== 'admin') return;
    try {
      const res = await api.getLoteUsuarios();
      if (res.success) setLoteUsuarios(res.usuarios || []);
    } catch (err: any) {
      setLoteUserMessage(err.message || 'No se pudieron cargar los usuarios de lotes.');
    }
  };

  useEffect(() => {
    if (authUser?.role === 'admin' && showLoteUsersModal) {
      loadLoteUsuarios();
    }
  }, [authUser?.role, showLoteUsersModal]);

  const handleCreateLoteUsuario = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoteUserMessage(null);
    try {
      const res = await api.createLoteUsuario({
        loteId: newLoteUserLoteId,
        nombre: newLoteUserName.trim(),
        username: newLoteUsername.trim(),
        password: newLotePassword,
      });
      if (res.success) {
        setLoteUserMessage(`Usuario creado para ${res.loteNombre || 'el lote'}. Entrégale el usuario y contraseña de forma segura.`);
        setNewLoteUserName('');
        setNewLoteUsername('');
        setNewLotePassword('');
        loadLoteUsuarios();
      }
    } catch (err: any) {
      setLoteUserMessage(err.message || 'No se pudo crear el usuario del lote.');
    }
  };

  const handleDeleteLoteUsuario = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el acceso de ${nombre}?`)) return;
    try {
      await api.deleteLoteUsuario(id);
      loadLoteUsuarios();
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el usuario del lote.');
    }
  };

  const handleCreateAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdvisorMessage(null);
    try {
      const res = await api.createAsesor({
        nombre: newAdvisorName.trim(),
        username: newAdvisorUsername.trim(),
        password: newAdvisorPassword,
      });
      if (res.success) {
        setAdvisorMessage('Asesor creado correctamente.');
        setNewAdvisorName('');
        setNewAdvisorUsername('');
        setNewAdvisorPassword('');
        loadAsesores();
      }
    } catch (err: any) {
      setAdvisorMessage(err.message || 'No se pudo crear el asesor.');
    }
  };

  const handleDeleteAdvisor = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el acceso de ${nombre}?`)) return;
    try {
      await api.deleteAsesor(id);
      loadAsesores();
    } catch (err: any) {
      alert(err.message || 'No se pudo eliminar el asesor.');
    }
  };

  const exportCsv = () => {
    if (expedientes.length === 0) return;
    const headers = [
      'Folio',
      'Estatus',
      'Cliente',
      'CURP',
      'RFC',
      'Telefono',
      'Lote',
      'Auto',
      'Ano',
      'Precio',
      'Enganche',
      'Monto_Financiado',
      'Plazo',
      'Financiera',
      'Fecha_Creacion',
    ];

    const rows = expedientes.map((e) => [
      e.folio,
      e.estatus,
      `"${e.ine?.nombreCompleto || e.ine?.nombre || ''}"`,
      e.ine?.curp || '',
      e.ine?.rfc || (e.ine?.curp ? e.ine.curp.substring(0, 10) : ''),
      e.telefono || '',
      `"${e.loteNombre || ''}"`,
      `"${e.autoMarca} ${e.autoModelo}"`,
      e.autoAno,
      e.autoPrecio,
      e.enganche,
      e.montoFinanciar,
      e.plazoMeses,
      `"${e.financieraAsignada || ''}"`,
      e.fechaCreacion,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expedientes_CrediMovil_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isAdminAuth) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            Panel Restringido CrediMóvil
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Acceso exclusivo para el Asesor de Crédito. Consulta y dictamina expedientes y administra la documentación de fondeo.
          </p>

          <button
            onClick={onOpenAuth}
            className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-red-900/30 flex items-center justify-center gap-2"
          >
            <KeyRound className="w-4 h-4" />
            Ingresar con usuario y contraseña
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#071A33] border border-[#0F2A4D] rounded-2xl p-5 sm:p-6 shadow-lg shadow-slate-900/10">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Control de Expedientes y Fondeo
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
              CrediMóvil Asesor
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Supervisión directa de prospectos, validación de INE y mesa de fondeo sin intermediarios
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onGoToCaptura}
            className="py-2 px-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-red-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Solicitud OCR</span>
          </button>

          <button
            onClick={exportCsv}
            disabled={expedientes.length === 0}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
            title="Exportar a CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            onClick={onOpenLotesManager}
            className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
          >
            <Building2 className="w-3.5 h-3.5 text-red-400" />
            <span>Lotes ({lotes.length})</span>
          </button>

          {authUser?.role === 'admin' && (
            <>
              <button
                onClick={() => setShowAdvisorModal(true)}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>Asesores</span>
              </button>

              <button
                onClick={() => {
                  setShowLoteUsersModal(true);
                  if (!newLoteUserLoteId && lotes[0]) setNewLoteUserLoteId(lotes[0].id);
                }}
                className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition flex items-center gap-1.5"
              >
                <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Accesos Lote</span>
              </button>
            </>
          )}

          <button
            onClick={() => setShowChatModal(true)}
            className="py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>Chat Lotes</span>
          </button>

          <button
            onClick={loadData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Flujo de Crédito */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Pre-aprobado</span>
          <span className="text-2xl font-black text-violet-400 mt-1 block">{stats.preAprobados}</span>
          <span className="text-[10px] text-slate-500 block">Casos pre-dictaminados</span>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">En Análisis</span>
          <span className="text-2xl font-black text-blue-400 mt-1 block">{stats.enEvaluacion}</span>
          <span className="text-[10px] text-slate-500 block">Evaluando crédito</span>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Aprobado</span>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">{stats.aprobados}</span>
          <span className="text-[10px] text-slate-500 block">Listos para contrato</span>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Contrato</span>
          <span className="text-2xl font-black text-orange-400 mt-1 block">{stats.contratos}</span>
          <span className="text-[10px] text-slate-500 block">Contrato en proceso</span>
        </div>
        <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">GPS</span>
          <span className="text-2xl font-black text-cyan-400 mt-1 block">{stats.gps}</span>
          <span className="text-[10px] text-slate-500 block">Instalación / validación</span>
        </div>
        <div className="bg-teal-500/10 border border-teal-500/20 rounded-2xl p-4">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Fondeo</span>
          <span className="text-2xl font-black text-teal-400 mt-1 block">{stats.fondeo}</span>
          <span className="text-[10px] text-slate-500 block">En proceso o fondeado</span>
        </div>
      </div>
      <div className="flex items-center justify-end -mt-4">
        <span className="text-[10px] text-slate-500">
          Total de expedientes: <strong className="text-slate-300">{stats.total}</strong> • Financiado: <strong className="text-emerald-400">${(stats.montoTotalFinanciado || 0).toLocaleString('es-MX')} MXN</strong>
        </span>
      </div>
      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cliente, CURP, folio CrediMóvil, auto o lote..."
              className="w-full py-2 pl-9 pr-4 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedLoteId}
              onChange={(e) => setSelectedLoteId(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-red-500"
            >
              <option value="TODOS">Todos los Lotes Aliados</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              value={selectedEstatus}
              onChange={(e) => setSelectedEstatus(e.target.value)}
              className="w-full py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-red-500"
            >
              <option value="TODOS">Todos los Estatus</option>
              <option value="NUEVO">NUEVO</option>
              <option value="PRE_APROBADO">PRE-APROBADO</option>
              <option value="EN_EVALUACION">EN ANÁLISIS</option>
              <option value="APROBADO">APROBADO</option>
              <option value="CONTRATO">CONTRATO</option>
              <option value="GPS">GPS</option>
              <option value="FONDEO">FONDEO</option>
              <option value="RECHAZADO">RECHAZADO</option>
            </select>
          </div>
        </div>
      </div>

      {/* Expedientes Table / Clean Empty State */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 text-[11px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Folio CrediMóvil</th>
                <th className="py-3 px-4">Cliente (INE)</th>
                <th className="py-3 px-4">Lote Asociado</th>
                <th className="py-3 px-4">Vehículo</th>
                <th className="py-3 px-4">Monto Fondeo</th>
                <th className="py-3 px-4">Estatus Crédito</th>
                <th className="py-3 px-4">Checklist Fondeo</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {expedientes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <FolderOpen className="w-6 h-6 text-red-400" />
                      </div>
                      <p className="text-sm font-bold text-white">
                        Base de Datos Limpia y Lista
                      </p>
                      <p className="text-xs text-slate-400">
                        Se eliminó la información falsa. Ahora puedes registrar tus expedientes reales mediante la cámara de la INE o subiendo tus documentos.
                      </p>
                      <button
                        onClick={onGoToCaptura}
                        className="py-2 px-4 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-md shadow-red-900/30"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Capturar Primer Expediente Real
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                expedientes.map((exp) => {
                  const requiredDocs = (exp.documentosFondeo || []).filter((d) => d.requerido);
                  const approvedDocs = requiredDocs.filter((d) => d.estatus === 'APROBADO');
                  const uploadedDocs = requiredDocs.filter((d) => d.estatus === 'SUBIDO');
                  const docPercent = requiredDocs.length > 0 ? Math.round((approvedDocs.length / requiredDocs.length) * 100) : 0;

                  return (
                    <tr
                      key={exp.id}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => onOpenExpediente(exp)}
                    >
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-white block">
                          {exp.folio}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {new Date(exp.fechaCreacion).toLocaleDateString('es-MX')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-white block truncate max-w-[180px]">
                          {exp.ine?.nombreCompleto || exp.ine?.nombre || 'Sin nombre'}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10px] mt-0.5">
                          {exp.ine?.rfc && (
                            <span className="text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/20">
                              RFC: {exp.ine.rfc}
                            </span>
                          )}
                          <span className="text-slate-400">{exp.ine?.curp || exp.telefono || ''}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-200 block truncate max-w-[140px]">
                          {exp.loteNombre}
                        </span>
                        {exp.asesorLoteContacto && (
                          <span className="text-[10px] text-slate-500 block">
                            {exp.asesorLoteContacto}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-200 block truncate max-w-[150px]">
                          {exp.autoMarca} {exp.autoModelo}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Año {exp.autoAno}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-400 block">
                          ${(exp.montoFinanciar || 0).toLocaleString('es-MX')}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {exp.plazoMeses} meses • {exp.financieraAsignada || 'CrediMóvil'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            exp.estatus === 'FONDEADO' || exp.estatus === 'FONDEO'
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                              : exp.estatus === 'GPS'
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                              : exp.estatus === 'CONTRATO'
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                              : exp.estatus === 'APROBADO'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : exp.estatus === 'PRE_APROBADO'
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                              : exp.estatus === 'FONDEO_REVISION' || exp.estatus === 'FONDEO_PENDIENTE'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : exp.estatus === 'EN_EVALUACION'
                              ? 'bg-blue-500/20 text-blue-300'
                              : exp.estatus === 'RECHAZADO'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {exp.estatus === 'EN_EVALUACION' ? 'EN ANÁLISIS'
                            : exp.estatus === 'PRE_APROBADO' ? 'PRE-APROBADO'
                            : exp.estatus === 'FONDEO_PENDIENTE' ? 'FONDEO'
                            : exp.estatus === 'FONDEO_REVISION' ? 'FONDEO'
                            : exp.estatus}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                            <div
                              className="h-full bg-red-600"
                              style={{ width: `${docPercent}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {approvedDocs.length}/{requiredDocs.length}
                          </span>
                        </div>
                        {uploadedDocs.length > 0 && (
                          <span className="text-[10px] text-amber-400 font-semibold block mt-0.5">
                            {uploadedDocs.length} por revisar
                          </span>
                        )}
                      </td>

                      <td
                        className="py-3.5 px-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenExpediente(exp)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                            title="Ver expediente"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => onOpenPrint(exp)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-red-400 rounded-lg transition"
                            title="Imprimir carátula"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
    </div>
  );
};
