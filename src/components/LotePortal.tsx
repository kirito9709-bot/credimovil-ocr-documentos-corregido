import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Car, Clock3, FileText, RefreshCw, Search, ShieldCheck, Wallet, MessageCircle, Calculator, TrendingUp, BarChart3 } from 'lucide-react';
import { api } from '../services/api';
import { ChatLoteModal } from './ChatLoteModal';
import { ExpedienteComentariosModal } from './ExpedienteComentariosModal';
import { CotizadorCreditoModal } from './CotizadorCreditoModal';

interface LotePortalProps {
  authUser: { username: string; role: 'lote'; nombre: string; loteId?: string | null };
}

type LoteExpediente = {
  id: string; folio: string; estatus: string; clienteNombre: string; telefono: string;
  autoMarca: string; autoModelo: string; autoAno?: number | null; montoFinanciar: number;
  fechaCreacion: string; fechaActualizacion?: string; fechaFondeo?: string; docsSubidos: number; docsRequeridos: number;
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
  const [showChat, setShowChat] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; folio: string } | null>(null);
  const [showNewQuote, setShowNewQuote] = useState(false);

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
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthlyStats = Array.from({ length: currentMonth + 1 }, (_, month) => {
    const submitted = expedientes.filter((e) => {
      const d = new Date(e.fechaCreacion);
      return d.getFullYear() === currentYear && d.getMonth() === month;
    });
    const funded = expedientes.filter((e) => {
      const d = new Date(e.fechaFondeo || '');
      return e.estatus === 'FONDEADO' && d.getFullYear() === currentYear && d.getMonth() === month;
    });
    return { month, label: monthNames[month], submitted: submitted.length, funded: funded.length, fundedAmount: funded.reduce((sum, e) => sum + (Number(e.montoFinanciar) || 0), 0) };
  });
  const chartMax = Math.max(1, ...monthlyStats.map((m) => Math.max(m.submitted, m.funded)));
  const yearSubmitted = monthlyStats.reduce((sum, m) => sum + m.submitted, 0);
  const yearFunded = monthlyStats.reduce((sum, m) => sum + m.funded, 0);
  const yearFundedAmount = monthlyStats.reduce((sum, m) => sum + m.fundedAmount, 0);
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

  const statusClass = (value: string) => {
    if (value === 'FONDEADO') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    if (value === 'RECHAZADO') return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
    if (value === 'APROBADO' || value === 'PRE_APROBADO') return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
    return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  };

  return (
    <div className='min-h-[calc(100vh-64px)] bg-[#0B132B] px-3 sm:px-6 py-5 sm:py-8'><div className='max-w-7xl mx-auto space-y-5 sm:space-y-6'>
      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4'>
        <div>
          <div className='flex items-center gap-2'><Building2 className='w-6 h-6 text-red-400' /><h1 className='text-2xl sm:text-3xl font-black text-slate-100'>Portal del Lote</h1></div>
          <p className='text-sm text-slate-400 mt-1'>Sesión: <strong className='text-slate-200'>{authUser.nombre}</strong> • Control de créditos enviados por tu lote</p>
        </div>
        <div className='flex items-center gap-2'>
          <button onClick={() => setShowChat(true)} className='inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/20 text-emerald-300 text-xs font-bold hover:bg-emerald-600/30'>
            <MessageCircle className='w-4 h-4' /> Chat con CrediMóvil
          </button>
          <button onClick={load} className='self-start lg:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs font-bold hover:bg-slate-800'>
            <RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /> Actualizar
          </button>
        </div>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><span className='text-[11px] uppercase tracking-wider text-slate-500'>Créditos enviados</span><div className='text-2xl font-black text-white mt-1'>{stats.total}</div></div>
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><span className='text-[11px] uppercase tracking-wider text-slate-500'>En análisis</span><div className='text-2xl font-black text-amber-400 mt-1'>{stats.analisis}</div></div>
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><span className='text-[11px] uppercase tracking-wider text-slate-500'>Aprobados</span><div className='text-2xl font-black text-blue-400 mt-1'>{stats.aprobados}</div></div>
        <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><span className='text-[11px] uppercase tracking-wider text-slate-500'>Fondeados</span><div className='text-2xl font-black text-emerald-400 mt-1'>{stats.fondeados}</div></div>
      </div>

      <section className='bg-[#071A33] border border-[#18365C] rounded-2xl p-5 sm:p-6 shadow-lg space-y-5'>
        <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-3'>
          <div>
            <div className='flex items-center gap-2'><BarChart3 className='w-5 h-5 text-red-400' /><h2 className='text-base sm:text-lg font-black text-white'>Control mensual de créditos</h2></div>
            <p className='text-xs text-slate-400 mt-1'>Créditos registrados, fondeados y monto fondeado por mes.</p>
          </div>
          <div className='grid grid-cols-3 gap-2 text-center'>
            <div className='px-3 py-2 rounded-xl bg-slate-900 border border-slate-800'><div className='text-[10px] uppercase text-slate-500'>Registrados</div><div className='text-base font-black text-white'>{yearSubmitted}</div><div className='text-[10px] text-slate-500'>año</div></div>
            <div className='px-3 py-2 rounded-xl bg-slate-900 border border-slate-800'><div className='text-[10px] uppercase text-slate-500'>Fondeados</div><div className='text-base font-black text-emerald-400'>{yearFunded}</div><div className='text-[10px] text-slate-500'>año</div></div>
            <div className='px-3 py-2 rounded-xl bg-slate-900 border border-slate-800'><div className='text-[10px] uppercase text-slate-500'>Monto fondeado</div><div className='text-base font-black text-emerald-400'>{'
        <div className='relative flex-1'><Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500' /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Buscar por folio, cliente o vehículo...' className='w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-red-500' /></div>
        <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className='lg:w-64 py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none'>
          <option value='TODOS'>Todos los estatus</option>
          {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {error && <div className='p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 text-sm'>{error}</div>}

      <section className='bg-[#071A33] border border-[#18365C] rounded-2xl p-5 sm:p-6 shadow-lg'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <div className='flex items-start gap-3'>
            <div className='w-11 h-11 rounded-xl bg-red-600/15 border border-red-500/20 flex items-center justify-center shrink-0'>
              <Calculator className='w-5 h-5 text-red-400' />
            </div>
            <div>
              <h2 className='text-base sm:text-lg font-black text-white'>Cotizador de créditos</h2>
              <p className='text-xs sm:text-sm text-slate-400 mt-1'>
                Crea cotizaciones independientes para cualquier cliente y vehículo. No crea ni modifica un crédito.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNewQuote(true)}
            className='inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 border border-red-500 text-white text-xs font-bold hover:bg-red-500 shadow-md shrink-0'
          >
            <Calculator className='w-4 h-4' /> Abrir cotizador
          </button>
        </div>
      </section>

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
                      <span className='inline-flex items-center gap-1.5'><Clock3 className='w-3.5 h-3.5' />Alta: {e.fechaCreacion ? new Date(e.fechaCreacion).toLocaleDateString('es-MX') : '—'}</span>
                      <span className='inline-flex items-center gap-1.5 text-slate-500'>Actualización: {e.fechaActualizacion ? new Date(e.fechaActualizacion).toLocaleDateString('es-MX') : '—'}</span>
                      {e.fechaFondeo && <span className='inline-flex items-center gap-1.5 text-emerald-400 font-semibold'>Fondeado: {new Date(e.fechaFondeo).toLocaleDateString('es-MX')}</span>}
                    </div>
                  </div>
                  <div className='flex items-center gap-3 shrink-0'>
                    <button
                      onClick={() => setCommentTarget({ id: e.folio, folio: e.folio })}
                      className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:text-white hover:bg-slate-700'
                    >
                      <MessageCircle className='w-3.5 h-3.5' /> Comentarios
                    </button>
                    <div className='flex items-center gap-8'>

                    <div className='text-right'><div className='text-[10px] text-slate-500 uppercase tracking-wider'>Monto a financiar</div><div className='text-lg font-black text-emerald-400'>${(e.montoFinanciar || 0).toLocaleString('es-MX')} MXN</div></div>
                    <div className='text-right hidden sm:block'><div className='text-[10px] text-slate-500 uppercase tracking-wider'>Documentos</div><div className='text-sm font-bold text-slate-200'>{e.docsSubidos} / {e.docsRequeridos}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          </div>
        )}
      </div>

      <div className='bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400'><Wallet className='w-4 h-4 text-emerald-400 shrink-0' /><span>Monto total actualmente en cartera: <strong className='text-white'>${stats.monto.toLocaleString('es-MX')} MXN</strong>.</span></div>
      <ChatLoteModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        authUser={authUser}
        lotes={[]}
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
            loteNombre: authUser.nombre,
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
    </div>
  );
};
 + yearFundedAmount.toLocaleString('es-MX')}</div><div className='text-[10px] text-slate-500'>MXN</div></div>
          </div>
        </div>
        <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
          <div className='rounded-2xl bg-slate-900/70 border border-slate-800 p-4'>
            <div className='flex items-center gap-2 text-xs font-bold text-slate-200 mb-4'><TrendingUp className='w-4 h-4 text-red-400' /> Comparativo mensual</div>
            <div className='space-y-3'>
              {monthlyStats.map((m) => (
                <div key={m.month}>
                  <div className='flex items-center justify-between text-[11px] mb-1'><span className='text-slate-400'>{m.label}{m.month === currentMonth ? ' · En curso' : ''}</span><span className='text-white font-black'>{m.submitted} registrados · <span className='text-emerald-400'>{m.funded} fondeados</span></span></div>
                  <div className='h-2.5 rounded-full bg-slate-950 overflow-hidden'>
                    <div className='h-full rounded-full bg-red-500/80' style={{ width: (m.submitted / chartMax) * 100 + '%' }} />
                  </div>
                  <div className='h-1.5 rounded-full bg-slate-950 overflow-hidden mt-1'>
                    <div className='h-full rounded-full bg-emerald-500' style={{ width: (m.funded / chartMax) * 100 + '%' }} />
                  </div>
                </div>
              ))}
            </div>
            <div className='mt-4 flex items-center gap-4 text-[10px] text-slate-500'><span className='inline-flex items-center gap-1'><span className='w-2.5 h-2.5 rounded bg-red-500/80' /> Registrados</span><span className='inline-flex items-center gap-1'><span className='w-2.5 h-2.5 rounded bg-emerald-500' /> Fondeados</span></div>
          </div>
          <div className='rounded-2xl bg-slate-900/70 border border-slate-800 p-4'>
            <div className='text-xs font-bold text-slate-200 mb-4'>Resumen mensual</div>
            <div className='overflow-x-auto'>
              <table className='w-full text-left text-[11px]'>
                <thead className='text-slate-500 uppercase border-b border-slate-800'><tr><th className='py-2 pr-3'>Mes</th><th className='py-2 pr-3'>Registrados</th><th className='py-2 pr-3'>Fondeados</th><th className='py-2'>Monto fondeado</th></tr></thead>
                <tbody>{monthlyStats.map((m) => (<tr key={m.month} className='border-b border-slate-800/60 last:border-0'><td className='py-2 pr-3 text-slate-300'>{m.label}{m.month === currentMonth ? ' *' : ''}</td><td className='py-2 pr-3 text-white font-bold'>{m.submitted}</td><td className='py-2 pr-3 text-emerald-400 font-bold'>{m.funded}</td><td className='py-2 text-emerald-400 font-bold'>{'
        <div className='relative flex-1'><Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500' /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Buscar por folio, cliente o vehículo...' className='w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-red-500' /></div>
        <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className='lg:w-64 py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none'>
          <option value='TODOS'>Todos los estatus</option>
          {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {error && <div className='p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 text-sm'>{error}</div>}

      <section className='bg-[#071A33] border border-[#18365C] rounded-2xl p-5 sm:p-6 shadow-lg'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <div className='flex items-start gap-3'>
            <div className='w-11 h-11 rounded-xl bg-red-600/15 border border-red-500/20 flex items-center justify-center shrink-0'>
              <Calculator className='w-5 h-5 text-red-400' />
            </div>
            <div>
              <h2 className='text-base sm:text-lg font-black text-white'>Cotizador de créditos</h2>
              <p className='text-xs sm:text-sm text-slate-400 mt-1'>
                Crea cotizaciones independientes para cualquier cliente y vehículo. No crea ni modifica un crédito.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNewQuote(true)}
            className='inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 border border-red-500 text-white text-xs font-bold hover:bg-red-500 shadow-md shrink-0'
          >
            <Calculator className='w-4 h-4' /> Abrir cotizador
          </button>
        </div>
      </section>

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
                  <div className='flex items-center gap-3 shrink-0'>
                    <button
                      onClick={() => setCommentTarget({ id: e.folio, folio: e.folio })}
                      className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:text-white hover:bg-slate-700'
                    >
                      <MessageCircle className='w-3.5 h-3.5' /> Comentarios
                    </button>
                    <div className='flex items-center gap-8'>

                    <div className='text-right'><div className='text-[10px] text-slate-500 uppercase tracking-wider'>Monto a financiar</div><div className='text-lg font-black text-emerald-400'>${(e.montoFinanciar || 0).toLocaleString('es-MX')} MXN</div></div>
                    <div className='text-right hidden sm:block'><div className='text-[10px] text-slate-500 uppercase tracking-wider'>Documentos</div><div className='text-sm font-bold text-slate-200'>{e.docsSubidos} / {e.docsRequeridos}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          </div>
        )}
      </div>

      <div className='bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400'><Wallet className='w-4 h-4 text-emerald-400 shrink-0' /><span>Monto total actualmente en cartera: <strong className='text-white'>${stats.monto.toLocaleString('es-MX')} MXN</strong>.</span></div>
      <ChatLoteModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        authUser={authUser}
        lotes={[]}
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
            loteNombre: authUser.nombre,
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
    </div>
  );
};
 + m.fundedAmount.toLocaleString('es-MX') + ' MXN'}</td></tr>))}</tbody>
              </table>
            </div>
            <p className='mt-3 text-[10px] text-slate-500'>* El mes actual puede estar incompleto.</p>
          </div>
        </div>
      </section>
      <div className='bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row gap-3'>
        <div className='relative flex-1'><Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500' /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder='Buscar por folio, cliente o vehículo...' className='w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none focus:border-red-500' /></div>
        <select value={estatus} onChange={(e) => setEstatus(e.target.value)} className='lg:w-64 py-2.5 px-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm outline-none'>
          <option value='TODOS'>Todos los estatus</option>
          {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {error && <div className='p-4 rounded-xl bg-rose-950/30 border border-rose-800/50 text-rose-200 text-sm'>{error}</div>}

      <section className='bg-[#071A33] border border-[#18365C] rounded-2xl p-5 sm:p-6 shadow-lg'>
        <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
          <div className='flex items-start gap-3'>
            <div className='w-11 h-11 rounded-xl bg-red-600/15 border border-red-500/20 flex items-center justify-center shrink-0'>
              <Calculator className='w-5 h-5 text-red-400' />
            </div>
            <div>
              <h2 className='text-base sm:text-lg font-black text-white'>Cotizador de créditos</h2>
              <p className='text-xs sm:text-sm text-slate-400 mt-1'>
                Crea cotizaciones independientes para cualquier cliente y vehículo. No crea ni modifica un crédito.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowNewQuote(true)}
            className='inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 border border-red-500 text-white text-xs font-bold hover:bg-red-500 shadow-md shrink-0'
          >
            <Calculator className='w-4 h-4' /> Abrir cotizador
          </button>
        </div>
      </section>

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
                  <div className='flex items-center gap-3 shrink-0'>
                    <button
                      onClick={() => setCommentTarget({ id: e.folio, folio: e.folio })}
                      className='inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:text-white hover:bg-slate-700'
                    >
                      <MessageCircle className='w-3.5 h-3.5' /> Comentarios
                    </button>
                    <div className='flex items-center gap-8'>

                    <div className='text-right'><div className='text-[10px] text-slate-500 uppercase tracking-wider'>Monto a financiar</div><div className='text-lg font-black text-emerald-400'>${(e.montoFinanciar || 0).toLocaleString('es-MX')} MXN</div></div>
                    <div className='text-right hidden sm:block'><div className='text-[10px] text-slate-500 uppercase tracking-wider'>Documentos</div><div className='text-sm font-bold text-slate-200'>{e.docsSubidos} / {e.docsRequeridos}</div></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          </div>
        )}
      </div>

      <div className='bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center gap-3 text-xs text-slate-400'><Wallet className='w-4 h-4 text-emerald-400 shrink-0' /><span>Monto total actualmente en cartera: <strong className='text-white'>${stats.monto.toLocaleString('es-MX')} MXN</strong>.</span></div>
      <ChatLoteModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        authUser={authUser}
        lotes={[]}
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
            loteNombre: authUser.nombre,
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
    </div>
  );
};
