import React, { useMemo } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  Car,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Eye,
  FileText,
  MoreVertical,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Target,
  UserRound,
  XCircle,
} from 'lucide-react';
import { ExpedienteCredito, LoteAuto } from '../types';

interface DashboardStats {
  total: number;
  nuevos: number;
  preAprobados: number;
  enEvaluacion: number;
  aprobados: number;
  contratos: number;
  gps: number;
  fondeo: number;
  fondeoRevision: number;
  fondeados: number;
  montoTotalFinanciado: number;
}

interface Props {
  expedientes: ExpedienteCredito[];
  allExpedientes: ExpedienteCredito[];
  stats: DashboardStats;
  loading: boolean;
  lotes: LoteAuto[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedEstatus: string;
  setSelectedEstatus: (value: string) => void;
  selectedLoteId: string;
  setSelectedLoteId: (value: string) => void;
  loadData: () => void;
  onGoToCaptura: () => void;
  onOpenExpediente: (expediente: ExpedienteCredito) => void;
  onOpenPrint: (expediente: ExpedienteCredito) => void;
}

const statusLabel = (estatus: string) => {
  if (estatus === 'EN_EVALUACION') return 'En análisis';
  if (estatus === 'PRE_APROBADO') return 'Pre-aprobado';
  if (estatus === 'FONDEO_PENDIENTE' || estatus === 'FONDEO_REVISION') return 'Fondeo';
  if (estatus === 'FONDEADO') return 'Fondeado';
  if (estatus === 'RECHAZADO') return 'Rechazado';
  if (estatus === 'APROBADO') return 'Aprobado';
  return estatus;
};

const statusClass = (estatus: string) => {
  if (estatus === 'PRE_APROBADO') return 'bg-violet-500/15 text-violet-300 border-violet-500/25';
  if (estatus === 'EN_EVALUACION') return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
  if (estatus === 'APROBADO') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (estatus === 'CONTRATO') return 'bg-blue-500/15 text-blue-300 border-blue-500/25';
  if (estatus === 'GPS') return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/25';
  if (estatus === 'FONDEO' || estatus === 'FONDEO_PENDIENTE' || estatus === 'FONDEO_REVISION') return 'bg-orange-500/15 text-orange-300 border-orange-500/25';
  if (estatus === 'FONDEADO') return 'bg-teal-500/15 text-teal-300 border-teal-500/25';
  if (estatus === 'RECHAZADO') return 'bg-rose-500/15 text-rose-300 border-rose-500/25';
  return 'bg-slate-800 text-slate-300 border-slate-700';
};

const dateLabel = (value: string) => {
  try {
    return new Date(value).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '—';
  }
};

export const AdvisorDashboard: React.FC<Props> = ({
  expedientes,
  allExpedientes,
  stats,
  loading,
  lotes,
  searchQuery,
  setSearchQuery,
  selectedEstatus,
  setSelectedEstatus,
  selectedLoteId,
  setSelectedLoteId,
  loadData,
  onGoToCaptura,
  onOpenExpediente,
  onOpenPrint,
}) => {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const monthLabel = now.toLocaleDateString('es-MX', { month: '2-digit', year: 'numeric' });

  const recent = useMemo(
    () =>
      [...expedientes]
        .sort((a, b) => new Date(b.fechaActualizacion || b.fechaCreacion).getTime() - new Date(a.fechaActualizacion || a.fechaCreacion).getTime())
        .slice(0, 6),
    [expedientes]
  );

  const rejectedCount = allExpedientes.filter((item) => item.estatus === 'RECHAZADO').length;
  const statusRows = [
    { label: 'Pre análisis', count: stats.preAprobados, color: '#A78BFA' },
    { label: 'En análisis', count: stats.enEvaluacion, color: '#F59E0B' },
    { label: 'Aprobado', count: stats.aprobados, color: '#10B981' },
    { label: 'Contrato', count: stats.contratos, color: '#3B82F6' },
    { label: 'GPS', count: stats.gps, color: '#06B6D4' },
    { label: 'Fondeo', count: stats.fondeo, color: '#F59E0B' },
    { label: 'Rechazado', count: rejectedCount, color: '#F43F5E' },
  ];
  const statusTotal = Math.max(1, statusRows.reduce((sum, row) => sum + row.count, 0));

  const monthCreated = allExpedientes.filter((item) => {
    const d = new Date(item.fechaCreacion);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });
  const monthApproved = allExpedientes.filter((item) => {
    const d = new Date(item.fechaActualizacion || item.fechaCreacion);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth && ['APROBADO', 'CONTRATO', 'GPS', 'FONDEO', 'FONDEO_PENDIENTE', 'FONDEO_REVISION', 'FONDEADO'].includes(item.estatus);
  });
  const monthAmount = monthCreated.reduce((sum, item) => sum + (Number(item.montoFinanciar) || 0), 0);

  const monthly = Array.from({ length: 6 }, (_, index) => {
    const raw = currentMonth - (5 - index);
    const year = raw < 0 ? currentYear - 1 : currentYear;
    const month = (raw + 12) % 12;
    const created = allExpedientes.filter((item) => {
      const d = new Date(item.fechaCreacion);
      return d.getFullYear() === year && d.getMonth() === month;
    }).length;
    const approved = allExpedientes.filter((item) => {
      const d = new Date(item.fechaActualizacion || item.fechaCreacion);
      return d.getFullYear() === year && d.getMonth() === month && ['APROBADO', 'CONTRATO', 'GPS', 'FONDEO', 'FONDEO_PENDIENTE', 'FONDEO_REVISION', 'FONDEADO'].includes(item.estatus);
    }).length;
    return { label: new Date(year, month, 1).toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''), created, approved };
  });
  const maxMonthly = Math.max(1, ...monthly.map((item) => Math.max(item.created, item.approved)));

