import React, { useMemo, useState } from 'react';
import { Calculator, X, Printer, Copy, Check, Car, ShieldCheck } from 'lucide-react';
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
  const [seguroModo, setSeguroModo] = useState<'NINGUNO' | 'CONTADO' | 'FINANCIADO'>('NINGUNO');
  const [seguroMonto, setSeguroMonto] = useState<number>(0);

  const enganche = useMemo(() => {
    const p = Math.max(0, Number(precio) || 0);
    if (modoEnganche === 'MONTO') return Math.min(p, Math.max(0, Number(engancheMonto) || 0));
    return Math.min(p, Math.max(0, Math.round((p * (Number(enganchePorcentaje) || 0)) * 100) / 10000));
  }, [precio, modoEnganche, engancheMonto, enganchePorcentaje]);

  const montoFinanciar = Math.max(0, (Number(precio) || 0) - enganche);
  const seguro = Math.max(0, Number(seguroMonto) || 0);
  const montoSeguroFinanciado = seguroModo === 'FINANCIADO' ? seguro : 0;
  const totalCapitalFinanciado = montoFinanciar + montoSeguroFinanciado;
  const capitalMensual = totalCapitalFinanciado > 0 ? totalCapitalFinanciado / plazo : 0;
  const interesMensual = totalCapitalFinanciado * 0.02;
  const ivaInteres = interesMensual * 0.16;
  const mensualidad = totalCapitalFinanciado > 0 ? capitalMensual + interesMensual + ivaInteres + 260 + 142 : 0;
  const totalPagos = mensualidad * plazo;
  const porcentajeReal = Number(precio) > 0 ? (enganche / Number(precio)) * 100 : 0;

  const capitalMensualBase = totalCapitalFinanciado > 0 ? Math.round((totalCapitalFinanciado / plazo) * 100) / 100 : 0;
  const interesesMensualesBase = totalCapitalFinanciado > 0 ? Math.round(totalCapitalFinanciado * 0.02 * 100) / 100 : 0;
  const ivaMensualBase = Math.round(interesesMensualesBase * 0.16 * 100) / 100;
  const gpsMensual = 260;
  const sddMensual = 142;
  const monthlySchedule = useMemo(() => {
    const rows: Array<{
      mes: number;
      capital: number;
      interes: number;
      iva: number;
      gps: number;
      sdd: number;
      pago: number;
      saldo: number;
    }> = [];
    let saldo = Math.max(0, totalCapitalFinanciado);
    for (let mes = 1; mes <= plazo; mes += 1) {
      const capital = mes === plazo
        ? Math.round(saldo * 100) / 100
        : capitalMensualBase;
      saldo = Math.max(0, Math.round((saldo - capital) * 100) / 100);
      rows.push({
        mes,
        capital,
        interes: interesesMensualesBase,
        iva: ivaMensualBase,
        gps: gpsMensual,
        sdd: sddMensual,
        pago: Math.round((capital + interesesMensualesBase + ivaMensualBase + gpsMensual + sddMensual) * 100) / 100,
        saldo,
      });
    }
    return rows;
  }, [totalCapitalFinanciado, plazo, capitalMensualBase, interesesMensualesBase, ivaMensualBase]);

  const seguroResumenLabel =
    seguroModo === 'CONTADO' ? 'Seguro de contado' :
    seguroModo === 'FINANCIADO' ? 'Seguro financiado' :
    'Seguro';

  const money = (value: number) =>
    value.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 });

  const quoteText = [
    'COTIZACIÓN CREDIMÓVIL',
    'Cliente: ' + (expediente.ine?.nombreCompleto || expediente.ine?.nombre || '—'),
    'Vehículo: ' + [expediente.autoMarca, expediente.autoModelo, expediente.autoAno].filter(Boolean).join(' '),
    'Precio: ' + money(Number(precio) || 0),
    'Enganche: ' + money(enganche) + ' (' + porcentajeReal.toFixed(2) + '%)',
    'Monto a financiar: ' + money(montoFinanciar),
    seguroResumenLabel + ': ' + (seguroModo === 'NINGUNO' ? 'Sin seguro' : money(seguro)),
    'Total capital financiado: ' + money(totalCapitalFinanciado),
    'Plazo: ' + plazo + ' meses',
    'Tasa anual: 28%',
    'Mensualidad estimada: ' + money(mensualidad),
    'GPS: $260 MXN | SDD: $142 MXN',
    'Desglose mensual: Capital ' + money(capitalMensualBase) + ' + Interés ' + money(interesesMensualesBase) + ' + IVA interés ' + money(ivaMensualBase) + ' + GPS $260 + SDD $142 = ' + money(mensualidad),
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
      '<style>' +
      '@page{size:A4;margin:14mm}' +
      'body{font-family:Arial,Helvetica,sans-serif;margin:0;color:#071A33;background:#fff}' +
      '.header{background:#071A33;color:#fff;border-radius:14px;padding:18px 22px;margin-bottom:22px;border-bottom:5px solid #C81E2B;display:flex;justify-content:space-between;align-items:center}' +
      '.brand{font-size:27px;font-weight:900;letter-spacing:-.5px}.brand b{color:#E3262F}' +
      '.tag{font-size:10px;color:#B9C7DA;text-transform:uppercase;letter-spacing:1.4px;margin-top:4px}' +
      '.folio{font-size:11px;color:#D7E0E7;text-align:right}.folio strong{display:block;color:#fff;font-size:15px;margin-top:3px}' +
      '.client{background:#F1F5F9;border:1px solid #D7E0E7;border-radius:12px;padding:14px 16px;margin-bottom:18px}' +
      '.client strong{font-size:14px}.vehicle{color:#46617D;font-size:12px;margin-top:4px}' +
      'table{width:100%;border-collapse:separate;border-spacing:0;margin-top:8px;border:1px solid #D7E0E7;border-radius:12px;overflow:hidden}' +
      'td{padding:11px 13px;border-bottom:1px solid #E2E8F0;font-size:12px}tr:last-child td{border-bottom:0}td:first-child{font-weight:700;width:58%;color:#294767}' +
      '.highlight td{background:#FFF4F4}.highlight td:last-child{font-size:25px;font-weight:900;color:#C81E2B}' +
      '.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:15px}' +
      '.schedule-title{margin-top:20px;font-size:13px;font-weight:900;color:#071A33;text-transform:uppercase;letter-spacing:.8px}.schedule{font-size:8px;margin-top:8px}.schedule th{background:#071A33;color:#fff;padding:6px 5px;text-align:right}.schedule th:first-child,.schedule td:first-child{text-align:center}.schedule td{padding:5px 4px;font-size:8px;text-align:right}.schedule tr:nth-child(even) td{background:#F8FAFC}' +
      '.insurance-box{border-color:#C81E2B;background:#FFF4F4}.box{border:1px solid #D7E0E7;border-radius:12px;padding:12px;background:#F8FAFC}.box span{display:block;color:#64748B;font-size:10px;text-transform:uppercase;letter-spacing:.6px}.box strong{display:block;margin-top:5px;font-size:15px}' +
      '.note{margin-top:18px;padding:11px 12px;border-left:4px solid #C81E2B;background:#F8FAFC;color:#64748B;font-size:10px;line-height:1.45}' +
      '.footer{margin-top:24px;text-align:center;color:#94A3B8;font-size:9px}' +
      '</style></head><body>' +
      '<div class="header"><div><div class="brand">CREDI<span>MÓVIL</span></div><div class="tag">Cotización de crédito automotriz</div></div>' +
      '<div class="folio">Folio<strong>' + (expediente.folio || '—') + '</strong></div></div>' +
      '<div class="client"><strong>' + (expediente.ine?.nombreCompleto || expediente.ine?.nombre || 'Cliente sin nombre') + '</strong><div class="vehicle">' +
      [expediente.autoMarca, expediente.autoModelo, expediente.autoAno].filter(Boolean).join(' ') + '</div></div>' +
      '<table>' +
      '<tr><td>Precio del vehículo</td><td>' + money(Number(precio) || 0) + '</td></tr>' +
      '<tr><td>Enganche</td><td>' + money(enganche) + ' (' + porcentajeReal.toFixed(2) + '%)</td></tr>' +
      '<tr><td>Monto base a financiar</td><td>' + money(montoFinanciar) + '</td></tr>' +
      '<tr><td>Total capital financiado</td><td>' + money(totalCapitalFinanciado) + '</td></tr>' +
      '<tr><td>Plazo</td><td>' + plazo + ' meses</td></tr>' +
      '<tr><td>Tasa anual</td><td>28%</td></tr>' +
      '<tr class="highlight"><td>Mensualidad estimada</td><td>' + money(mensualidad) + '</td></tr>' +
      '</table>' +
      '<div class="summary">' +
      '<div class="box"><span>GPS mensual</span><strong>$260 MXN</strong></div>' +
      '<div class="box"><span>SDD mensual</span><strong>$142 MXN</strong></div>' +
      '<div class="box insurance-box"><span>' + seguroResumenLabel + '</span><strong>' + (seguroModo === 'NINGUNO' ? 'Sin seguro' : money(seguro)) + '</strong></div>' +
      '</div>' +
      '<div class="schedule-title">Desglose de pagos mensuales</div>' +
      '<table class="schedule"><thead><tr><th>Mes</th><th>Capital</th><th>Interés</th><th>IVA interés</th><th>GPS</th><th>SDD</th><th>Pago mensual</th><th>Saldo</th></tr></thead><tbody>' +
      monthlySchedule.map(row => '<tr><td>' + row.mes + '</td><td>' + money(row.capital) + '</td><td>' + money(row.interes) + '</td><td>' + money(row.iva) + '</td><td>$260.00</td><td>$142.00</td><td><strong>' + money(row.pago) + '</strong></td><td>' + money(row.saldo) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<div class="note">Cotización estimada sujeta a validación y aprobación final. El seguro de contado se paga por separado; el seguro financiado se incorpora al capital financiado y modifica la mensualidad. GPS y SDD están incluidos en la mensualidad estimada.</div>' +
      '<div class="footer">CrediMóvil • Tu auto, más cerca de tus planes</div>' +
      '<script>window.print();<\/script></body></html>';
    popup.document.write(html);
    popup.document.close();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center" onMouseDown={(e) => e.stopPropagation()}>
      <div className="w-full max-w-4xl max-h-[95vh] overflow-y-auto bg-gradient-to-b from-[#071A33] via-[#081D36] to-[#06162B] border border-[#284B73] rounded-3xl shadow-[0_30px_90px_rgba(0,0,0,.45)]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4 sm:p-5 bg-[#071A33] border-b border-[#173A63]">
          <div>
            <div className="flex items-center gap-2 text-white font-black">
              <Calculator className="w-5 h-5 text-red-400" /> Cotizador de Crédito
            </div>
            <p className="text-xs text-slate-400 mt-1">Simula sin modificar el expediente.</p>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-red-600 transition" aria-label="Cerrar cotizador">
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


          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              <div>
                <div className="text-xs font-bold text-white uppercase">Seguro del vehículo</div>
                <div className="text-[11px] text-slate-400">Captura el valor de la póliza según la cotización de la aseguradora.</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => setSeguroModo('NINGUNO')} className={'py-2.5 rounded-xl border text-xs font-bold ' + (seguroModo === 'NINGUNO' ? 'bg-slate-700 border-slate-500 text-white' : 'bg-white/5 border-white/10 text-slate-300')}>Sin seguro</button>
                <button type="button" onClick={() => setSeguroModo('CONTADO')} className={'py-2.5 rounded-xl border text-xs font-bold ' + (seguroModo === 'CONTADO' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-slate-300')}>Contado</button>
                <button type="button" onClick={() => setSeguroModo('FINANCIADO')} className={'py-2.5 rounded-xl border text-xs font-bold ' + (seguroModo === 'FINANCIADO' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-slate-300')}>Financiado</button>
              </div>
              <label className="text-[11px] font-bold text-slate-300 uppercase">
                Prima del seguro
                <input type="number" min={0} step={1} value={seguroMonto} onChange={(e) => setSeguroMonto(Number(e.target.value) || 0)} className="mt-1.5 w-full rounded-xl bg-[#F5F8FC] text-[#102A43] border border-[#C5D1DF] px-3 py-2.5 text-sm" />
              </label>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              {seguroModo === 'NINGUNO' && 'No se agrega seguro a la cotización.'}
              {seguroModo === 'CONTADO' && <>El cliente paga <strong className="text-white">{money(seguro)}</strong> por separado; la mensualidad no cambia.</>}
              {seguroModo === 'FINANCIADO' && <>Se agregan <strong className="text-white">{money(seguro)}</strong> al capital financiado; la mensualidad cambia a <strong className="text-red-300">{money(mensualidad)}</strong>.</>}
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
            <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-red-700 text-white text-xs font-bold">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
};
