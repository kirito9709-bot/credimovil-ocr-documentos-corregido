import React, { useEffect, useState } from 'react';
import { X, Users, Upload, ScanLine, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { ExpedienteCredito, IneData, ReferenciaPersonal, ObligadoSolidarioDocumentos, NominaDocumento } from '../types';
import { api } from '../services/api';

interface Props {
  expediente: ExpedienteCredito;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (expediente: ExpedienteCredito) => void;
}

const emptyDomicilio: IneData['domicilio'] = {
  calle: '', numExterior: '', numInterior: '', colonia: '', codigoPostal: '', municipio: '', estado: '', domicilioCompleto: ''
};

const makeRef = (familiar = false): ReferenciaPersonal => ({
  nombre: '', telefono: '', relacion: '', esFamiliar: familiar, ciudad: ''
});

const readFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer el archivo.'));
  reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
  reader.readAsDataURL(file);
});

export const AgregarObligadoModal: React.FC<Props> = ({ expediente, isOpen, onClose, onSaved }) => {
  const existing = expediente.obligadoSolidario;

  const [nombre, setNombre] = useState(existing?.nombre || '');
  const [curp, setCurp] = useState(existing?.curp || '');
  const [rfc, setRfc] = useState(existing?.rfc || '');
  const [fechaNacimiento, setFechaNacimiento] = useState(existing?.fechaNacimiento || '');
  const [sexo, setSexo] = useState(existing?.sexo || '');
  const [telefono, setTelefono] = useState(existing?.telefono || '');
  const [correo, setCorreo] = useState(existing?.correo || '');
  const [estadoCivil, setEstadoCivil] = useState(existing?.estadoCivil || '');
  const [ingreso, setIngreso] = useState<number | ''>(existing?.ingresoMensualAprox ?? '');
  const [vivienda, setVivienda] = useState(existing?.casaPropiaORentada || '');
  const [antiguedadDomicilio, setAntiguedadDomicilio] = useState(existing?.tiempoViviendoDomicilio || '');
  const [empresa, setEmpresa] = useState(existing?.nombreUbicacionEmpleo || '');
  const [antiguedadEmpleo, setAntiguedadEmpleo] = useState(existing?.tiempoEnTrabajo || '');
  const [direccionEmpleo, setDireccionEmpleo] = useState(existing?.direccionEmpleo || '');
  const [dependientes, setDependientes] = useState<number>(existing?.dependientesEconomicos || 0);
  const [domicilio, setDomicilio] = useState(existing?.domicilio || emptyDomicilio);
  const [referencias, setReferencias] = useState<ReferenciaPersonal[]>(existing?.referenciasPersonales?.length === 3 ? existing.referenciasPersonales : [makeRef(), makeRef(), makeRef(true)]);

  const [ineFrente, setIneFrente] = useState(existing?.fotoIneFrente || '');
  const [ineFrenteNombre, setIneFrenteNombre] = useState(existing?.fotoIneFrenteNombre || '');
  const [ineReverso, setIneReverso] = useState(existing?.fotoIneReverso || '');
  const [ineReversoNombre, setIneReversoNombre] = useState(existing?.fotoIneReversoNombre || '');
  const [comprobante, setComprobante] = useState(existing?.comprobanteDomicilioUrl || '');
  const [comprobanteNombre, setComprobanteNombre] = useState(existing?.comprobanteDomicilioNombre || '');
  const [nominas, setNominas] = useState<NominaDocumento[]>(existing?.nominas || []);

  const [ocrLoading, setOcrLoading] = useState(false);
  const [domOcrLoading, setDomOcrLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const os = expediente.obligadoSolidario;
    setNombre(os?.nombre || ''); setCurp(os?.curp || ''); setRfc(os?.rfc || '');
    setFechaNacimiento(os?.fechaNacimiento || ''); setSexo(os?.sexo || '');
    setTelefono(os?.telefono || ''); setCorreo(os?.correo || ''); setEstadoCivil(os?.estadoCivil || '');
    setIngreso(os?.ingresoMensualAprox ?? ''); setVivienda(os?.casaPropiaORentada || '');
    setAntiguedadDomicilio(os?.tiempoViviendoDomicilio || ''); setEmpresa(os?.nombreUbicacionEmpleo || '');
    setAntiguedadEmpleo(os?.tiempoEnTrabajo || ''); setDireccionEmpleo(os?.direccionEmpleo || '');
    setDependientes(os?.dependientesEconomicos || 0); setDomicilio(os?.domicilio || emptyDomicilio);
    setReferencias(os?.referenciasPersonales?.length === 3 ? os.referenciasPersonales : [makeRef(), makeRef(), makeRef(true)]);
    setIneFrente(os?.fotoIneFrente || ''); setIneFrenteNombre(os?.fotoIneFrenteNombre || '');
    setIneReverso(os?.fotoIneReverso || ''); setIneReversoNombre(os?.fotoIneReversoNombre || '');
    setComprobante(os?.comprobanteDomicilioUrl || ''); setComprobanteNombre(os?.comprobanteDomicilioNombre || '');
    setNominas(os?.nominas || []); setError('');
  }, [isOpen, expediente.id]);

  if (!isOpen) return null;

  const updateRef = (index: number, field: keyof ReferenciaPersonal, value: string | boolean) => {
    setReferencias((prev) => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  };

  const uploadFile = async (file: File, kind: 'frente' | 'reverso' | 'domicilio' | 'nomina') => {
    const data = await readFile(file);
    if (kind === 'frente') { setIneFrente(data); setIneFrenteNombre(file.name); }
    if (kind === 'reverso') { setIneReverso(data); setIneReversoNombre(file.name); }
    if (kind === 'domicilio') { setComprobante(data); setComprobanteNombre(file.name); }
    if (kind === 'nomina') {
      if (nominas.length >= 3) throw new Error('Puedes agregar hasta 3 nóminas.');
      setNominas((prev) => [...prev, { archivoUrl: data, archivoNombre: file.name, archivoTipo: file.type, archivoTamano: file.size, fechaSubida: new Date().toISOString() }]);
    }
  };

  const doIneOcr = async () => {
    if (!ineFrente) { setError('Sube primero el frente del INE.'); return; }
    setOcrLoading(true); setError('');
    try {
      const result = await api.scanIne(ineFrente, ineReverso || undefined);
      const d = result.data;
      setNombre(d.nombreCompleto || [d.nombre, d.primerApellido, d.segundoApellido].filter(Boolean).join(' '));
      setCurp(d.curp || ''); setRfc(d.rfc || ''); setFechaNacimiento(d.fechaNacimiento || ''); setSexo(d.sexo || '');
      if (d.domicilio && d.domicilio.domicilioCompleto) setDomicilio(d.domicilio);
    } catch (e: any) {
      setError(e.message || 'No se pudo ejecutar el OCR del obligado.');
    } finally { setOcrLoading(false); }
  };

  const doDomicilioOcr = async () => {
    if (!comprobante) { setError('Sube primero el comprobante de domicilio.'); return; }
    setDomOcrLoading(true); setError('');
    try {
      const result = await api.scanComprobanteDomicilio(comprobante);
      const d = result.data || result.domicilio || result;
      setDomicilio({
        calle: d.calle || '', numExterior: d.numExterior || '', numInterior: d.numInterior || '',
        colonia: d.colonia || '', codigoPostal: d.codigoPostal || '', municipio: d.municipio || '',
        estado: d.estado || '', domicilioCompleto: d.domicilioCompleto || d.direccionCompleta || ''
      });
    } catch (e: any) {
      setError(e.message || 'No se pudo leer el comprobante de domicilio.');
    } finally { setDomOcrLoading(false); }
  };

  const save = async () => {
    setError('');
    if (!nombre.trim() || !telefono.trim() || !ingreso || !vivienda || !antiguedadDomicilio.trim() || !empresa.trim() || !antiguedadEmpleo.trim() || !direccionEmpleo.trim() || !estadoCivil) {
      setError('Completa los datos obligatorios del obligado solidario.');
      return;
    }
    if (!ineFrente || !ineReverso || !comprobante) {
      setError('Para agregar al obligado se requiere INE frente, INE reverso y comprobante de domicilio.');
      return;
    }
    if (referencias.some((r) => !r.nombre.trim() || !r.telefono.trim())) {
      setError('Completa nombre y teléfono de las 3 referencias.');
      return;
    }

    const obligadoSolidario: ObligadoSolidarioDocumentos = {
      ...(existing || {}),
      requerido: true,
      nombre: nombre.trim(), curp: curp.trim().toUpperCase(), rfc: rfc.trim().toUpperCase(),
      fechaNacimiento, sexo, telefono: telefono.trim(), correo: correo.trim(),
      estadoCivil: estadoCivil as any, ingresoMensualAprox: Number(ingreso) || 0,
      casaPropiaORentada: vivienda as any, tiempoViviendoDomicilio: antiguedadDomicilio.trim(),
      nombreUbicacionEmpleo: empresa.trim(), tiempoEnTrabajo: antiguedadEmpleo.trim(),
      direccionEmpleo: direccionEmpleo.trim(), dependientesEconomicos: Number(dependientes) || 0,
      domicilio, referenciasPersonales: referencias,
      fotoIneFrente: ineFrente, fotoIneFrenteNombre: ineFrenteNombre,
      fotoIneReverso: ineReverso, fotoIneReversoNombre: ineReversoNombre,
      comprobanteDomicilioUrl: comprobante, comprobanteDomicilioNombre: comprobanteNombre,
      nominas, estadosCuenta: existing?.estadosCuenta || {},
    };

    setSaving(true);
    try {
      const res = await api.updateExpediente(expediente.id, { obligadoSolidario });
      if (!res.success || !res.expediente) throw new Error(res.message || 'No se pudo guardar el obligado.');
      onSaved(res.expediente);
      onClose();
    } catch (e: any) {
      setError(e.message || 'No se pudo guardar el obligado solidario.');
    } finally { setSaving(false); }
  };

  const field = (label: string, value: any, setValue: (v: any) => void, placeholder = '') => (
    <label className="block">
      <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</span>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:border-amber-500 outline-none" />
    </label>
  );

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-amber-500/30 rounded-3xl shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between p-5 bg-slate-950 border-b border-slate-800">
          <div><h3 className="text-lg font-black text-white flex items-center gap-2"><Users className="w-5 h-5 text-amber-400" />Agregar obligado solidario</h3><p className="text-xs text-slate-400 mt-1">{expediente.folio} · Se puede agregar después de haber creado el expediente.</p></div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-6">
          {error && <div className="p-3 rounded-xl bg-red-950/30 border border-red-500/30 text-xs text-red-200">{error}</div>}

          <section className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between"><h4 className="text-sm font-black text-white">1. Identificación y OCR</h4><button type="button" onClick={doIneOcr} disabled={ocrLoading} className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black inline-flex items-center gap-2">{ocrLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <ScanLine className="w-4 h-4"/>} OCR del obligado</button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {field('Nombre completo *',nombre,setNombre,'Nombre completo')}
              {field('CURP',curp,setCurp,'CURP')}
              {field('RFC',rfc,setRfc,'RFC')}
              {field('Fecha de nacimiento *',fechaNacimiento,setFechaNacimiento)}
              {field('Sexo',sexo,setSexo,'H / M / X')}
              {field('Teléfono *',telefono,setTelefono,'81 1234 5678')}
              {field('Correo',correo,setCorreo,'correo@ejemplo.com')}
              <label><span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Estado civil *</span><select value={estadoCivil} onChange={e=>setEstadoCivil(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"><option value="">Seleccionar...</option><option value="SOLTERO">Soltero(a)</option><option value="CASADO">Casado(a)</option><option value="UNION_LIBRE">Unión libre</option><option value="DIVORCIADO">Divorciado(a)</option><option value="VIUDO">Viudo(a)</option></select></label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="p-3 rounded-xl border border-slate-700 bg-slate-950 cursor-pointer"><span className="text-xs font-bold text-slate-300">INE frente</span><input type="file" accept="image/*,application/pdf" className="block w-full mt-2 text-xs" onChange={e=>{const f=e.target.files?.[0]; if(f) uploadFile(f,'frente').catch(x=>setError(x.message));}} />{ineFrente && <span className="text-[10px] text-emerald-400 block mt-1"><CheckCircle2 className="inline w-3 h-3"/> {ineFrenteNombre || 'Cargado'}</span>}</label>
              <label className="p-3 rounded-xl border border-slate-700 bg-slate-950 cursor-pointer"><span className="text-xs font-bold text-slate-300">INE reverso</span><input type="file" accept="image/*,application/pdf" className="block w-full mt-2 text-xs" onChange={e=>{const f=e.target.files?.[0]; if(f) uploadFile(f,'reverso').catch(x=>setError(x.message));}} />{ineReverso && <span className="text-[10px] text-emerald-400 block mt-1"><CheckCircle2 className="inline w-3 h-3"/> {ineReversoNombre || 'Cargado'}</span>}</label>
            </div>
          </section>

          <section className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
            <h4 className="text-sm font-black text-white">2. Perfil socioeconómico y laboral</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {field('Ingreso mensual comprobable *',ingreso,setIngreso,'35000')}
              <label><span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vivienda *</span><select value={vivienda} onChange={e=>setVivienda(e.target.value as any)} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white"><option value="">Seleccionar...</option><option value="PROPIA">Propia</option><option value="RENTADA">Rentada</option><option value="FAMILIAR">Familiar</option></select></label>
              {field('Antigüedad domicilio *',antiguedadDomicilio,setAntiguedadDomicilio,'5 años')}
              {field('Empresa / lugar de trabajo *',empresa,setEmpresa,'Empresa XYZ')}
              {field('Antigüedad empleo *',antiguedadEmpleo,setAntiguedadEmpleo,'3 años')}
              {field('Dependientes económicos',dependientes,setDependientes,'0')}
            </div>
            {field('Dirección del empleo *',direccionEmpleo,setDireccionEmpleo,'Calle, número, colonia, municipio, estado')}
          </section>

          <section className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between"><h4 className="text-sm font-black text-white">3. Domicilio y OCR</h4><button type="button" onClick={doDomicilioOcr} disabled={domOcrLoading} className="px-3 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black inline-flex items-center gap-2">{domOcrLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <ScanLine className="w-4 h-4"/>} OCR domicilio</button></div>
            <label className="p-3 rounded-xl border border-slate-700 bg-slate-950 block"><span className="text-xs font-bold text-slate-300">Comprobante de domicilio *</span><input type="file" accept="image/*,application/pdf" className="block w-full mt-2 text-xs" onChange={e=>{const f=e.target.files?.[0]; if(f) uploadFile(f,'domicilio').catch(x=>setError(x.message));}} />{comprobante && <span className="text-[10px] text-emerald-400 block mt-1"><CheckCircle2 className="inline w-3 h-3"/> {comprobanteNombre || 'Cargado'}</span>}</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {(['calle','numExterior','numInterior','colonia','codigoPostal','municipio','estado','domicilioCompleto'] as const).map(k => (
                <label key={k}><span className="text-[10px] text-slate-500 uppercase">{k}</span><input value={domicilio[k]} onChange={e=>setDomicilio({...domicilio,[k]:e.target.value})} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"/></label>
              ))}
            </div>
          </section>

          <section className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-4">
            <h4 className="text-sm font-black text-white">4. Referencias personales</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {referencias.map((ref,index)=>(
                <div key={index} className="p-3 rounded-xl border border-slate-700 bg-slate-950 space-y-2">
                  <div className="text-xs font-black text-slate-300">{index===2 ? 'Referencia familiar' : 'Referencia '+(index+1)}</div>
                  <input value={ref.nombre} onChange={e=>updateRef(index,'nombre',e.target.value)} placeholder="Nombre" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"/>
                  <input value={ref.telefono} onChange={e=>updateRef(index,'telefono',e.target.value)} placeholder="Teléfono" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"/>
                  <input value={ref.relacion} onChange={e=>updateRef(index,'relacion',e.target.value)} placeholder="Relación" className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white"/>
                </div>
              ))}
            </div>
          </section>

          <section className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between"><h4 className="text-sm font-black text-white">5. Nóminas</h4><span className="text-[10px] text-slate-500">Opcionales · máximo 3</span></div>
            <input type="file" accept="application/pdf,image/*" onChange={e=>{const f=e.target.files?.[0]; if(f) uploadFile(f,'nomina').catch(x=>setError(x.message));}} className="text-xs w-full"/>
            {nominas.map((n,i)=><div key={i} className="text-xs text-emerald-400">{i+1}. {n.archivoNombre || 'Nómina cargada'}</div>)}
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 p-4 bg-slate-950 border-t border-slate-800">
          <span className="text-[11px] text-slate-500">Los estados de cuenta del obligado siguen siendo opcionales.</span>
          <div className="flex gap-2"><button onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold">Cancelar</button><button onClick={save} disabled={saving} className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-black inline-flex items-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4"/>} Guardar obligado solidario</button></div>
        </div>
      </div>
    </div>
  );
};
