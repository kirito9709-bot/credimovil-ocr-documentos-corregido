import React, { useMemo, useState } from 'react';
import { Calculator, X, Printer, Copy, Check, Car, ShieldCheck } from 'lucide-react';
import { ExpedienteCredito } from '../types';

interface CotizadorCreditoModalProps {
  expediente: ExpedienteCredito;
  onClose: () => void;
  customerMode?: boolean;
  showRate?: boolean;
}

export const CotizadorCreditoModal: React.FC<CotizadorCreditoModalProps> = ({ expediente, onClose, customerMode = false, showRate = false }) => {
  const [precio, setPrecio] = useState<number>(Number(expediente.autoPrecio) || 0);
  const [modoEnganche, setModoEnganche] = useState<'PORCENTAJE' | 'MONTO'>(expediente.engancheModo || 'MONTO');
  const [engancheMonto, setEngancheMonto] = useState<number>(Number(expediente.enganche) || 0);
  const [enganchePorcentaje, setEnganchePorcentaje] = useState<number>(
    Number(expediente.enganchePorcentaje) ||
      (precio > 0 ? Math.round(((Number(expediente.enganche) || 0) / precio) * 10000) / 100 : 20)
  );
  const [plazo, setPlazo] = useState<number>([12, 24, 36, 48].includes(Number(expediente.plazoMeses)) ? Number(expediente.plazoMeses) : 48);
  const [copied, setCopied] = useState(false);
  const [clienteNombre, setClienteNombre] = useState(expediente.ine?.nombreCompleto || expediente.ine?.nombre || '');
  const [vehiculoMarca, setVehiculoMarca] = useState(expediente.autoMarca || '');
  const [vehiculoModelo, setVehiculoModelo] = useState(expediente.autoModelo || '');
  const [vehiculoAno, setVehiculoAno] = useState(String(expediente.autoAno || ''));
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
  const comisionApertura = Math.round(totalCapitalFinanciado * 0.03 * 100) / 100;
  const seguroDeContado = seguroModo === 'CONTADO' ? seguro : 0;
  const desembolsoTotal = enganche + comisionApertura + seguroDeContado;
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
    'Comisión por apertura (3%): ' + money(comisionApertura),
    'Seguro de contado: ' + (seguroDeContado > 0 ? money(seguroDeContado) : 'No aplica'),
    'Desembolso total: ' + money(desembolsoTotal),
    'Plazo: ' + plazo + ' meses',
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
    const popup = window.open('', '_blank', 'width=1200,height=900');
    if (!popup) return;

    const schedulePages: string[] = [];
    const rowsPerPage = 18;
    for (let pageStart = 0; pageStart < monthlySchedule.length; pageStart += rowsPerPage) {
      const pageRows = monthlySchedule.slice(pageStart, pageStart + rowsPerPage);
      schedulePages.push(
        '<section class="print-page schedule-page">' +
          '<div class="print-header">' +
            '<div><div class="brand">CREDI<span>MÓVIL</span></div><div class="subtitle">Desglose de pagos mensuales</div></div>' +
            '<div class="meta">Folio<strong>' + (expediente.folio || '—') + '</strong><span>Hoja ' + (Math.floor(pageStart / rowsPerPage) + 2) + '</span></div>' +
          '</div>' +
          '<div class="schedule-title">Plan de pagos</div>' +
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
          '<div class="page-footer">Cliente: ' + (clienteNombre || '—') + ' · ' +
            [vehiculoMarca, vehiculoModelo, vehiculoAno].filter(Boolean).join(' ') +
          '</div>' +
        '</section>'
      );
    }

    const html =
      '<html><head><title>Cotización CrediMóvil</title>' +
      '<style>' +
      '@page{size:A4 portrait;margin:10mm}' +
      '*{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}' +
      'html,body{margin:0;padding:0;background:#fff;color:#071A33}' +
      'body{font-family:Arial,Helvetica,sans-serif;font-size:10px}' +
      '.print-page{width:100%;page-break-after:always}' +
      '.print-page:last-child{page-break-after:auto}' +
      '.print-header{background:#071A33;color:#fff;border-bottom:4px solid #C81E2B;border-radius:10px;padding:11px 14px;display:flex;align-items:center;justify-content:space-between;margin-bottom:9px}' +
      '.brand{font-size:21px;font-weight:900;letter-spacing:-.3px}.brand span{color:#E3262F}.subtitle{font-size:9px;color:#B9C7DA;text-transform:uppercase;letter-spacing:1.2px;margin-top:3px}.meta{font-size:9px;color:#B9C7DA;text-align:right}.meta strong{display:block;font-size:13px;color:#fff;margin:2px 0}.meta span{display:block;color:#8FA8C0;font-size:8px}' +
      '.client{background:#EEF3F8;border:1px solid #CBD7E3;border-radius:9px;padding:8px 10px;margin-bottom:8px}.client-name{font-size:12px;font-weight:800;color:#071A33}.vehicle{font-size:10px;color:#46617D;margin-top:4px}' +
      '.quote{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #CBD7E3;border-radius:12px;overflow:hidden}.quote td{padding:9px 10px;border-bottom:1px solid #D9E2EB;font-size:10px}.quote tr:last-child td{border-bottom:0}.quote td:first-child{font-weight:800;color:#294767;width:52%}.quote td:last-child{color:#071A33}.highlight td{background:#FFF1F2}.highlight td:last-child{font-size:24px;font-weight:900;color:#C81E2B}' +
      '.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:7px}.box{border:1px solid #CBD7E3;border-radius:8px;padding:7px;background:#F6F8FB}.box span{display:block;color:#60778E;font-size:8px;text-transform:uppercase;letter-spacing:.5px}.box strong{display:block;margin-top:4px;font-size:12px;color:#071A33}' +
      '.note{margin-top:7px;padding:10px 12px;border-left:4px solid #C81E2B;background:#F6F8FB;color:#536B83;font-size:8px;line-height:1.45}.disbursement{margin-top:10px;border:1px solid #CBD7E3;border-radius:12px;background:#F6F8FB;padding:11px 12px}.disbursement-title{font-size:9px;font-weight:900;text-transform:uppercase;color:#18365C;margin-bottom:7px}.disbursement-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #E1E7ED;font-size:9px;color:#46617D}.disbursement-row:last-child{border-bottom:0;font-weight:900;color:#C81E2B;font-size:11px}' +
      '.cover-footer{text-align:center;color:#8092A5;font-size:7px;margin-top:7px}' +
      '.schedule-page{min-height:275mm}.schedule-title{font-size:11px;font-weight:900;color:#071A33;text-transform:uppercase;letter-spacing:.8px;margin:2px 0 8px}' +
      '.schedule{width:100%;border-collapse:collapse;border:1px solid #CBD7E3}.schedule th{background:#18365C;color:#fff;padding:8px 6px;font-size:8px;text-align:right}.schedule th:first-child{text-align:center}.schedule td{padding:8px 6px;border-bottom:1px solid #D9E2EB;font-size:9px;text-align:right;white-space:nowrap;color:#18365C}.schedule tr:nth-child(even) td{background:#F6F8FB}.schedule td.center{text-align:center;font-weight:800}.schedule td.payment{font-weight:900;color:#C81E2B}.schedule td.balance{font-weight:800;color:#047857}.page-footer{margin-top:12px;padding-top:8px;border-top:1px solid #CBD7E3;color:#8092A5;font-size:8px}' +
      '</style></head><body>' +

      '<section class="print-page">' +
        '<div class="print-header"><div><div class="brand">CREDI<span>MÓVIL</span></div><div class="subtitle">Cotización de crédito automotriz</div></div>' +
        '<div class="meta">Folio<strong>' + (expediente.folio || '—') + '</strong></div></div>' +
        '<div class="client"><div class="client-name">' + (clienteNombre || 'Cliente sin nombre') + '</div><div class="vehicle">' +
        [vehiculoMarca, vehiculoModelo, vehiculoAno].filter(Boolean).join(' ') + '</div></div>' +
        '<table class="quote">' +
          '<tr><td>Precio del vehículo</td><td>' + money(Number(precio) || 0) + '</td></tr>' +
          '<tr><td>Enganche</td><td>' + money(enganche) + ' (' + porcentajeReal.toFixed(2) + '%)</td></tr>' +
          '<tr><td>Monto base a financiar</td><td>' + money(montoFinanciar) + '</td></tr>' +
          '<tr><td>' + seguroResumenLabel + '</td><td>' + (seguroModo === 'NINGUNO' ? 'Sin seguro' : money(seguro)) + '</td></tr>' +
          '<tr><td>Total capital financiado</td><td>' + money(totalCapitalFinanciado) + '</td></tr>' +
          '<tr><td>Comisión por apertura (3%)</td><td>' + money(comisionApertura) + '</td></tr>' +
          '<tr><td>Desembolso total</td><td>' + money(desembolsoTotal) + '</td></tr>' +
          '<tr><td>Plazo</td><td>' + plazo + ' meses</td></tr>' +
          '<tr class="highlight"><td>Mensualidad estimada</td><td>' + money(mensualidad) + '</td></tr>' +
        '</table>' +
        '<div class="summary">' +
          '<div class="box"><span>Capital mensual</span><strong>' + money(capitalMensualBase) + '</strong></div>' +
          '<div class="box"><span>Interés mensual</span><strong>' + money(interesesMensualesBase) + '</strong></div>' +
          '<div class="box"><span>IVA interés</span><strong>' + money(ivaMensualBase) + '</strong></div>' +
          '<div class="box"><span>GPS + SDD</span><strong>$402.00 MXN</strong></div>' +
        '</div>' +
        '<div class="disbursement">' +
          '<div class="disbursement-title">Desembolso total inicial</div>' +
          '<div class="disbursement-row"><span>Enganche</span><span>' + money(enganche) + '</span></div>' +
          '<div class="disbursement-row"><span>Comisión por apertura (3%)</span><span>' + money(comisionApertura) + '</span></div>' +
          (seguroDeContado > 0 ? '<div class="disbursement-row"><span>Seguro de contado</span><span>' + money(seguroDeContado) + '</span></div>' : '') +
          '<div class="disbursement-row"><span>Desembolso total</span><span>' + money(desembolsoTotal) + '</span></div>' +
        '</div>' +
        '<div class="note">Cotización estimada sujeta a validación y aprobación final. El seguro financiado se integra al capital y no forma parte del desembolso inicial; el seguro de contado se paga al inicio. GPS $260 + SDD $142 están incluidos en la mensualidad.</div>' +
        '<div class="cover-footer">CrediMóvil · Tu auto, más cerca de tus planes</div>' +
      '</section>' +
      schedulePages.join('') +
      '</body></html>';

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    setTimeout(() => {
      try {
        popup.focus();
        popup.print();
      } catch {
        // El usuario puede imprimir manualmente desde la ventana abierta.
      }
    }, 900);
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
          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-bold text-slate-300 uppercase">
                Cliente
                <input value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Nombre del cliente" className="mt-1.5 w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-300 uppercase">
                Marca
                <input value={vehiculoMarca} onChange={(e) => setVehiculoMarca(e.target.value)} placeholder="Ej. Kia" className="mt-1.5 w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-300 uppercase">
                Modelo / versión
                <input value={vehiculoModelo} onChange={(e) => setVehiculoModelo(e.target.value)} placeholder="Ej. Sorento" className="mt-1.5 w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm" />
              </label>
              <label className="text-xs font-bold text-slate-300 uppercase">
                Año
                <input value={vehiculoAno} onChange={(e) => setVehiculoAno(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Ej. 2026" inputMode="numeric" className="mt-1.5 w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm" />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="text-xs font-bold text-slate-300 uppercase">
              Precio del vehículo
              <input type="number" min={0} value={precio} onChange={(e) => setPrecio(Number(e.target.value) || 0)} className="mt-1.5 w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm" />
            </label>

            <div>
              <div className="text-xs font-bold text-slate-300 uppercase mb-1.5">Enganche</div>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button type="button" onClick={() => setModoEnganche('PORCENTAJE')} className={'py-2 rounded-xl border text-xs font-bold ' + (modoEnganche === 'PORCENTAJE' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-slate-300')}>Porcentaje (%)</button>
                <button type="button" onClick={() => setModoEnganche('MONTO')} className={'py-2 rounded-xl border text-xs font-bold ' + (modoEnganche === 'MONTO' ? 'bg-red-600 border-red-500 text-white' : 'bg-white/5 border-white/10 text-slate-300')}>Efectivo ($)</button>
              </div>
              {modoEnganche === 'MONTO' ? (
                <input type="number" min={0} max={precio || undefined} step={1} value={engancheMonto} onChange={(e) => setEngancheMonto(Number(e.target.value) || 0)} className="w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm" />
              ) : (
                <input type="number" min={20} max={100} step={0.01} value={enganchePorcentaje} onChange={(e) => setEnganchePorcentaje(Number(e.target.value) || 0)} className="w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm" />
              )}
              <p className="text-[11px] text-slate-400 mt-1.5">Equivalente: {porcentajeReal.toFixed(2)}%</p>
            </div>

            <label className="text-xs font-bold text-slate-300 uppercase">
              Plazo
              <select value={plazo} onChange={(e) => setPlazo(Number(e.target.value))} className="mt-1.5 w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm">
                <option value={12}>12 meses</option>
                <option value={24}>24 meses</option>
                <option value={36}>36 meses</option>
                <option value={48}>48 meses</option>
              </select>
            </label>

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
                <input type="number" min={0} step={1} value={seguroMonto} onChange={(e) => setSeguroMonto(Number(e.target.value) || 0)} className="mt-1.5 w-full rounded-xl bg-[#121824] text-slate-100 border border-[#2E3A59] placeholder:text-slate-500 px-3 py-2.5 text-sm" />
              </label>
            </div>

            <div className="mt-3 text-xs text-slate-400">
              {seguroModo === 'NINGUNO' && 'No se agrega seguro a la cotización.'}
              {seguroModo === 'CONTADO' && <>El cliente paga <strong className="text-white">{money(seguro)}</strong> al inicio; la mensualidad no cambia y este importe sí se suma al desembolso inicial.</>}
              {seguroModo === 'FINANCIADO' && <>Se agregan <strong className="text-white">{money(seguro)}</strong> al capital financiado; la mensualidad cambia a <strong className="text-red-300">{money(mensualidad)}</strong>.</>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-[11px] text-slate-400">Enganche</div><div className="text-base font-black text-white mt-1">{money(enganche)}</div></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-[11px] text-slate-400">A financiar</div><div className="text-base font-black text-emerald-400 mt-1">{money(montoFinanciar)}</div></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-[11px] text-slate-400">Mensualidad</div><div className="text-base font-black text-red-300 mt-1">{money(mensualidad)}</div></div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-4"><div className="text-[11px] text-slate-400">Total pagos</div><div className="text-base font-black text-white mt-1">{money(totalPagos)}</div></div>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-xs font-black text-white uppercase">Desembolso total inicial</div>
                <div className="text-[11px] text-slate-400 mt-1">Lo que debe cubrir el cliente al inicio, sin modificar la mensualidad.</div>
              </div>
              <div className="text-lg sm:text-xl font-black text-red-300">{money(desembolsoTotal)}</div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                <div className="text-[10px] text-slate-400 uppercase">Enganche</div>
                <div className="text-sm font-black text-white mt-1">{money(enganche)}</div>
              </div>
              <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                <div className="text-[10px] text-slate-400 uppercase">Comisión apertura (3%)</div>
                <div className="text-sm font-black text-white mt-1">{money(comisionApertura)}</div>
              </div>
              <div className="rounded-xl bg-black/20 border border-white/10 p-3">
                <div className="text-[10px] text-slate-400 uppercase">Seguro (contado)</div>
                <div className="text-sm font-black text-white mt-1">{money(seguroDeContado)}</div>
              </div>
            </div>
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