  const pending = recent.filter((item) => ['NUEVO', 'EN_EVALUACION', 'APROBADO', 'CONTRATO', 'GPS', 'FONDEO', 'FONDEO_PENDIENTE', 'FONDEO_REVISION'].includes(item.estatus)).slice(0, 5);

  const kpis = [
    { label: 'Mis Créditos', value: stats.total, caption: 'Total de expedientes', icon: Car, tone: 'blue' },
    { label: 'En Análisis', value: stats.enEvaluacion, caption: 'Evaluación activa', icon: Clock, tone: 'amber' },
    { label: 'Aprobados', value: stats.aprobados, caption: 'Listos para avanzar', icon: CheckCircle2, tone: 'emerald' },
    { label: 'En Fondeo', value: stats.fondeo, caption: 'Seguimiento de fondeo', icon: CircleDollarSign, tone: 'orange' },
    { label: 'Rechazados', value: rejectedCount, caption: 'Casos rechazados', icon: XCircle, tone: 'rose' },
  ];

  const toneMap: Record<string, { text: string; bg: string; border: string }> = {
    blue: { text: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    amber: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    orange: { text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
    rose: { text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  };

  const donut = (() => {
    let current = 0;
    return statusRows.filter((row) => row.count > 0).map((row) => {
      const start = (current / statusTotal) * 360;
      current += row.count;
      const end = (current / statusTotal) * 360;
      return row.color + ' ' + start + 'deg ' + end + 'deg';
    }).join(', ');
  })();

  const periodText = '01/' + monthLabel.split('/')[0] + '/' + monthLabel.split('/')[1] + ' - ' + new Date(currentYear, currentMonth + 1, 0).getDate() + '/' + monthLabel.split('/')[0] + '/' + monthLabel.split('/')[1];

  return (
    <div className='w-full max-w-[1500px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5'>
      <div className='space-y-4'>
        <section className='flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <div className='w-11 h-11 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center'><UserRound className='w-5 h-5 text-red-400' /></div>
            <div><h1 className='text-2xl sm:text-3xl font-black text-white'>Panel del Asesor</h1><p className='text-xs sm:text-sm text-slate-400 mt-0.5'>Resumen de tu actividad, seguimiento y estatus de créditos.</p></div>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <div className='inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300'><CalendarDays className='w-4 h-4 text-slate-500' /><span>{periodText}</span></div>
            <button onClick={onGoToCaptura} className='py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black inline-flex items-center gap-2'><Plus className='w-4 h-4' /> Nuevo Expediente</button>
            <button onClick={loadData} className='p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800' title='Actualizar'><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /></button>
          </div>
        </section>

        <section className='grid grid-cols-2 xl:grid-cols-5 gap-2.5'>
          {kpis.map((card) => {
            const tone = toneMap[card.tone];
            const Icon = card.icon;
            return <div key={card.label} className={'rounded-2xl border p-4 ' + tone.border + ' ' + tone.bg}><div className='flex items-start justify-between gap-3'><div><div className='text-[10px] font-bold text-slate-400 uppercase tracking-wider'>{card.label}</div><div className={'text-2xl font-black mt-2 ' + tone.text}>{card.value}</div><div className='text-[10px] text-slate-500 mt-1'>{card.caption}</div></div><div className='w-10 h-10 rounded-xl bg-slate-950/30 border border-white/5 flex items-center justify-center'><Icon className={'w-5 h-5 ' + tone.text} /></div></div></div>;
          })}
        </section>

        <section className='grid grid-cols-1 xl:grid-cols-12 gap-4'>
          <div className='xl:col-span-8 rounded-2xl border border-slate-800 bg-[#0D1830] overflow-hidden'>
            <div className='px-4 py-4 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3'><div className='flex items-center gap-2'><FileText className='w-4 h-4 text-red-400' /><h2 className='text-sm font-black text-white'>Mis Créditos Recientes</h2></div><div className='flex gap-2'><button onClick={onGoToCaptura} className='px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-black'><Plus className='w-3.5 h-3.5 inline mr-1' /> Nuevo Expediente</button><button onClick={() => setSelectedEstatus('TODOS')} className='px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-[11px] font-bold'>Ver todos</button></div></div>
            <div className='hidden md:block overflow-x-auto'>
              <table className='w-full text-left text-[11px]'><thead className='bg-slate-950/40 text-[9px] uppercase tracking-wider text-slate-500'><tr><th className='px-4 py-3'>Folio</th><th className='px-4 py-3'>Cliente</th><th className='px-4 py-3'>Vehículo</th><th className='px-4 py-3'>Monto</th><th className='px-4 py-3'>Estatus</th><th className='px-4 py-3'>Fecha</th><th className='px-4 py-3 text-right'>Acciones</th></tr></thead>
                <tbody className='divide-y divide-slate-800/80'>
                  {recent.length === 0 ? <tr><td colSpan={7} className='px-4 py-12 text-center text-slate-500'>No hay créditos registrados.</td></tr> : recent.map((exp) => (
                    <tr key={exp.id} className='hover:bg-white/[0.03] cursor-pointer' onClick={() => onOpenExpediente(exp)}>
                      <td className='px-4 py-3 font-mono text-red-300 font-bold'>{exp.folio}</td>
                      <td className='px-4 py-3 max-w-[180px]'><div className='font-bold text-white truncate'>{exp.ine?.nombreCompleto || exp.ine?.nombre || 'Sin nombre'}</div><div className='text-[9px] text-slate-500'>{exp.loteNombre || 'Sin lote'}</div></td>
                      <td className='px-4 py-3'><div className='text-slate-200 truncate max-w-[140px]'>{exp.autoMarca} {exp.autoModelo}</div><div className='text-[9px] text-slate-500'>{exp.autoAno}</div></td>
                      <td className='px-4 py-3 font-black text-emerald-300'><span>$</span>{(exp.montoFinanciar || 0).toLocaleString('es-MX')}</td>
                      <td className='px-4 py-3'><span className={'inline-flex px-2 py-1 rounded-full text-[9px] font-bold border ' + statusClass(exp.estatus)}>{statusLabel(exp.estatus)}</span></td>
                      <td className='px-4 py-3 text-slate-400'>{dateLabel(exp.fechaActualizacion || exp.fechaCreacion)}</td>
                      <td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}><div className='flex justify-end gap-1'><button onClick={() => onOpenExpediente(exp)} className='p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'><Eye className='w-3.5 h-3.5' /></button><button onClick={() => onOpenPrint(exp)} className='p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-red-300 hover:text-white'><Printer className='w-3.5 h-3.5' /></button><button className='p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'><MoreVertical className='w-3.5 h-3.5' /></button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className='md:hidden divide-y divide-slate-800'>
              {recent.map((exp) => <button key={exp.id} onClick={() => onOpenExpediente(exp)} className='w-full p-4 text-left hover:bg-white/[0.02]'><div className='flex items-start justify-between gap-3'><div><div className='font-mono text-red-300 font-black text-xs'>{exp.folio}</div><div className='text-sm font-bold text-white mt-1'>{exp.ine?.nombreCompleto || exp.ine?.nombre || 'Sin nombre'}</div></div><div className='text-right text-emerald-300 font-black text-sm'><span>$</span>{(exp.montoFinanciar || 0).toLocaleString('es-MX')}</div></div><div className='text-[10px] text-slate-500 mt-1'>{exp.autoMarca} {exp.autoModelo} · {exp.autoAno}</div></button>)}
            </div>
          </div>

          <div className='xl:col-span-4 space-y-4'>
            <div className='rounded-2xl border border-slate-800 bg-[#0D1830] p-4'><div className='flex items-center justify-between mb-4'><div><h2 className='text-sm font-black text-white'>Estatus de tus Créditos</h2><p className='text-[10px] text-slate-500'>{stats.total} total</p></div><Activity className='w-4 h-4 text-red-400' /></div><div className='flex items-center gap-4'><div className='relative w-28 h-28 shrink-0 rounded-full' style={{ background: donut ? 'conic-gradient(' + donut + ')' : '#1e293b' }}><div className='absolute inset-4 rounded-full bg-[#0D1830] flex items-center justify-center'><span className='text-xl font-black text-white'>{stats.total}</span></div></div><div className='flex-1 space-y-2'>{statusRows.map((row) => <div key={row.label} className='flex items-center justify-between gap-2'><div className='flex items-center gap-2 text-[10px] text-slate-300'><span className='w-2 h-2 rounded-full' style={{ backgroundColor: row.color }} />{row.label}</div><span className='text-[10px] text-white font-black'>{row.count}</span></div>)}</div></div></div>

            <div className='rounded-2xl border border-slate-800 bg-[#0D1830] overflow-hidden'><div className='px-4 py-3 border-b border-slate-800 flex items-center justify-between'><div className='flex items-center gap-2'><Bell className='w-4 h-4 text-red-400' /><h2 className='text-sm font-black text-white'>Actividades Pendientes</h2><span className='min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[9px] font-black flex items-center justify-center'>{pending.length}</span></div><button onClick={() => setSelectedEstatus('TODOS')} className='text-[10px] text-slate-400 hover:text-white'>Ver todas</button></div><div className='divide-y divide-slate-800'>{pending.length === 0 ? <div className='px-4 py-6 text-center text-[10px] text-slate-500'>Sin pendientes.</div> : pending.map((item, index) => <button key={item.id} onClick={() => onOpenExpediente(item)} className='w-full px-4 py-3 flex items-center gap-3 hover:bg-white/[0.03] text-left'><div className='w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center'><FileText className='w-4 h-4 text-slate-400' /></div><div className='min-w-0 flex-1'><div className='text-[10px] text-white font-bold truncate'>{item.folio} · {item.ine?.nombreCompleto || 'Cliente'}</div><div className='text-[9px] text-slate-500 mt-0.5'>{item.estatus === 'NUEVO' ? 'Revisar documentos' : item.estatus === 'EN_EVALUACION' ? 'Revisar análisis' : item.estatus === 'APROBADO' ? 'Enviar a fondeo' : item.estatus === 'CONTRATO' ? 'Validar contrato' : item.estatus === 'GPS' ? 'Validar GPS' : 'Dar seguimiento'}</div></div><span className='text-[9px] text-slate-500'>{index === 0 ? 'Hoy' : 'Próx.'}</span></button>)}</div></div>
          </div>
        </section>

        <section className='grid grid-cols-1 xl:grid-cols-12 gap-4'>
          <div className='xl:col-span-7 rounded-2xl border border-slate-800 bg-[#0D1830] p-4 sm:p-5'><div className='flex items-center justify-between'><div><h2 className='text-sm font-black text-white'>Colocación Mensual</h2><p className='text-[10px] text-slate-500'>Créditos registrados vs. avance</p></div><BarChart3 className='w-5 h-5 text-red-400' /></div><div className='h-48 mt-4 grid grid-cols-6 items-end gap-2'>{monthly.map((item) => <div key={item.label} className='h-full flex flex-col justify-end'><div className='flex-1 flex items-end justify-center gap-1'><div className='w-4 rounded-t bg-blue-500/80' style={{ height: Math.max(8, (item.created / maxMonthly) * 100) + '%' }} /><div className='w-4 rounded-t bg-red-500/80' style={{ height: Math.max(8, (item.approved / maxMonthly) * 100) + '%' }} /></div><div className='text-[9px] text-slate-500 text-center uppercase mt-2'>{item.label}</div></div>)}</div><div className='mt-3 flex flex-wrap items-center gap-4 text-[10px] text-slate-500'><span><span className='inline-block w-2 h-2 rounded-sm bg-blue-500 mr-1' />Registrados</span><span><span className='inline-block w-2 h-2 rounded-sm bg-red-500 mr-1' />Avance</span><span className='ml-auto'>Monto del mes: <strong className='text-slate-300'><span>$</span>{monthAmount.toLocaleString('es-MX')} MXN</strong></span></div></div>

          <div className='xl:col-span-5 rounded-2xl border border-slate-800 bg-[#0D1830] p-4 sm:p-5'><div className='flex items-center justify-between mb-4'><div><h2 className='text-sm font-black text-white'>Metas del Mes</h2><p className='text-[10px] text-slate-500'>Actividad actual</p></div><Target className='w-5 h-5 text-red-400' /></div><div className='space-y-4'><div><div className='flex items-center justify-between text-[10px] mb-1.5'><span className='text-slate-400'>Créditos registrados</span><span className='text-white font-bold'>{monthCreated.length}</span></div><div className='h-2.5 rounded-full bg-slate-950 overflow-hidden'><div className='h-full rounded-full bg-emerald-400' style={{ width: Math.min(100, (monthCreated.length / 20) * 100) + '%' }} /></div></div><div><div className='flex items-center justify-between text-[10px] mb-1.5'><span className='text-slate-400'>Créditos con avance</span><span className='text-white font-bold'>{monthApproved.length}</span></div><div className='h-2.5 rounded-full bg-slate-950 overflow-hidden'><div className='h-full rounded-full bg-red-500' style={{ width: Math.min(100, (monthApproved.length / 20) * 100) + '%' }} /></div></div><div className='grid grid-cols-2 gap-2'><div className='rounded-xl bg-slate-950/50 border border-slate-800 p-3'><div className='text-[9px] text-slate-500 uppercase'>Monto del mes</div><div className='text-sm font-black text-white mt-1'><span>$</span>{monthAmount.toLocaleString('es-MX')}</div></div><div className='rounded-xl bg-slate-950/50 border border-slate-800 p-3'><div className='text-[9px] text-slate-500 uppercase'>Fondeados</div><div className='text-sm font-black text-emerald-300 mt-1'>{stats.fondeados}</div></div></div><div className='rounded-xl bg-slate-950/60 border border-slate-800 p-3 text-[10px] text-slate-500'>La meta numérica puede ajustarse posteriormente por asesor.</div></div></div>
        </section>

        <section className='rounded-2xl border border-slate-800 bg-[#0D1830] overflow-hidden'>
          <div className='px-4 py-3 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3'><div className='flex items-center gap-2'><Search className='w-4 h-4 text-slate-500' /><span className='text-sm font-black text-white'>Buscar y filtrar expedientes</span></div><div className='flex flex-wrap gap-2 w-full lg:w-auto'><div className='relative min-w-[240px] flex-1'><Search className='w-4 h-4 text-slate-500 absolute left-3 top-2.5' /><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder='Cliente, CURP, folio, auto o lote...' className='w-full py-2.5 pl-9 pr-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-[11px]' /></div><select value={selectedLoteId} onChange={(e) => setSelectedLoteId(e.target.value)} className='py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-[11px]'><option value='TODOS'>Todos los lotes</option>{lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nombre}</option>)}</select><select value={selectedEstatus} onChange={(e) => setSelectedEstatus(e.target.value)} className='py-2.5 px-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-[11px]'><option value='TODOS'>Todos los estatus</option><option value='NUEVO'>Nuevo</option><option value='PRE_APROBADO'>Pre-aprobado</option><option value='EN_EVALUACION'>En análisis</option><option value='APROBADO'>Aprobado</option><option value='CONTRATO'>Contrato</option><option value='GPS'>GPS</option><option value='FONDEO'>Fondeo</option><option value='RECHAZADO'>Rechazado</option></select></div></div>
          <div className='hidden md:block overflow-x-auto'><table className='w-full text-left text-[11px]'><thead className='bg-slate-950/40 text-[9px] uppercase tracking-wider text-slate-500'><tr><th className='px-4 py-3'>Folio</th><th className='px-4 py-3'>Cliente</th><th className='px-4 py-3'>Vehículo</th><th className='px-4 py-3'>Monto</th><th className='px-4 py-3'>Estatus</th><th className='px-4 py-3'>Fecha</th><th className='px-4 py-3 text-right'>Acciones</th></tr></thead><tbody className='divide-y divide-slate-800/70'>{expedientes.map((exp) => <tr key={exp.id} className='hover:bg-white/[0.03] cursor-pointer' onClick={() => onOpenExpediente(exp)}><td className='px-4 py-3 font-mono text-red-300 font-bold'>{exp.folio}</td><td className='px-4 py-3'><div className='font-bold text-white truncate max-w-[180px]'>{exp.ine?.nombreCompleto || exp.ine?.nombre || 'Sin nombre'}</div><div className='text-[9px] text-slate-500'>{exp.loteNombre || 'Sin lote'}</div></td><td className='px-4 py-3'><div className='text-slate-200'>{exp.autoMarca} {exp.autoModelo}</div><div className='text-[9px] text-slate-500'>{exp.autoAno}</div></td><td className='px-4 py-3 font-black text-emerald-300'><span>$</span>{(exp.montoFinanciar || 0).toLocaleString('es-MX')}</td><td className='px-4 py-3'><span className={'inline-flex px-2 py-1 rounded-full text-[9px] font-bold border ' + statusClass(exp.estatus)}>{statusLabel(exp.estatus)}</span></td><td className='px-4 py-3 text-slate-400'>{dateLabel(exp.fechaCreacion)}</td><td className='px-4 py-3 text-right' onClick={(event) => event.stopPropagation()}><div className='flex justify-end gap-1'><button onClick={() => onOpenExpediente(exp)} className='p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300'><Eye className='w-3.5 h-3.5' /></button><button onClick={() => onOpenPrint(exp)} className='p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-red-300'><Printer className='w-3.5 h-3.5' /></button><button className='p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400'><MoreVertical className='w-3.5 h-3.5' /></button></div></td></tr>)}</tbody></table></div>
          <div className='md:hidden divide-y divide-slate-800'>{expedientes.map((exp) => <button key={exp.id} onClick={() => onOpenExpediente(exp)} className='w-full p-4 text-left'><div className='flex items-center justify-between gap-3'><div><div className='font-mono text-red-300 font-black text-xs'>{exp.folio}</div><div className='text-sm font-bold text-white mt-1'>{exp.ine?.nombreCompleto || exp.ine?.nombre || 'Sin nombre'}</div></div><div className='text-right font-black text-emerald-300'><span>$</span>{(exp.montoFinanciar || 0).toLocaleString('es-MX')}</div></div><div className='text-[10px] text-slate-500 mt-1'>{exp.autoMarca} {exp.autoModelo} · {exp.autoAno} · {exp.loteNombre || 'Sin lote'}</div></button>)}</div>
        </section>
      </div>
    </div>
  );
};
