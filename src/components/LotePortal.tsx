import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  MoreVertical,
  Phone,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import { api } from '../services/api';
import { ChatLoteModal } from './ChatLoteModal';
import { ExpedienteComentariosModal } from './ExpedienteComentariosModal';
import { CotizadorCreditoModal } from './CotizadorCreditoModal';

interface LotePortalProps {
  authUser: { username: string; role: 'lote'; nombre: string; loteId?: string | null };
}

type LoteExpediente = {
  id: string;
  folio: string;
  estatus: string;
  clienteNombre: string;
  telefono: string;
  autoMarca: string;
  autoModelo: string;
  autoAno?: number | null;
  montoFinanciar: number;
  fechaCreacion: string;
  fechaActualizacion?: string;
  fechaFondeo?: string;
  docsSubidos: number;
  docsRequeridos: number;
};

type LotePortalStats = {
  total: number;
  enAnalisis: number;
  preAprobados: number;
  aprobados: number;
  contratos: number;
  gps: number;
  fondeo: number;
  fondeados: number;
  rechazados: number;
  montoActivo: number;
  montoFondeado: number;
};

type LoteInfo = {
  id: string;
  nombre: string;
  contacto?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  parent_lote_id?: string | null;
};

type SubloteInfo = {
  id: string;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  parent_lote_id?: string | null;
  activo?: boolean;
};

const EMPTY_STATS: LotePortalStats = {
  total: 0,
  enAnalisis: 0,
  preAprobados: 0,
  aprobados: 0,
  contratos: 0,
  gps: 0,
  fondeo: 0,
  fondeados: 0,
  rechazados: 0,
  montoActivo: 0,
  montoFondeado: 0,
};

const statusLabel: Record<string, string> = {
  NUEVO: 'Nuevo',
  PRE_APROBADO: 'Pre-aprobado',
  EN_EVALUACION: 'En análisis',
  APROBADO: 'Aprobado',
  CONTRATO: 'Contrato',
  GPS: 'GPS',
  FONDEO: 'Fondeo',
  FONDEO_PENDIENTE: 'Fondeo pendiente',
  FONDEO_REVISION: 'Fondeo en revisión',
  FONDEADO: 'Fondeado',
  RECHAZADO: 'Rechazado',
};

const money = (value: number) => '$' + Math.round(value || 0).toLocaleString('es-MX') + ' MXN';

const statusClass = (value: string) => {
  if (value === 'FONDEADO') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (value === 'RECHAZADO') return 'bg-rose-500/15 text-rose-300 border-rose-500/25';
  if (value === 'APROBADO') return 'bg-blue-500/15 text-blue-300 border-blue-500/25';
  if (value === 'PRE_APROBADO') return 'bg-violet-500/15 text-violet-300 border-violet-500/25';
  if (['FONDEO', 'FONDEO_PENDIENTE', 'FONDEO_REVISION'].includes(value)) return 'bg-orange-500/15 text-orange-300 border-orange-500/25';
  if (value === 'CONTRATO') return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25';
  return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
};

