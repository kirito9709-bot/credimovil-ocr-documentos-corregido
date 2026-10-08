import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  Car,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  UserRoundCheck,
  X,
  XCircle,
  CircleDollarSign,
} from 'lucide-react';
import { ExpedienteCredito, LoteAuto } from '../types';
import { api } from '../services/api';

interface LotesDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  lotes: LoteAuto[];
  onLoteCreated: (lote: LoteAuto) => void;
  onLoteUpdated: (lote: LoteAuto) => void;
  onLoteDeleted: (id: string) => void;
  canManage?: boolean;
}

const money = (value: number) =>
  '$' + Math.round(value || 0).toLocaleString('es-MX') + ' MXN';

const statusLabel = (status: string) => {
  if (status === 'EN_EVALUACION') return 'En análisis';
  if (status === 'PRE_APROBADO') return 'Pre-aprobado';
  if (status === 'FONDEO_PENDIENTE' || status === 'FONDEO_REVISION' || status === 'FONDEO') return 'Fondeo';
  if (status === 'FONDEADO') return 'Fondeado';
  if (status === 'RECHAZADO') return 'Rechazado';
  return status;
};

const statusClass = (status: string) => {
  if (status === 'PRE_APROBADO') return 'bg-violet-500/15 text-violet-300 border-violet-500/25';
  if (status === 'EN_EVALUACION') return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
  if (status === 'APROBADO') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (status === 'CONTRATO') return 'bg-blue-500/15 text-blue-300 border-blue-500/25';
  if (status === 'GPS') return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25';
  if (['FONDEO', 'FONDEO_PENDIENTE', 'FONDEO_REVISION'].includes(status)) return 'bg-orange-500/15 text-orange-300 border-orange-500/25';
  if (status === 'FONDEADO') return 'bg-teal-500/15 text-teal-300 border-teal-500/25';
  if (status === 'RECHAZADO') return 'bg-rose-500/15 text-rose-300 border-rose-500/25';
  return 'bg-slate-800 text-slate-300 border-slate-700';
};

