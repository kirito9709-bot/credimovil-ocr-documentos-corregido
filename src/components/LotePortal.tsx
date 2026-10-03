import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Car, Clock3, FileText, RefreshCw, Search, ShieldCheck, Wallet } from 'lucide-react';
import { api } from '../services/api';

interface LotePortalProps {
  authUser: { username: string; role: 'lote'; nombre: string; loteId?: string | null };
}

type LoteExpediente = {
  id: string; folio: string; estatus: string; clienteNombre: string; telefono: string;
  autoMarca: string; autoModelo: string; autoAno?: number | null; montoFinanciar: number;
  fechaCreacion: string; fechaActualizacion?: string; docsSubidos: number; docsRequeridos: number;
};

const statusLabel: Record<string, string> = {
  NUEVO: 'Nuevo', PRE_APROBADO: 'Pre-aprobado', EN_EVALUACION: 'En análisis',
  APROBADO: 'Aprobado', CONTRATO: 'Contrato', GPS: 'GPS', FONDEO: 'Fondeo',
  FONDEO_PENDIENTE: 'Fondeo pendiente', FONDEO_REVISION: 'Fondeo en revisión',
  FONDEADO: 'Fondeado', RECHAZADO: 'Rechazado',
};

export const LotePortal: React.FC<LotePortalProps> = ({ authUser }) => {
  const [expedientes, setExpedientes] = useState<LoteExpediente[]>([]);
  const [search, setSearch] = useState('');
  const [estatus, setEstatus] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await api.getLoteExpedientes();
      if (res.success) setExpedientes(res.expedientes || []);
      else setError(res.message || 'No se pudieron cargar tus créditos.');
    } catch (err: any) { setError(err.message || 'No se pudieron cargar tus créditos.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expedientes.filter((e) => {
      const matchesStatus = estatus === 'TODOS' || e.estatus === estatus;
      const haystack = (e.folio + ' ' + e.clienteNombre + ' ' + e.autoMarca + ' ' + e.autoModelo).toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [expedientes, search, estatus]);

  const stats = {
    total: expedientes.length,
    analisis: expedientes.filter((e) => e.estatus === 'EN_EVALUACION' || e.estatus === 'NUEVO').length,
    aprobados: expedientes.filter((e) => e.estatus === 'APROBADO' || e.estatus === 'PRE_APROBADO').length,
    fondeados: expedientes.filter((e) => e.estatus === 'FONDEADO').length,
    monto: expedientes.filter((e) => e.estatus !== 'RECHAZADO').reduce((sum, e) => sum + (Number(e.montoFinanciar) || 0), 0),
  };

  const statusClass = (value: string) => {
    if (value === 'FONDEADO') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    if (value === 'RECHAZADO') return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
    if (value === 'APROBADO' || value === 'PRE_APROBADO') return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
    return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  };

  return (
    <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6'>
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <div className='flex items-center gap-2'><Building2 className='w-6 h-6 text-red-400' /><h1 className='text-2xl sm:text-3xl font-black text-white'>Portal del Lote</h1></div>
          <p className='text-sm text-slate-400 mt-1'>Sesión: <strong className='text-slate-200'>{authUser.nombre}</strong> • Control de créditos enviados por tu lote</p>
        </div>
        <button onClick={load} className='self-start lg:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-slate-800'>
          <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /> Actualizar
        </button>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><span className='text-[11px] uppercase tracking-wider text-slate-500'>Créditos enviados</span><div className='text-2xl font-black text-white mt-1'>{stats.total}</div></div>
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><span className='text-[11px] uppercase tracking-wider text-slate-500'>En análisis</span><div className='text-2xl font-black text-amber-400 mt-1'>{stats.analisis}</div></div>
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><span className='text-[11px] uppercase tracking-wider text-slate-500'>Aprobados</span><div className='text-2xl font-black text-blue-400 mt-1'>{stats.aprobados}</div></div>
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><span className='text-[11px] uppercase tracking-wider text-slate-500'>Fondeados</span><div className='text-2xl font-black text-emerald-400 mt-1'>{stats.fondeados}</div></div>
      </div>

      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-3'>
        <div className='relative flex-1'><Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500' /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Buscar por folio, cliente o vehículo...' className='w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-red-500' /></div>
        <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className='lg:w-64 py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none'>
          <option value='TODOS'>Todos los estatus</option>
          {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {error && <div className='p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 text-sm'>{error}</div>}

      <div className='bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden'>
        <div className='px-5 py-4 border-b border-slate-800 flex items-center justify-between'><div className='flex items-center gap-2 text-sm font-bold text-white'><FileText className='w-4 h-4 text-red-400' /> Mis créditos</div><span className='text-xs text-slate-500'>{filtered.length} registros</span></div>
        {filtered.length === 0 ? (
          <div className='p-12 text-center'><ShieldCheck className='w-10 h-10 text-slate-700 mx-auto mb-3' /><p className='text-sm font-semibold text-slate-300'>No hay créditos para mostrar</p><p className='text-xs text-slate-500 mt-1'>Cuando un crédito de este lote sea capturado, aparecerá aquí.</p></div>
        ) : (
          <div className='divide-y divide-slate-800/80'>
            {filtered.map((e) => (
              <div key={e.id} className='p-5 hover:bg-slate-950/50 transition'>
                <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'><span className='font-mono text-red-400 font-black'>{e.folio}</span><span className={'px-2 py-0.5 rounded-full border text-[10px] font-bold ' + statusClass(e.estatus)}>{statusLabel[e.estatus] || e.estatus}</span></div>
                    <div className='mt-2 text-white font-bold truncate'>{e.clienteNombre || 'Cliente sin nombre'}</div>
                    <div className='mt-1 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1'>
                      <span className='inline-flex items-center gap-1.5'><Car className='w-3.5 h-3.5' />{e.autoMarca} {e.autoModelo} {e.autoAno ? '(' + e.autoAno + ')' : ''}</span>
                      <span className='inline-flex items-center gap-1.5'><Clock3 className='w-3.5 h-3.5' />{e.fechaCreacion ? new Date(e.fechaCreacion).toLocaleDateString('es-MX') : '—'}</span>
                    </div>
                  </div>
                  <div className='flex items-center gap-8 shrink-0'>
                    <div className='text-right'><div className='text-[10px] text-slate-500 uppercase tracking-wider'>Monto a financiar</div><div className='text-lg font-black text-emerald-400'>${(e.montoFinanciar || 0).toLocaleString('es-MX')} MXN</div></div>
                    <div className='text-right hidden sm:block'><div className='text-[10px] text-slate-500 uppercase tracking-wider'>Documentos</div><div className='text-sm font-bold text-slate-200'>{e.docsSubidos} / {e.docsRequeridos}</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className='bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400'><Wallet className='w-4 h-4 text-emerald-400 shrink-0' /><span>Monto total actualmente en cartera: <strong className='text-white'>${stats.monto.toLocaleString('es-MX')} MXN</strong>.</span></div>
    </div>
  );
};
