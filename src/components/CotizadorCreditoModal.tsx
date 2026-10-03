import React, { useMemo, useState } from 'react';
import { Calculator, X, Printer, Copy, Check, Car } from 'lucide-react';
import { ExpedienteCredito } from '../types';

interface CotizadorCreditoModalProps {
  expediente: ExpedienteCredito;
  onClose: () => void;
}

export const CotizadorCreditoModal: React.FC<CotizadorCreditoModalProps> = ({ expediente, onClose }) => {
  const [precio, setPrecio] = useState<number>(Number(expediente.autoPrecio) || 0);
  const [modoEnganche, setModoEnganche] = useState<'PORCENTAJE' | 'MONTO'>(expediente.engancheModo || 'MONTO');
  const [engancheMonto, setEngancheMonto] = useState<number>(Number(expediente.enganche) || 0);
  const [enganchePorcentaje, setEnganchePorcentaje] = useState<number>(
    Number(expediente.enganchePorcentaje) ||
      (precio > 0 ? Math.round(((Number(expediente.enganche) || 0) / precio) * 10000) / 100 : 20)
  );
  const [plazo, setPlazo] = useState<number>([12, 24, 36, 48].includes(Number(expediente.plazoMeses)) ? Number(expediente.plazoMeses) : 48);
  const [copied, setCopied] = useState(false);

  const enganche = useMemo(() => {
    const p = Math.max(0, Number(precio) || 0);
    if (modoEnganche === 'MONTO') return Math.min(p, Math.max(0, Number(engancheMonto) || 0));
    return Math.min(p, Math.max(0, Math.round((p * (Number(enganchePorcentaje) || 0)) * 100) / 10000));
  }, [precio, modoEnganche, engancheMonto, enganchePorcentaje]);

  const montoFinanciar = Math.max(0, (Number(precio) || 0) - enganche);
  const capitalMensual = montoFinanciar > 0 ? montoFinanciar / plazo : 0;
  const interesMensual = montoFinanciar * 0.02;
  const ivaInteres = interesMensual * 0.16;
  const mensualidad = montoFinanciar > 0 ? capitalMensual + interesMensual + ivaInteres + 260 + 142 : 0;
  const totalPagos = mensualidad * plazo;
  const porcentajeReal = Number(precio) > 0 ? (enganche / Number(precio)) * 100 : 0;

  const money = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

  const quoteText = [
    'COTIZACIÓN CREDIMÓVIL',
    'Cliente: ' + (expediente.ine?.nombreCompleto || expediente.ine?.nombre || '—'),
    'Vehículo: ' + [expediente.autoMarca, expediente.autoModelo, expediente.autoAno].filter(Boolean).join(' '),
    'Precio: ' + money(Number(precio) || 0),
    'Enganche: ' + money(enganche) + ' (' + porcentajeReal.toFixed(2) + '%)',
    'Monto a financiar: ' + money(montoFinanciar),
    'Plazo: ' + plazo + ' meses',
    'Tasa anual: 28%',
    'Mensualidad estimada: ' + money(mensualidad),
    'GPS: $260 MXN | SDD: $142 MXN',
  ].join('\n');

  const copyQuote = async () => {
    try {
      await navigator.clipboard.writeText(quoteText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copia la cotización:', quoteText);
    }
  };

  const printQuote = () => {
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;
    const html =
      '<html><head><title>Cotización CrediMóvil</title>' +
      '<style>body{font-family:Arial,sans-serif;padding:36px;color:#071A33}h1{margin:0 0 8px;color:#C81E2B}table{width:100%;border-collapse:collapse;margin-top:18px}td{padding:10px;border-bottom:1px solid #ddd}td:first-child{font-weight:700;width:48%}.total{font-size:28px;font-weight:800;color:#C81E2B}.note{margin-top:28px;font-size:11px;color:#64748B}</style>' +
      '</head><body>' +
      '<h1>CrediMóvil</h1><div>Esquema de cotización de crédito automotriz</div>' +
      '<p><strong>Cliente:</strong> ' + (expediente.ine?.nombreCompleto || expediente.ine?.nombre || '—') + '</p>' +
      '<p><strong>Vehículo:</strong> ' + [expediente.autoMarca, expediente.autoModelo, expediente.autoAno].filter(Boolean).join(' ') + '</p>' +
      '<table>' +
      '<tr><td>Precio del vehículo</td><td>' + money(Number(precio) || 0) + '</td></tr>' +
      '<tr><td>Enganche</td><td>' + money(enganche) + ' (' + porcentajeReal.toFixed(2) + '%)</td></tr>' +
      '<tr><td>Monto a financiar</td><td>' + money(montoFinanciar) + '</td></tr>' +
      '<tr><td>Plazo</td><td>' + plazo + ' meses</td></tr>' +
      '<tr><td>Tasa anual</td><td>28%</td></tr>' +
      '<tr><td>Mensualidad estimada</td><td class="total">' + money(mensualidad) + '</td></tr>' +
      '</table>' +
      '<div class="note">Cotización estimada sujeta a validación y aprobación final. Incluye GPS de $260 y SDD de $142 en la mensualidad.</div>' +
      '<script>window.print();<\/script>' +
      '</body></html>';
    popup.document.write(html);
    popup.document.close();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-3xl max-h-[94vh] overflow-y-auto bg-[#071A33] border border-[#18365C] rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4 sm:p-5 bg-[#071A33] border-b border-[#173A63]">
          <div>
            <div className="flex items-center gap-2 text-white font-black">
              <Calculator className="w-5 h-5 text-red-400" /> Cotizador de Crédito
            </div>
            <p className="text-xs text-slate-400 mt-1">Simula sin modificar el expediente.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="text-xs text-slate-400">Cliente</div>
            <div className="text-sm font-bold text-white mt-1">{expediente.ine?.nombreCompleto || expediente.ine?.nombre || 'Sin nombre'}</div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" />
              {[expediente.autoMarca, expediente.autoModelo, expediente.autoAno].filter(Boolean).join(' ')}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-bold text-slate-300 uppercase">
              Precio del vehículo
              <input type="number" min={0} value={precio} onChange={(e) => setPrecio(Number(e.target.value) || 0)} className="mt-1.5 w-full rounded-xl bg-[#F5F8FC] text-[#102A43] border border-[#C5D1DF] px-3 py-2.5 text-sm" />
            </label>

            <div>
              <div className="text-xs font-bold text-slate-300 uppercase mb-1.5">Enganche</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button type="button" onClick={() => setModoEnganche('PORCENTAJE')} className={'py-2 rounded-xl border text-xs font-bold ' + (modoEnganche === 'PORCENTAJE' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-slate-300')}>Porcentaje (%)</button>
                <button type="button" onClick={() => setModoEnganche('MONTO')} className={'py-2 rounded-xl border text-xs font-bold ' + (modoEnganche === 'MONTO' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-slate-300')}>Efectivo ($)</button>
              </div>
              {modoEnganche === 'MONTO' ? (
                <input type="number" min={0} max={precio || undefined} step={1} value={engancheMonto} onChange={(e) => setEngancheMonto(Number(e.target.value) || 0)} className="w-full rounded-xl bg-[#F5F8FC] text-[#102A43] border border-[#C5D1DF] px-3 py-2.5 text-sm" />
              ) : (
                <input type="number" min={20} max={100} step={0.01} value={enganchePorcentaje} onChange={(e) => setEnganchePorcentaje(Number(e.target.value) || 0)} className="w-full rounded-xl bg-[#F5F8FC] text-[#102A43] border border-[#C5D1DF] px-3 py-2.5 text-sm" />
              )}
              <p className="text-[11px] text-slate-400 mt-1.5">Equivalente: {porcentajeReal.toFixed(2)}%</p>
            </div>

            <label className="text-xs font-bold text-slate-300 uppercase">
              Plazo
              <select value={plazo} onChange={(e) => setPlazo(Number(e.target.value))} className="mt-1.5 w-full rounded-xl bg-[#F5F8FC] text-[#102A43] border border-[#C5D1DF] px-3 py-2.5 text-sm">
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
                <option value={36}>36 meses</option>
                <option value={48}>48 meses</option>
              </select>
            </label>

            <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-4">
              <div className="text-xs font-bold text-red-300 uppercase">Tasa anual</div>
              <div className="text-2xl font-black text-white mt-1">28%</div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-[11px] text-slate-400">Enganche</div><div className="text-base font-black text-white mt-1">{money(enganche)}</div></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-[11px] text-slate-400">A financiar</div><div className="text-base font-black text-emerald-400 mt-1">{money(montoFinanciar)}</div></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-[11px] text-slate-400">Mensualidad</div><div className="text-base font-black text-red-300 mt-1">{money(mensualidad)}</div></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-[11px] text-slate-400">Total pagos</div><div className="text-base font-black text-white mt-1">{money(totalPagos)}</div></div>
          </div>

          <div className="rounded-2xl bg-black/20 border border-white/10 p-4 text-xs text-slate-400">
            Incluye GPS $260 y SDD $142 dentro de la mensualidad estimada.
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <button onClick={copyQuote} className="py-2.5 px-4 rounded-xl bg-white/10 border border-white/10 text-white text-xs font-bold inline-flex items-center justify-center gap-2">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar cotización'}
            </button>
            <button onClick={printQuote} className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold inline-flex items-center justify-center gap-2">
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </button>
            <button onClick={onClose} className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