export const LotesDashboardModal: React.FC<LotesDashboardModalProps> = ({
  isOpen,
  onClose,
  lotes,
  onLoteCreated,
  onLoteUpdated,
  onLoteDeleted,
  canManage = false,
}) => {
  const [expedientes, setExpedientes] = useState<ExpedienteCredito[]>([]);
  const [selectedLoteId, setSelectedLoteId] = useState('');
  const [selectedSubloteId, setSelectedSubloteId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editingLote, setEditingLote] = useState<LoteAuto | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    nombre: '', contacto: '', telefono: '', correo: '', direccion: '', ciudad: '', cuentaClabeDefault: '', bancoDefault: '', parentLoteId: ''
  });
  const [saving, setSaving] = useState(false);

  const mainLotes = useMemo(() => lotes.filter((l) => !l.parentLoteId), [lotes]);
  const sublotes = useMemo(
    () => lotes.filter((l) => l.parentLoteId === selectedLoteId),
    [lotes, selectedLoteId]
  );
  const selectedMainLote = mainLotes.find((l) => l.id === selectedLoteId) || mainLotes[0] || null;

  useEffect(() => {
    if (!isOpen) return;
    if (!selectedLoteId && selectedMainLote) setSelectedLoteId(selectedMainLote.id);
  }, [isOpen, mainLotes, selectedLoteId, selectedMainLote]);

  useEffect(() => {
    if (!selectedSubloteId) return;
    if (!sublotes.some((l) => l.id === selectedSubloteId)) setSelectedSubloteId('');
  }, [sublotes, selectedSubloteId]);

  const loadDashboard = async () => {
    if (!isOpen) return;
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.getExpedientes();
      if (res?.success) {
        setExpedientes(Array.isArray(res.expedientes) ? res.expedientes : []);
      } else {
        setExpedientes([]);
      }
    } catch (error: any) {
      setExpedientes([]);
      setLoadError(error?.message || 'No se pudieron cargar los créditos. La vista de lotes seguirá disponible con la información de cada lote.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadDashboard();
  }, [isOpen]);

  const selectedSublote = lotes.find((l) => l.id === selectedSubloteId) || null;
  const selectedChildIds = sublotes.map((l) => l.id);
  const selectedScopeIds = selectedSubloteId
    ? [selectedSubloteId]
    : (selectedMainLote ? [selectedMainLote.id, ...selectedChildIds] : []);
  const selectedLote = selectedSublote || selectedMainLote || null;
  const getLoteScopeIds = (loteId: string) => {
    const childIds = lotes.filter((l) => l.parentLoteId === loteId).map((l) => l.id);
    return [loteId, ...childIds];
  };

  const visibleExpedientes = useMemo(() => {
    return expedientes.filter((exp) => {
      if (selectedScopeIds.length && !selectedScopeIds.includes(exp.loteId || '')) return false;
      if (statusFilter !== 'TODOS' && exp.estatus !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const text = [
          exp.folio,
          exp.ine?.nombreCompleto,
          exp.autoMarca,
          exp.autoModelo,
          exp.loteNombre,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [expedientes, selectedScopeIds, statusFilter, search]);

  const selectedBase = expedientes.filter((exp) => !selectedScopeIds.length || selectedScopeIds.includes(exp.loteId || ''));
  const selectedFunded = selectedBase.filter((exp) => exp.estatus === 'FONDEADO');
  const selectedApproved = selectedBase.filter((exp) => ['APROBADO', 'CONTRATO', 'GPS', 'FONDEO', 'FONDEO_PENDIENTE', 'FONDEO_REVISION', 'FONDEADO'].includes(exp.estatus));
  const totalAmount = selectedBase.reduce((sum, exp) => sum + (Number(exp.montoFinanciar) || 0), 0);
  const fundedAmount = selectedFunded.reduce((sum, exp) => sum + (Number(exp.montoFinanciar) || 0), 0);

  const statusRows = [
    { label: 'En análisis', key: 'EN_EVALUACION', count: selectedBase.filter((e) => e.estatus === 'EN_EVALUACION').length, color: '#F59E0B' },
    { label: 'Aprobado', key: 'APROBADO', count: selectedBase.filter((e) => e.estatus === 'APROBADO').length, color: '#10B981' },
    { label: 'Contrato', key: 'CONTRATO', count: selectedBase.filter((e) => e.estatus === 'CONTRATO').length, color: '#3B82F6' },
    { label: 'Fondeo', key: 'FONDEO', count: selectedBase.filter((e) => ['GPS', 'FONDEO', 'FONDEO_PENDIENTE', 'FONDEO_REVISION', 'FONDEADO'].includes(e.estatus)).length, color: '#8B5CF6' },
    { label: 'Rechazados', key: 'RECHAZADO', count: selectedBase.filter((e) => e.estatus === 'RECHAZADO').length, color: '#F43F5E' },
  ];
  const statusTotal = Math.max(1, statusRows.reduce((sum, row) => sum + row.count, 0));
  let donutCursor = 0;
  const donut = statusRows.filter((r) => r.count > 0).map((r) => {
    const start = donutCursor / statusTotal * 360;
    donutCursor += r.count;
    const end = donutCursor / statusTotal * 360;
    return r.color + ' ' + start + 'deg ' + end + 'deg';
  }).join(', ');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const monthly = Array.from({ length: 6 }, (_, index) => {
    const raw = currentMonth - (5 - index);
    const year = raw < 0 ? currentYear - 1 : currentYear;
    const month = (raw + 12) % 12;
    const created = selectedBase.filter((exp) => {
      const d = new Date(exp.fechaCreacion);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
    const approved = selectedBase.filter((exp) => {
      const d = new Date(exp.fechaActualizacion || exp.fechaCreacion);
      return d.getFullYear() === year && d.getMonth() === month && ['APROBADO', 'CONTRATO', 'GPS', 'FONDEO', 'FONDEO_PENDIENTE', 'FONDEO_REVISION', 'FONDEADO'].includes(exp.estatus);
    }).length;
    return {
      label: new Date(year, month, 1).toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''),
      created,
      approved,
    };
  });
  const maxMonthly = Math.max(1, ...monthly.map((m) => Math.max(m.created, m.approved)));

  const openCreateMain = () => {
    setEditingLote(null);
    setForm({ nombre: '', contacto: '', telefono: '', correo: '', direccion: '', ciudad: '', cuentaClabeDefault: '', bancoDefault: '', parentLoteId: '' });
    setShowForm(true);
  };

  const openCreateSublote = () => {
    setEditingLote(null);
    setForm({ nombre: '', contacto: '', telefono: '', correo: '', direccion: '', ciudad: '', cuentaClabeDefault: '', bancoDefault: '', parentLoteId: selectedMainLote?.id || '' });
    setShowForm(true);
  };

  const openCreate = () => {
    openCreateMain();
  };

  const openEdit = (lote: LoteAuto) => {
    setEditingLote(lote);
    setForm({
      nombre: lote.nombre || '',
      contacto: lote.contacto || '',
      telefono: lote.telefono || '',
      correo: lote.correo || '',
      direccion: lote.direccion || '',
      ciudad: lote.ciudad || '',
      cuentaClabeDefault: lote.cuentaClabeDefault || '',
      bancoDefault: lote.bancoDefault || '',
      parentLoteId: lote.parentLoteId || '',
    });
    setShowForm(true);
  };

  const saveLote = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.nombre.trim()) return;
    setSaving(true);
    try {
      const res = editingLote
        ? await api.updateLote(editingLote.id, form)
        : await api.createLote(form);
      if (res.success && res.lote) {
        if (editingLote) onLoteUpdated(res.lote);
        else onLoteCreated(res.lote);
        setShowForm(false);
        setEditingLote(null);
      }
    } catch (error: any) {
      alert(error?.message || 'No se pudo guardar el lote.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLote = async (lote: LoteAuto) => {
    if (!confirm('¿Eliminar el lote "' + lote.nombre + '"?')) return;
    try {
      await api.deleteLote(lote.id);
      onLoteDeleted(lote.id);
      if (selectedLoteId === lote.id) setSelectedLoteId('');
    } catch (error: any) {
      alert(error?.message || 'No se pudo eliminar el lote.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className='min-h-[calc(100vh-64px)] bg-[#07142C]'>
      <div className='min-h-full'>
        <header className='sticky top-0 z-20 border-b border-red-500/20 bg-[#08152C]/95 backdrop-blur'>
          <div className='max-w-[1500px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3'>
            <div className='flex items-center gap-3'>
              <div className='w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center'><Building2 className='w-5 h-5 text-red-400' /></div>
              <div><h1 className='text-xl sm:text-2xl font-black text-white'>Panel de Lotes</h1><p className='text-[11px] text-slate-400'>Gestiona tus lotes, sublotes, usuarios, colocación y fondeos desde un solo panel.</p></div>
            </div>
            <div className='flex items-center gap-2'>
              {canManage && <button onClick={openCreate} className='px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black inline-flex items-center gap-1.5'><Plus className='w-4 h-4' /> Nuevo lote</button>}
              <button onClick={loadDashboard} className='p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300' title='Actualizar'><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /></button>
              <button onClick={onClose} className='p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white' title='Cerrar panel'><X className='w-4 h-4' /></button>
            </div>
          </div>
        </header>

        <main className='max-w-[1500px] mx-auto px-4 sm:px-6 py-4 space-y-4'>
          {loadError && <div className='rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-200 text-xs p-3'>{loadError}</div>}

          <section className='rounded-2xl bg-[#0C1C38] border border-slate-800 p-4'>
            <div className='flex items-center justify-between mb-3'>
              <div>
                <h2 className='text-sm font-black text-white'>Mis lotes</h2>
                <p className='text-[10px] text-slate-500'>Selecciona una sucursal para consultar sus créditos, usuarios y fondeos.</p>
              </div>
              <span className='text-[10px] text-slate-500'>{mainLotes.length} lotes principales</span>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2'>
              {mainLotes.map((lote) => {
                const scopeIds = getLoteScopeIds(lote.id);
                const creditCount = expedientes.filter((e) => scopeIds.includes(e.loteId || '')).length;
                const fundedCount = expedientes.filter((e) => scopeIds.includes(e.loteId || '') && e.estatus === 'FONDEADO').length;
                const userCount = [...(lote.usuariosPortal || []), ...sublotes.filter((s) => s.parentLoteId === lote.id).flatMap((s) => s.usuariosPortal || [])].filter((u: any, idx, arr) => u.activo !== false && arr.findIndex((x: any) => x.id === u.id) === idx).length;
                const active = selectedMainLote?.id === lote.id;
                return (
                  <button key={lote.id} onClick={() => { setSelectedLoteId(lote.id); setSelectedSubloteId(''); }} className={'text-left rounded-xl border p-3 transition ' + (active ? 'border-red-500/50 bg-red-500/10 shadow-lg shadow-red-950/20' : 'border-slate-800 bg-slate-950/30 hover:border-slate-700')}>
                    <div className='flex items-center justify-between gap-2'>
                      <div className='min-w-0'>
                        <div className='text-[11px] font-black text-white truncate'>{lote.nombre}</div>
                        <div className='text-[8px] text-slate-500 mt-0.5'>{lote.ciudad || 'Sin ciudad'}</div>
                      </div>
                      <Building2 className={'w-4 h-4 ' + (active ? 'text-red-400' : 'text-slate-500')} />
                    </div>
                    <div className='grid grid-cols-3 gap-2 mt-3'>
                      <div><div className='text-[8px] text-slate-500'>Créditos</div><div className='text-sm font-black text-white'>{creditCount}</div></div>
                      <div><div className='text-[8px] text-slate-500'>Fondeados</div><div className='text-sm font-black text-emerald-300'>{fundedCount}</div></div>
                      <div><div className='text-[8px] text-slate-500'>Usuarios</div><div className='text-sm font-black text-blue-300'>{userCount}</div></div>
                    </div>
                    <div className='mt-2 text-[8px] text-slate-600'>{lotes.filter((x) => x.parentLoteId === lote.id).length} sublotes</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className='grid grid-cols-1 md:grid-cols-4 gap-3'>
            <div className='rounded-2xl bg-[#0E2345] border border-blue-500/20 p-4'><div className='flex justify-between'><div><div className='text-[10px] uppercase text-slate-400'>Lotes principales</div><div className='text-2xl font-black text-white mt-1'>{mainLotes.length}</div><div className='text-[10px] text-emerald-300 mt-1'>Activos</div></div><Building2 className='w-7 h-7 text-blue-300' /></div></div>
            <div className='rounded-2xl bg-[#0E2345] border border-emerald-500/20 p-4'><div className='flex justify-between'><div><div className='text-[10px] uppercase text-slate-400'>Créditos del lote seleccionado</div><div className='text-2xl font-black text-emerald-300 mt-1'>{selectedBase.length}</div><div className='text-[10px] text-slate-500 mt-1'>{selectedSublote?.nombre || selectedMainLote?.nombre || 'Sin selección'}</div></div><CheckCircle2 className='w-7 h-7 text-emerald-300' /></div></div>
            <div className='rounded-2xl bg-[#0E2345] border border-amber-500/20 p-4'><div className='flex justify-between'><div><div className='text-[10px] uppercase text-slate-400'>Monto colocado</div><div className='text-xl font-black text-white mt-1'>{money(totalAmount)}</div><div className='text-[10px] text-emerald-300 mt-1'>Actividad del lote</div></div><CircleDollarSign className='w-7 h-7 text-amber-300' /></div></div>
            <div className='rounded-2xl bg-[#0E2345] border border-teal-500/20 p-4'><div className='flex justify-between'><div><div className='text-[10px] uppercase text-slate-400'>Fondeado</div><div className='text-xl font-black text-teal-300 mt-1'>{money(fundedAmount)}</div><div className='text-[10px] text-slate-500 mt-1'>{selectedFunded.length} créditos</div></div><TrendingUp className='w-7 h-7 text-teal-300' /></div></div>
          </section>

          <section className='rounded-2xl bg-[#0D1B35] border border-slate-800 p-4'>
            <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3'>
              <div>
                <h2 className='text-sm font-black text-white'>Sublotes / Sucursales</h2>
                <p className='text-[10px] text-slate-500'>Los créditos siguen asociados al sublote. Los usuarios continúan ligados a su lote actual.</p>
              </div>
              {canManage && <button onClick={openCreateSublote} className='px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black'><Plus className='w-3.5 h-3.5 inline mr-1' /> Agregar sublote</button>}
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3'>
              {sublotes.length === 0 ? (
                <div className='col-span-full rounded-xl border border-dashed border-slate-700 p-5 text-center text-[10px] text-slate-500'>Este lote principal todavía no tiene sublotes. Agrega Cumbres, San Pedro, Miguel Alemán, etc.</div>
              ) : sublotes.map((sub) => {
                const count = expedientes.filter((e) => e.loteId === sub.id).length;
                const funded = expedientes.filter((e) => e.loteId === sub.id && e.estatus === 'FONDEADO').length;
                const users = sub.usuariosPortal?.filter((u: any) => u.activo !== false) || [];
                return (
                  <button key={sub.id} onClick={() => setSelectedSubloteId(sub.id)} className={'text-left rounded-xl border p-3 ' + (selectedSubloteId === sub.id ? 'border-red-500/40 bg-red-500/10' : 'border-slate-800 bg-slate-950/40')}>
                    <div className='flex items-center justify-between'><span className='text-[11px] font-black text-white truncate'>{sub.nombre}</span><span className='text-[8px] text-slate-500'>{count} créditos</span></div>
                    <div className='grid grid-cols-2 gap-2 mt-3'><div><div className='text-[8px] text-slate-500'>Fondeados</div><div className='text-sm font-black text-emerald-300'>{funded}</div></div><div><div className='text-[8px] text-slate-500'>Usuarios</div><div className='text-sm font-black text-blue-300'>{users.length}</div></div></div>
                    <div className='mt-2 text-[8px] text-slate-500 truncate'>{sub.ciudad || 'Sin ciudad'} · {sub.telefono || 'Sin teléfono'}</div>
                  </button>
                );
              })}
            </div>
          </section>

          <section className='grid grid-cols-1 xl:grid-cols-12 gap-4'>
            <div className='xl:col-span-8 rounded-2xl bg-[#0D1B35] border border-slate-800 p-4'>
              <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-3'>
                <div><h2 className='text-sm font-black text-white'>Comparativo por sucursal</h2><p className='text-[10px] text-slate-500'>Créditos, fondeos y usuarios con acceso por lote.</p></div>
                <div className='flex flex-wrap items-center gap-2'>
                  <label className='text-[9px] uppercase text-slate-500'>Lote principal</label>
                  <select value={selectedLoteId} onChange={(e) => { setSelectedLoteId(e.target.value); setSelectedSubloteId(''); }} className='bg-slate-950 border border-slate-700 rounded-xl text-xs text-white px-3 py-2'>
                    {mainLotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                  <label className='text-[9px] uppercase text-slate-500'>Sublote</label>
                  <select value={selectedSubloteId} onChange={(e) => setSelectedSubloteId(e.target.value)} className='bg-slate-950 border border-slate-700 rounded-xl text-xs text-white px-3 py-2'>
                    <option value=''>Todos los sublotes</option>
                    {sublotes.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                  </select>
                  {canManage && <button onClick={openCreateSublote} className='px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black'><Plus className='w-3 h-3 inline mr-1' /> Nuevo sublote</button>}
                </div>
              </div>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-4'>
                {mainLotes.map((lote) => {
                  const scopeIds = getLoteScopeIds(lote.id);
                  const list = expedientes.filter((e) => scopeIds.includes(e.loteId || ''));
                  const fondeados = list.filter((e) => e.estatus === 'FONDEADO').length;
                  const selected = lote.id === selectedLote?.id;
                  return <button key={lote.id} onClick={() => setSelectedLoteId(lote.id)} className={'text-left rounded-xl border p-3 transition ' + (selected ? 'border-red-500/40 bg-red-500/10' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700')}>
                    <div className='flex items-center justify-between'><span className='text-[11px] font-black text-white truncate'>{lote.nombre}</span><span className='text-[9px] text-slate-500'>{list.length} créditos</span></div>
                    <div className='mt-3 h-2 rounded-full bg-slate-950 overflow-hidden'><div className='h-full bg-red-500 rounded-full' style={{ width: Math.min(100, (list.length / Math.max(1, Math.max(...lotes.map((x) => expedientes.filter((e) => e.loteId === x.id).length)))) * 100) + '%' }} /></div>
                    <div className='mt-2 flex justify-between text-[9px]'><span className='text-slate-500'>Fondeados</span><span className='text-emerald-300 font-bold'>{fondeados}</span></div>
                    <div className='mt-2 flex items-center justify-between text-[9px]'><span className='text-slate-500'>Sublotes</span><span className='text-blue-300 font-bold'>{lotes.filter((l) => l.parentLoteId === lote.id).length}</span></div>
                    <div className='mt-2 pt-2 border-t border-slate-800/70'>
                      <div className='text-[8px] uppercase tracking-wider text-slate-500 mb-1'>Usuarios del lote / sublotes</div>
                      {lote.usuariosPortal?.filter((u: any) => u.activo !== false).length ? (
                        <div className='flex flex-wrap gap-1'>
                          {lote.usuariosPortal.filter((u: any) => u.activo !== false).map((u: any) => (
                            <span key={u.id || u.username} className='inline-flex items-center gap-1 px-1.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 text-[8px]'>
                              <UserRoundCheck className='w-2.5 h-2.5' /> @{u.username}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className='text-[8px] text-slate-600'>Sin usuario portal activo</span>
                      )}
                    </div>
                  </button>;
                })}
              </div>
            </div>

            <div className='xl:col-span-4 rounded-2xl bg-[#0D1B35] border border-slate-800 p-4'>
              <div className='flex items-center justify-between mb-3'><div><h2 className='text-sm font-black text-white'>Desempeño del lote</h2><p className='text-[10px] text-slate-500'>{selectedLote?.nombre || 'Sin selección'}</p></div><BarChart3 className='w-4 h-4 text-red-400' /></div>
              <div className='grid grid-cols-2 gap-2'>
                <div className='rounded-xl bg-slate-950/60 border border-slate-800 p-3'><div className='text-[9px] text-slate-500'>Créditos</div><div className='text-lg font-black text-white mt-1'>{selectedBase.length}</div></div>
                <div className='rounded-xl bg-slate-950/60 border border-slate-800 p-3'><div className='text-[9px] text-slate-500'>Avance</div><div className='text-lg font-black text-emerald-300 mt-1'>{selectedApproved.length}</div></div>
                <div className='rounded-xl bg-slate-950/60 border border-slate-800 p-3'><div className='text-[9px] text-slate-500'>Fondeados</div><div className='text-lg font-black text-teal-300 mt-1'>{selectedFunded.length}</div></div>
                <div className='rounded-xl bg-slate-950/60 border border-slate-800 p-3'><div className='text-[9px] text-slate-500'>Monto fondeado</div><div className='text-sm font-black text-white mt-1'>{money(fundedAmount)}</div></div>
              </div>
              {canManage && selectedLote && <button onClick={() => openEdit(selectedLote)} className='w-full mt-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold inline-flex items-center justify-center gap-2'><Edit3 className='w-3.5 h-3.5' /> Editar información del lote</button>}
            </div>
          </section>

          <section className='grid grid-cols-1 xl:grid-cols-12 gap-4'>
            <div className='xl:col-span-8 rounded-2xl bg-[#0D1B35] border border-slate-800 p-4'>
              <div className='flex items-center justify-between mb-4'><div><h2 className='text-sm font-black text-white'>Actividad por sucursal</h2><p className='text-[10px] text-slate-500'>Operaciones registradas; el inventario físico no está almacenado actualmente en el sistema.</p></div><Car className='w-4 h-4 text-red-400' /></div>
              <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2'>
                
                {lotes.map((lote) => {
                  const count = getLoteScopeIds(lote.id).reduce((sum, id) => sum + expedientes.filter((e) => e.loteId === id).length, 0);
                  return <div key={lote.id} className='rounded-xl bg-slate-950/60 border border-slate-800 p-3'><div className='w-full h-16 rounded-lg bg-gradient-to-br from-slate-800 to-slate-950 flex items-center justify-center'><Car className='w-7 h-7 text-slate-600' /></div><div className='mt-2 text-[10px] font-bold text-white truncate'>{lote.nombre}</div><div className='text-[9px] text-slate-500 mt-1'>{count} expedientes registrados</div></div>;
                })}
              </div>
            </div>

            <div className='xl:col-span-4 rounded-2xl bg-[#0D1B35] border border-slate-800 p-4'>
              <div className='flex items-center justify-between mb-3'><div><h2 className='text-sm font-black text-white'>Estatus de créditos</h2><p className='text-[10px] text-slate-500'>{selectedBase.length} total</p></div><Activity className='w-4 h-4 text-red-400' /></div>
              <div className='flex items-center gap-4'>
                <div className='relative w-28 h-28 rounded-full shrink-0' style={{ background: donut ? 'conic-gradient(' + donut + ')' : '#1e293b' }}><div className='absolute inset-4 rounded-full bg-[#0D1B35] flex items-center justify-center'><span className='text-xl font-black text-white'>{selectedBase.length}</span></div></div>
                <div className='flex-1 space-y-2'>{statusRows.map((row) => <div key={row.label} className='flex justify-between text-[10px]'><span className='text-slate-300 flex items-center gap-2'><span className='w-2 h-2 rounded-full' style={{ backgroundColor: row.color }} />{row.label}</span><span className='font-black text-white'>{row.count}</span></div>)}</div>
              </div>
            </div>
          </section>

          <section className='grid grid-cols-1 xl:grid-cols-12 gap-4'>
            <div className='xl:col-span-8 rounded-2xl bg-[#0D1B35] border border-slate-800 p-4'>
              <div className='flex items-center justify-between'><div><h2 className='text-sm font-black text-white'>Colocación mensual</h2><p className='text-[10px] text-slate-500'>Registrados y créditos con avance.</p></div><BarChart3 className='w-4 h-4 text-red-400' /></div>
              <div className='h-48 mt-4 grid grid-cols-6 items-end gap-2'>{monthly.map((m) => <div key={m.label} className='h-full flex flex-col justify-end'><div className='flex-1 flex items-end justify-center gap-1.5'><div className='w-4 rounded-t bg-blue-500/80' style={{ height: Math.max(7, (m.created / maxMonthly) * 100) + '%' }} /><div className='w-4 rounded-t bg-red-500/80' style={{ height: Math.max(7, (m.approved / maxMonthly) * 100) + '%' }} /></div><div className='text-[9px] text-slate-500 uppercase mt-2'>{m.label}</div></div>)}</div>
              <div className='mt-3 flex gap-4 text-[10px] text-slate-500'><span><span className='inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1' />Colocados</span><span><span className='inline-block w-2 h-2 rounded-sm bg-red-500 mr-1' />Aprobados / avance</span></div>
            </div>

            <div className='xl:col-span-4 rounded-2xl bg-[#0D1B35] border border-slate-800 p-4'>
              <div className='flex items-center justify-between mb-4'><div><h2 className='text-sm font-black text-white'>Datos del lote</h2><p className='text-[10px] text-slate-500'>Información operativa</p></div><Target className='w-4 h-4 text-red-400' /></div>
              {selectedLote ? <div className='space-y-3 text-[10px]'>
                <div className='text-sm font-black text-white'>{selectedLote.nombre}</div>
                <div className='flex gap-2 text-slate-400'><MapPin className='w-3.5 h-3.5 text-red-400 shrink-0' />{selectedLote.direccion || 'Sin dirección'}, {selectedLote.ciudad || 'Sin ciudad'}</div>
                <div className='flex gap-2 text-slate-400'><Phone className='w-3.5 h-3.5 text-emerald-400 shrink-0' />{selectedLote.telefono || 'Sin teléfono'}</div>
                <div className='flex gap-2 text-slate-400'><Mail className='w-3.5 h-3.5 text-blue-400 shrink-0' />{selectedLote.correo || 'Sin correo'}</div>
                <div className='flex gap-2 text-slate-400'><UserRoundCheck className='w-3.5 h-3.5 text-violet-400 shrink-0' />{selectedLote.usuariosPortal?.filter((u: any) => u.activo !== false).length ? 'Acceso portal activo' : 'Sin acceso portal'}</div>
              </div> : <div className='text-xs text-slate-500'>No hay lote seleccionado.</div>}
            </div>
          </section>

          <section className='rounded-2xl bg-[#0D1B35] border border-slate-800 overflow-hidden'>
            <div className='px-4 py-3 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3'>
              <div className='flex items-center gap-2'><FileText className='w-4 h-4 text-red-400' /><div><h2 className='text-sm font-black text-white'>Créditos del lote</h2><p className='text-[10px] text-slate-500'>{selectedLote?.nombre || 'Selecciona un lote'}</p></div></div>
              <div className='flex flex-wrap gap-2'>
                <div className='relative min-w-[220px]'><Search className='w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5' /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Buscar folio, cliente o vehículo...' className='w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-[10px] text-white' /></div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className='py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-[10px] text-white'><option value='TODOS'>Todos los estatus</option><option value='EN_EVALUACION'>En análisis</option><option value='APROBADO'>Aprobado</option><option value='CONTRATO'>Contrato</option><option value='GPS'>GPS</option><option value='FONDEO'>Fondeo</option><option value='FONDEADO'>Fondeado</option><option value='RECHAZADO'>Rechazado</option></select>
                <button onClick={openCreate} className='px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black'><Plus className='w-3.5 h-3.5 inline mr-1' /> Nuevo lote</button>
              </div>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full text-left text-[10px]'>
                <thead className='bg-slate-950/50 text-slate-500 uppercase'><tr><th className='px-4 py-2.5'>Folio</th><th className='px-4 py-2.5'>Cliente</th><th className='px-4 py-2.5'>Vehículo</th><th className='px-4 py-2.5'>Monto</th><th className='px-4 py-2.5'>Estatus</th><th className='px-4 py-2.5'>Fecha</th><th className='px-4 py-2.5'></th></tr></thead>
                <tbody className='divide-y divide-slate-800/80'>
                  {visibleExpedientes.length === 0 ? <tr><td colSpan={7} className='px-4 py-10 text-center text-slate-500'>No hay créditos que coincidan.</td></tr> : visibleExpedientes.map((exp) => (
                    <tr key={exp.id} className='hover:bg-white/[0.02]'>
                      <td className='px-4 py-2.5 text-red-300 font-mono font-bold'>{exp.folio}</td>
                      <td className='px-4 py-2.5 text-white font-bold truncate max-w-[180px]'>{exp.ine?.nombreCompleto || 'Cliente'}</td>
                      <td className='px-4 py-2.5 text-slate-300'>{exp.autoMarca} {exp.autoModelo} {exp.autoAno}</td>
                      <td className='px-4 py-2.5 text-emerald-300 font-black'>{money(Number(exp.montoFinanciar) || 0)}</td>
                      <td className='px-4 py-2.5'><span className={'inline-flex px-2 py-1 rounded-full border text-[9px] font-bold ' + statusClass(exp.estatus)}>{statusLabel(exp.estatus)}</span></td>
                      <td className='px-4 py-2.5 text-slate-500'>{new Date(exp.fechaCreacion).toLocaleDateString('es-MX')}</td>
                      <td className='px-4 py-2.5 text-right'><MoreVertical className='w-3.5 h-3.5 text-slate-600 inline' /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className='text-[10px] text-slate-600 flex items-center gap-2'><CalendarDays className='w-3.5 h-3.5' /> Las gráficas utilizan los créditos almacenados. El inventario físico por vehículo no está registrado actualmente en el modelo de datos.</p>
        </main>
      </div>

      {showForm && (
        <div className='fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4'>
          <div className='w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0B1730] border border-slate-700 shadow-2xl'>
            <div className='px-5 py-4 border-b border-slate-800 flex items-center justify-between'><div><h3 className='text-base font-black text-white'>{editingLote ? 'Editar lote / sublote' : form.parentLoteId ? 'Registrar sublote' : 'Registrar lote principal'}</h3><p className='text-[10px] text-slate-500'>La información se guarda en Supabase mediante el módulo actual.</p></div><button onClick={() => setShowForm(false)} className='p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white'><X className='w-4 h-4' /></button></div>
            <form onSubmit={saveLote} className='p-5 space-y-4'>
              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <select value={form.parentLoteId} onChange={(e) => setForm((v) => ({ ...v, parentLoteId: e.target.value }))} className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white'>
                  <option value=''>Sin lote principal (crear como principal)</option>
                  {mainLotes.filter((l) => l.id !== editingLote?.id).map((l) => <option key={l.id} value={l.id}>Sublote de {l.nombre}</option>)}
                </select>
                <input required value={form.nombre} onChange={(e) => setForm((v) => ({ ...v, nombre: e.target.value }))} placeholder='Nombre del lote *' className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white' />
                <input value={form.contacto} onChange={(e) => setForm((v) => ({ ...v, contacto: e.target.value }))} placeholder='Contacto principal / gerente' className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white' />
                <input value={form.telefono} onChange={(e) => setForm((v) => ({ ...v, telefono: e.target.value }))} placeholder='Teléfono' className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white' />
                <input value={form.correo} onChange={(e) => setForm((v) => ({ ...v, correo: e.target.value }))} placeholder='Correo electrónico' className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white' />
                <input value={form.ciudad} onChange={(e) => setForm((v) => ({ ...v, ciudad: e.target.value }))} placeholder='Ciudad / Estado' className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white' />
                <input value={form.direccion} onChange={(e) => setForm((v) => ({ ...v, direccion: e.target.value }))} placeholder='Dirección' className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white' />
                <input value={form.cuentaClabeDefault} onChange={(e) => setForm((v) => ({ ...v, cuentaClabeDefault: e.target.value }))} placeholder='CLABE para fondeo' className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white font-mono' />
                <input value={form.bancoDefault} onChange={(e) => setForm((v) => ({ ...v, bancoDefault: e.target.value }))} placeholder='Banco' className='bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white' />
              </div>
              <div className='flex justify-end gap-2'><button type='button' onClick={() => setShowForm(false)} className='px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs'>Cancelar</button><button type='submit' disabled={saving} className='px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black'>{saving ? 'Guardando...' : editingLote ? 'Guardar cambios' : 'Crear lote'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
