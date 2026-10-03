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
    const schedulePages: string[] = [];
    for (let pageStart = 0; pageStart < monthlySchedule.length; pageStart += 24) {
      const pageRows = monthlySchedule.slice(pageStart, pageStart + 24);
      schedulePages.push(
        '<section class="schedule-page">' +
          '<div class="schedule-header">' +
            '<div><div class="schedule-brand">CREDI<span>MÓVIL</span></div><div class="schedule-sub">Desglose de pagos mensuales</div></div>' +
            '<div class="schedule-meta">Folio <strong>' + (expediente.folio || '—') + '</strong><br><span>Hoja ' + (schedulePages.length + 1) + '</span></div>' +
          '</div>' +
          '<table class="schedule"><thead><tr><th>Mes</th><th>Capital</th><th>Interés</th><th>IVA interés</th><th>GPS</th><th>SDD</th><th>Pago mensual</th><th>Saldo</th></tr></thead><tbody>' +
          pageRows.map(row =>
            '<tr>' +
              '<td class="center">' + row.mes + '</td>' +
              '<td>' + money(row.capital) + '</td>' +
              '<td>' + money(row.interes) + '</td>' +
              '<td>' + money(row.iva) + '</td>' +
              '<td>$260.00</td>' +
              '<td>$142.00</td>' +
              '<td class="payment">' + money(row.pago) + '</td>' +
              '<td class="balance">' + money(row.saldo) + '</td>' +
            '</tr>'
          ).join('') +
          '</tbody></table>' +
          '<div class="schedule-footer">Cliente: <strong>' + (expediente.ine?.nombreCompleto || expediente.ine?.nombre || '—') + '</strong> · ' +
            [expediente.autoMarca, expediente.autoModelo, expediente.autoAno].filter(Boolean).join(' ') +
          '</div>' +
        '</section>'
      );
    }

    const html =
      '<html><head><title>Cotización CrediMóvil</title>' +
      '<style>' +
      '@page{size:A4 landscape;margin:10mm}' +
      "'*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +"
      'html,body{margin:0;padding:0;background:#071A33}' +
      'body{font-family:Arial,Helvetica,sans-serif;color:#fff;font-size:11px;background:#071A33}' +
      '.header{background:#071A33;color:#fff;border-radius:12px;padding:15px 18px;margin-bottom:14px;border-bottom:4px solid #C81E2B;display:flex;justify-content:space-between;align-items:center}' +
      '.brand{font-size:24px;font-weight:900}.brand span{color:#E3262F}' +
      '.tag{font-size:9px;color:#B9C7DA;text-transform:uppercase;letter-spacing:1.2px;margin-top:3px}' +
      '.folio{font-size:9px;color:#D7E0E7;text-align:right}.folio strong{display:block;color:#fff;font-size:13px;margin-top:2px}' +
      '.client{background:#102A43;border:1px solid #294767;border-radius:10px;padding:10px 12px;margin-bottom:12px}.client strong{font-size:12px}.vehicle{color:#46617D;font-size:10px;margin-top:3px}' +
      'table.quote{width:100%;border-collapse:collapse;border:1px solid #D7E0E7;border-radius:10px;overflow:hidden}.quote td{padding:7px 9px;border-bottom:1px solid #E2E8F0;font-size:10px}.quote tr:last-child td{border-bottom:0}.quote td:first-child{font-weight:700;width:52%;color:#294767}.highlight td{background:#FFF4F4}.highlight td:last-child{font-size:20px;font-weight:900;color:#C81E2B}' +
      '.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.box{border:1px solid #294767;border-radius:10px;padding:9px;background:#102A43}.box span{display:block;color:#8FA8C0;font-size:8px;text-transform:uppercase;letter-spacing:.5px}.box strong{display:block;margin-top:3px;font-size:12px}' +
      '.note{margin-top:10px;padding:9px 10px;border-left:4px solid #C81E2B;background:#0B213E;color:#B9C7DA;font-size:8px;line-height:1.35}' +
      '.cover-footer{text-align:center;color:#8FA8C0;font-size:8px;margin-top:10px}' +
      '.schedule-page{page-break-before:always;min-height:180mm;display:flex;flex-direction:column}.schedule-header{background:#071A33;color:#fff;border-bottom:4px solid #C81E2B;border-radius:12px 12px 0 0;padding:12px 16px;display:flex;justify-content:space-between;align-items:center}.schedule-brand{font-size:20px;font-weight:900}.schedule-brand span{color:#E3262F}.schedule-sub{font-size:9px;color:#B9C7DA;margin-top:2px}.schedule-meta{font-size:9px;text-align:right;color:#B9C7DA}.schedule-meta strong{color:#fff;font-size:12px}.schedule-meta span{font-size:8px}' +
      '.schedule{width:100%;border-collapse:collapse;border:1px solid #D7E0E7;border-top:0;table-layout:fixed}.schedule th{background:#18365C;color:#fff;padding:6px 5px;font-size:8px;text-align:right}.schedule th:first-child{text-align:center;width:6%}.schedule th:nth-child(2){width:14%}.schedule th:nth-child(3),.schedule th:nth-child(4),.schedule th:nth-child(5),.schedule th:nth-child(6){width:11%}.schedule th:nth-child(7){width:14%}.schedule th:nth-child(8){width:14%}.schedule td{padding:6px 5px;border-bottom:1px solid #E2E8F0;font-size:8px;text-align:right;white-space:nowrap}.schedule td.center{text-align:center;font-weight:800;color:#294767}.schedule tr:nth-child(even) td{background:#F8FAFC}.schedule tr:last-child td{border-bottom:0}.schedule td.payment{font-weight:900;color:#C81E2B}.schedule td.balance{font-weight:700;color:#047857}.schedule-footer{margin-top:auto;padding-top:8px;color:#94A3B8;font-size:8px;border-top:1px solid #E2E8F0}' +
      '</style></head><body>' +
      '<section>' +
        '<div class="header"><div><div class="brand">CREDI<span>MÓVIL</span></div><div class="tag">Cotización de crédito automotriz</div></div>' +
        '<div class="folio">Folio<strong>' + (expediente.folio || '—') + '</strong></div></div>' +
        '<div class="client"><strong>' + (expediente.ine?.nombreCompleto || expediente.ine?.nombre || 'Cliente sin nombre') + '</strong><div class="vehicle">' + [expediente.autoMarca, expediente.autoModelo, expediente.autoAno].filter(Boolean).join(' ') + '</div></div>' +
        '<table class="quote">' +
          '<tr><td>Precio del vehículo</td><td>' + money(Number(precio) || 0) + '</td></tr>' +
          '<tr><td>Enganche</td><td>' + money(enganche) + ' (' + porcentajeReal.toFixed(2) + '%)</td></tr>' +
          '<tr><td>Monto base a financiar</td><td>' + money(montoFinanciar) + '</td></tr>' +
          '<tr><td>' + seguroResumenLabel + '</td><td>' + (seguroModo === 'NINGUNO' ? 'Sin seguro' : money(seguro)) + '</td></tr>' +
          '<tr><td>Total capital financiado</td><td>' + money(totalCapitalFinanciado) + '</td></tr>' +
          '<tr><td>Plazo</td><td>' + plazo + ' meses</td></tr>' +
          '<tr><td>Tasa anual</td><td>28%</td></tr>' +
          '<tr class="highlight"><td>Mensualidad estimada</td><td>' + money(mensualidad) + '</td></tr>' +
        '</table>' +
        '<div class="summary">' +
          '<div class="box"><span>Capital mensual</span><strong>' + money(capitalMensualBase) + '</strong></div>' +
          '<div class="box"><span>Interés mensual</span><strong>' + money(interesesMensualesBase) + '</strong></div>' +
          '<div class="box"><span>IVA interés</span><strong>' + money(ivaMensualBase) + '</strong></div>' +
          '<div class="box"><span>GPS + SDD</span><strong>$402.00 MXN</strong></div>' +
        '</div>' +
        '<div class="note">Cotización estimada sujeta a validación y aprobación final. El seguro financiado se incorpora al capital; el seguro de contado se paga por separado. GPS $260 + SDD $142 están incluidos en la mensualidad.</div>' +
        '<div class="cover-footer">CrediMóvil · Tu auto, más cerca de tus planes</div>' +
      '</section>' +
      schedulePages.join('') +
      '</body></html>';
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