export const LotePortal: React.FC<LotePortalProps> = ({ authUser }) => {
  const [expedientes, setExpedientes] = useState<LoteExpediente[]>([]);
  const [lote, setLote] = useState<LoteInfo | null>(null);
  const [sublotes, setSublotes] = useState<SubloteInfo[]>([]);
  const [serverStats, setServerStats] = useState<LotePortalStats>(EMPTY_STATS);
  const [search, setSearch] = useState('');
  const [estatus, setEstatus] = useState('TODOS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; folio: string } | null>(null);
  const [showNewQuote, setShowNewQuote] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getLoteExpedientes();
      if (!res.success) {
        setError(res.message || 'No se pudieron cargar tus créditos.');
        return;
      }
      setExpedientes(Array.isArray(res.expedientes) ? res.expedientes : []);
      setLote(res.lote || null);
      setSublotes(Array.isArray(res.sublotes) ? res.sublotes : []);
      setServerStats({ ...EMPTY_STATS, ...(res.estadisticas || {}) });
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar tus créditos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expedientes.filter((e) => {
      const matchesStatus = estatus === 'TODOS' || e.estatus === estatus;
      const haystack = [e.folio, e.clienteNombre, e.autoMarca, e.autoModelo, String(e.autoAno || '')].join(' ').toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [expedientes, search, estatus]);

  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    return Array.from({ length: 12 - currentMonth }, (_, index) => {
      const month = currentMonth + index;
      const submitted = expedientes.filter((e) => {
        const d = new Date(e.fechaCreacion);
        return d.getFullYear() === currentYear && d.getMonth() === month;
      });
      const funded = expedientes.filter((e) => {
        const d = e.fechaFondeo ? new Date(e.fechaFondeo) : null;
        return e.estatus === 'FONDEADO' && d && d.getFullYear() === currentYear && d.getMonth() === month;
      });
      return {
        month,
        label: new Date(currentYear, month, 1).toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''),
        submitted: submitted.length,
        funded: funded.length,
        fundedAmount: funded.reduce((sum, e) => sum + (Number(e.montoFinanciar) || 0), 0),
      };
    });
  }, [expedientes]);

  const chartMax = Math.max(1, ...monthlyStats.map((m) => Math.max(m.submitted, m.funded)));
  const groupedMonthly = useMemo(() => {
    const groups: Record<string, LoteExpediente[]> = {};
    filtered.forEach((exp) => {
      const d = new Date(exp.fechaCreacion);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      if (!groups[key]) groups[key] = [];
      groups[key].push(exp);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  const statusRows = [
    { label: 'En análisis', count: serverStats.enAnalisis, color: '#F59E0B' },
    { label: 'Aprobados', count: serverStats.aprobados, color: '#10B981' },
    { label: 'Contrato', count: serverStats.contratos, color: '#3B82F6' },
    { label: 'Fondeo', count: serverStats.fondeo + serverStats.gps, color: '#8B5CF6' },
    { label: 'Rechazados', count: serverStats.rechazados, color: '#F43F5E' },
  ];
  const donutTotal = Math.max(1, statusRows.reduce((sum, item) => sum + item.count, 0));
  let donutCursor = 0;
  const donut = statusRows
    .filter((item) => item.count > 0)
    .map((item) => {
      const start = (donutCursor / donutTotal) * 360;
      donutCursor += item.count;
      const end = (donutCursor / donutTotal) * 360;
      return item.color + ' ' + start + 'deg ' + end + 'deg';
    })
    .join(', ');

  const openSearch = () => {
    document.getElementById('lote-credit-search')?.focus();
  };

  return (
    <div className='min-h-[calc(100vh-64px)] bg-[#07142C] px-3 sm:px-5 lg:px-7 py-4'>
      <div className='max-w-[1500px] mx-auto space-y-4'>
        <section className='rounded-2xl border border-slate-800 bg-[#0A1933] overflow-hidden'>
          <div className='flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-4 sm:p-5'>
            <div className='flex items-center gap-3'>
              <div className='w-11 h-11 rounded-2xl bg-red-500/10 border border-red-500/25 flex items-center justify-center'>
                <Building2 className='w-5 h-5 text-red-400' />
              </div>
              <div>
                <h1 className='text-2xl font-black text-white'>Panel del Lote</h1>
                <p className='text-xs text-slate-400 mt-1'>Gestiona créditos, seguimiento, usuarios y sublotes desde un solo lugar.</p>
                <div className='flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-slate-500'>
                  <span className='text-slate-200 font-semibold'>{lote?.nombre || authUser.nombre}</span>
                  {lote?.ciudad && <span>{lote.ciudad}</span>}
                  <span>Usuario: <strong className='text-slate-300'>{authUser.username}</strong></span>
                </div>
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <button onClick={() => setShowChat(true)} className='inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/15 border border-emerald-500/20 text-emerald-300 text-[11px] font-black hover:bg-emerald-600/25'>
                <MessageCircle className='w-4 h-4' /> Chat CrediMóvil
              </button>
              <button onClick={load} className='inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-[11px] font-bold hover:bg-slate-800'>
                <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /> Actualizar
              </button>
            </div>
          </div>
          {error && <div className='px-4 pb-4'><div className='rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-200 text-xs p-3'>{error}</div></div>}
        </section>

        <section className='grid grid-cols-2 xl:grid-cols-5 gap-2.5'>
          {[
            ['Créditos enviados', serverStats.total, 'text-white', FileText, 'Total del lote'],
            ['En análisis', serverStats.enAnalisis, 'text-amber-300', Clock3, 'Seguimiento activo'],
            ['Pre-aprobados', serverStats.preAprobados, 'text-violet-300', Target, 'Antes de aprobación'],
            ['Aprobados', serverStats.aprobados, 'text-blue-300', CheckCircle2, 'Listos para avanzar'],
            ['Fondeados', serverStats.fondeados, 'text-emerald-300', CircleDollarSign, 'Créditos fondeados'],
          ].map(([label, value, color, Icon, caption]) => {
            const I = Icon as React.ComponentType<{ className?: string }>;
            return (
              <div key={String(label)} className='rounded-2xl border border-slate-800 bg-[#0D1E3B] p-4'>
                <div className='flex items-start justify-between gap-2'>
                  <div>
                    <div className='text-[9px] uppercase tracking-wider text-slate-500'>{label as string}</div>
                    <div className={'text-2xl font-black mt-2 ' + String(color)}>{String(value)}</div>
                    <div className='text-[9px] text-slate-500 mt-1'>{caption as string}</div>
                  </div>
                  <I className={'w-5 h-5 ' + String(color)} />
                </div>
              </div>
            );
          })}
        </section>

        <section className='grid grid-cols-1 xl:grid-cols-12 gap-4'>
          <div className='xl:col-span-8 rounded-2xl border border-slate-800 bg-[#0C1C38] p-4'>
            <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-3'>
              <div>
                <div className='flex items-center gap-2'><BarChart3 className='w-4 h-4 text-red-400' /><h2 className='text-sm font-black text-white'>Control mensual de créditos</h2></div>
                <p className='text-[10px] text-slate-500 mt-1'>Registrados, fondeados y monto fondeado de este lote.</p>
              </div>
              <div className='grid grid-cols-3 gap-2 text-center'>
                <div className='px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800'><div className='text-[8px] uppercase text-slate-500'>Registrados</div><div className='text-sm font-black text-white'>{serverStats.total}</div></div>
                <div className='px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800'><div className='text-[8px] uppercase text-slate-500'>Fondeados</div><div className='text-sm font-black text-emerald-300'>{serverStats.fondeados}</div></div>
                <div className='px-3 py-2 rounded-xl bg-slate-950/50 border border-slate-800'><div className='text-[8px] uppercase text-slate-500'>Monto fondeado</div><div className='text-sm font-black text-emerald-300'>{money(serverStats.montoFondeado)}</div></div>
              </div>
            </div>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4'>
              <div className='rounded-xl bg-slate-950/35 border border-slate-800 p-3'>
                <div className='text-[10px] font-bold text-slate-200 mb-3 inline-flex items-center gap-2'><TrendingUp className='w-3.5 h-3.5 text-red-400' /> Comparativo mensual</div>
                <div className='space-y-2.5'>
                  {monthlyStats.map((m, index) => (
                    <div key={m.month}>
                      <div className='flex justify-between text-[9px] mb-1'><span className='text-slate-500'>{m.label}{index === 0 ? ' · En curso' : ''}</span><span className='font-bold text-slate-300'>{m.submitted} registrados · <span className='text-emerald-300'>{m.funded} fondeados</span></span></div>
                      <div className='h-2 rounded-full bg-slate-950 overflow-hidden'><div className='h-full rounded-full bg-red-500' style={{ width: Math.max(4, (m.submitted / chartMax) * 100) + '%' }} /></div>
                      <div className='h-1 rounded-full bg-slate-950 overflow-hidden mt-1'><div className='h-full rounded-full bg-emerald-500' style={{ width: Math.max(0, (m.funded / chartMax) * 100) + '%' }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className='rounded-xl bg-slate-950/35 border border-slate-800 p-3 overflow-auto'>
                <div className='text-[10px] font-bold text-slate-200 mb-3'>Resumen mensual</div>
                <table className='w-full text-left text-[9px]'>
                  <thead className='text-slate-500 uppercase border-b border-slate-800'><tr><th className='py-2 pr-2'>Mes</th><th className='py-2 pr-2'>Registrados</th><th className='py-2 pr-2'>Fondeados</th><th className='py-2'>Monto</th></tr></thead>
                  <tbody>{monthlyStats.map((m, index) => <tr key={m.month} className='border-b border-slate-800/50 last:border-0'><td className='py-2 pr-2 text-slate-300'>{m.label}{index === 0 ? ' *' : ''}</td><td className='py-2 pr-2 text-white font-bold'>{m.submitted}</td><td className='py-2 pr-2 text-emerald-300 font-bold'>{m.funded}</td><td className='py-2 text-emerald-300 font-bold'>{money(m.fundedAmount)}</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          </div>

          <div className='xl:col-span-4 rounded-2xl border border-slate-800 bg-[#0C1C38] p-4'>
            <div className='flex items-center justify-between mb-4'><div><h2 className='text-sm font-black text-white'>Desempeño del lote</h2><p className='text-[10px] text-slate-500'>{lote?.nombre || authUser.nombre}</p></div><BarChart3 className='w-4 h-4 text-red-400' /></div>
            <div className='grid grid-cols-2 gap-2'>
              <div className='rounded-xl bg-slate-950/50 border border-slate-800 p-3'><div className='text-[8px] text-slate-500'>Créditos</div><div className='text-lg font-black text-white mt-1'>{serverStats.total}</div></div>
              <div className='rounded-xl bg-slate-950/50 border border-slate-800 p-3'><div className='text-[8px] text-slate-500'>Avance</div><div className='text-lg font-black text-blue-300 mt-1'>{serverStats.aprobados + serverStats.contratos + serverStats.gps + serverStats.fondeo + serverStats.fondeados}</div></div>
              <div className='rounded-xl bg-slate-950/50 border border-slate-800 p-3'><div className='text-[8px] text-slate-500'>Fondeados</div><div className='text-lg font-black text-emerald-300 mt-1'>{serverStats.fondeados}</div></div>
              <div className='rounded-xl bg-slate-950/50 border border-slate-800 p-3'><div className='text-[8px] text-slate-500'>Monto colocado</div><div className='text-sm font-black text-white mt-1'>{money(serverStats.montoActivo)}</div></div>
            </div>
            <div className='flex items-center gap-4 mt-4'>
              <div className='relative w-28 h-28 rounded-full shrink-0' style={{ background: donut ? 'conic-gradient(' + donut + ')' : '#1e293b' }}>
                <div className='absolute inset-4 rounded-full bg-[#0C1C38] flex items-center justify-center'><span className='text-xl font-black text-white'>{serverStats.total}</span></div>
              </div>
              <div className='flex-1 space-y-2'>{statusRows.map((row) => <div key={row.label} className='flex justify-between text-[9px]'><span className='flex items-center gap-2 text-slate-300'><span className='w-2 h-2 rounded-full' style={{ backgroundColor: row.color }} />{row.label}</span><span className='font-black text-white'>{row.count}</span></div>)}</div>
            </div>
          </div>
        </section>

        {sublotes.length > 0 && (
          <section className='rounded-2xl border border-slate-800 bg-[#0C1C38] p-4'>
            <div className='flex items-center justify-between mb-3'>
              <div><h2 className='text-sm font-black text-white'>Sublotes / Sucursales</h2><p className='text-[10px] text-slate-500'>Sucursales que dependen del lote principal.</p></div>
              <span className='text-[9px] text-slate-500'>{sublotes.length} sublotes</span>
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2'>
              {sublotes.map((sub) => (
                <div key={sub.id} className='rounded-xl border border-slate-800 bg-slate-950/30 p-3'>
                  <div className='flex items-center justify-between gap-2'><div className='text-[10px] font-black text-white truncate'>{sub.nombre}</div><Building2 className='w-3.5 h-3.5 text-red-400 shrink-0' /></div>
                  <div className='mt-2 text-[8px] text-slate-500'>{sub.ciudad || 'Sin ciudad'}</div>
                  <div className='mt-2 grid grid-cols-2 gap-2 text-[8px]'><div className='text-slate-500'>Teléfono<div className='text-slate-300 mt-1 truncate'>{sub.telefono || '—'}</div></div><div className='text-slate-500'>Correo<div className='text-slate-300 mt-1 truncate'>{sub.correo || '—'}</div></div></div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className='grid grid-cols-1 xl:grid-cols-12 gap-4'>
          <div className='xl:col-span-8 rounded-2xl border border-slate-800 bg-[#0C1C38] overflow-hidden'>
            <div className='px-4 py-3 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3'>
              <div className='flex items-center gap-2'><FileText className='w-4 h-4 text-red-400' /><div><h2 className='text-sm font-black text-white'>Créditos del lote</h2><p className='text-[9px] text-slate-500'>{filtered.length} registros visibles</p></div></div>
              <div className='flex flex-wrap gap-2'>
                <div className='relative min-w-[220px]'><Search className='w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500' /><input id='lote-credit-search' value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Buscar folio, cliente o vehículo...' className='w-full py-2 pl-8 pr-3 bg-slate-950 border border-slate-700 rounded-xl text-[10px] text-white' /></div>
                <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className='py-2 px-3 bg-slate-950 border border-slate-700 rounded-xl text-[10px] text-white'><option value='TODOS'>Todos los estatus</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
              </div>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full text-left text-[10px]'>
                <thead className='bg-slate-950/50 text-slate-500 uppercase'><tr><th className='px-4 py-2.5'>Folio</th><th className='px-4 py-2.5'>Cliente</th><th className='px-4 py-2.5'>Vehículo</th><th className='px-4 py-2.5'>Monto</th><th className='px-4 py-2.5'>Estatus</th><th className='px-4 py-2.5'>Fecha</th><th className='px-4 py-2.5 text-right'>Acciones</th></tr></thead>
                <tbody className='divide-y divide-slate-800/70'>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className='px-4 py-12 text-center text-slate-500'>No hay créditos que coincidan.</td></tr>
                  ) : filtered.map((e) => (
                    <tr key={e.id} className='hover:bg-white/[0.02]'>
                      <td className='px-4 py-3 font-mono text-red-300 font-bold'>{e.folio}</td>
                      <td className='px-4 py-3'><div className='font-bold text-white'>{e.clienteNombre || 'Cliente'}</div><div className='text-[8px] text-slate-500'>{e.telefono || 'Sin teléfono'}</div></td>
                      <td className='px-4 py-3 text-slate-300'>{e.autoMarca} {e.autoModelo} {e.autoAno ? '(' + e.autoAno + ')' : ''}</td>
                      <td className='px-4 py-3 text-emerald-300 font-black'>{money(e.montoFinanciar)}</td>
                      <td className='px-4 py-3'><span className={'inline-flex px-2 py-1 rounded-full border text-[8px] font-bold ' + statusClass(e.estatus)}>{statusLabel[e.estatus] || e.estatus}</span></td>
                      <td className='px-4 py-3 text-slate-500'>{e.fechaCreacion ? new Date(e.fechaCreacion).toLocaleDateString('es-MX') : '—'}</td>
                      <td className='px-4 py-3 text-right'><div className='flex justify-end gap-1'><button onClick={() => setCommentTarget({ id: e.id, folio: e.folio })} className='p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white' title='Comentarios'><MessageCircle className='w-3.5 h-3.5' /></button><button className='p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400' title='Más acciones'><MoreVertical className='w-3.5 h-3.5' /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className='xl:col-span-4 space-y-4'>
            <section className='rounded-2xl border border-slate-800 bg-[#0C1C38] p-4'>
              <div className='flex items-center justify-between mb-3'><div><h2 className='text-sm font-black text-white'>Datos del lote</h2><p className='text-[9px] text-slate-500'>Información operativa</p></div><Target className='w-4 h-4 text-red-400' /></div>
              {lote ? <div className='space-y-3 text-[9px]'>
                <div className='text-sm font-black text-white'>{lote.nombre}</div>
                <div className='flex gap-2 text-slate-400'><MapPin className='w-3.5 h-3.5 text-red-400 shrink-0' /><span>{lote.direccion || 'Sin dirección'}, {lote.ciudad || 'Sin ciudad'}</span></div>
                <div className='flex gap-2 text-slate-400'><Phone className='w-3.5 h-3.5 text-emerald-400 shrink-0' />{lote.telefono || 'Sin teléfono'}</div>
                <div className='flex gap-2 text-slate-400'><Mail className='w-3.5 h-3.5 text-blue-400 shrink-0' />{lote.correo || 'Sin correo'}</div>
                <div className='flex gap-2 text-slate-400'><Users className='w-3.5 h-3.5 text-violet-400 shrink-0' />Usuario portal: <span className='text-slate-200'>{authUser.username}</span></div>
              </div> : <div className='text-[10px] text-slate-500'>No se pudo cargar la información del lote.</div>}
            </section>

            <section className='rounded-2xl border border-slate-800 bg-[#0C1C38] p-4'>
              <div className='flex items-center justify-between mb-3'><div><h2 className='text-sm font-black text-white'>Acciones rápidas</h2><p className='text-[9px] text-slate-500'>Accesos frecuentes</p></div><Activity className='w-4 h-4 text-red-400' /></div>
              <div className='grid grid-cols-2 gap-2'>
                <button onClick={() => setShowNewQuote(true)} className='rounded-xl bg-blue-600/80 hover:bg-blue-500 text-white py-3 text-[10px] font-black inline-flex items-center justify-center gap-2'><Calculator className='w-4 h-4' /> Nuevo crédito</button>
                <button onClick={() => setShowChat(true)} className='rounded-xl bg-emerald-600/80 hover:bg-emerald-500 text-white py-3 text-[10px] font-black inline-flex items-center justify-center gap-2'><Users className='w-4 h-4' /> Buscar apoyo</button>
                <button onClick={openSearch} className='rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white py-3 text-[10px] font-black inline-flex items-center justify-center gap-2'><Search className='w-4 h-4' /> Buscar crédito</button>
                <button onClick={load} className='rounded-xl bg-violet-600/80 hover:bg-violet-500 text-white py-3 text-[10px] font-black inline-flex items-center justify-center gap-2'><RefreshCw className='w-4 h-4' /> Actualizar</button>
              </div>
            </section>

            <section className='rounded-2xl border border-slate-800 bg-[#0C1C38] p-4'>
              <div className='flex items-center justify-between mb-3'><div><h2 className='text-sm font-black text-white'>Resumen de cartera</h2><p className='text-[9px] text-slate-500'>Valor actual del lote</p></div><CircleDollarSign className='w-4 h-4 text-emerald-300' /></div>
              <div className='text-2xl font-black text-emerald-300'>{money(serverStats.montoActivo)}</div>
              <div className='mt-2 text-[9px] text-slate-500'>Monto fondeado: <strong className='text-slate-300'>{money(serverStats.montoFondeado)}</strong></div>
            </section>
          </div>
        </section>
      </div>

      <ChatLoteModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        authUser={authUser}
        lotes={lote ? [lote as any] : []}
        initialLoteId={authUser.loteId}
      />

      {showNewQuote && (
        <CotizadorCreditoModal
          expediente={{
            id: 'cotizacion-' + Date.now(),
            folio: 'COTIZACIÓN',
            pinFondeo: '',
            fechaCreacion: new Date().toISOString(),
            fechaActualizacion: new Date().toISOString(),
            estatus: 'NUEVO',
            ine: {
              nombre: '',
              primerApellido: '',
              segundoApellido: '',
              nombreCompleto: '',
              curp: '',
              rfc: '',
              fechaNacimiento: '',
              sexo: '',
              domicilio: { calle: '', numExterior: '', numInterior: '', colonia: '', codigoPostal: '', municipio: '', estado: '', domicilioCompleto: '' },
              vigencia: { emision: '', vigenciaHasta: '', seccion: '' },
            },
            telefono: '',
            correo: '',
            loteNombre: lote?.nombre || authUser.nombre,
            autoMarca: '',
            autoModelo: '',
            autoAno: new Date().getFullYear(),
            autoPrecio: 0,
            esVehiculoLegalizado: false,
            enganche: 0,
            montoFinanciar: 0,
            plazoMeses: 48,
            documentosFondeo: [],
          } as any}
          onClose={() => setShowNewQuote(false)}
          customerMode
          showRate={false}
        />
      )}

      {commentTarget && (
        <ExpedienteComentariosModal
          isOpen={Boolean(commentTarget)}
          onClose={() => setCommentTarget(null)}
          expedienteId={commentTarget.id}
          folio={commentTarget.folio}
          authUser={authUser}
        />
      )}
    </div>
  );
};
