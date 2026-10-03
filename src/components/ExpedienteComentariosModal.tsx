import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X, RefreshCw, Paperclip, ClipboardList } from 'lucide-react';
import { api } from '../services/api';

interface Props { isOpen: boolean; onClose: () => void; expedienteId: string; folio: string; authUser: { username: string; role: 'admin' | 'asesor' | 'lote'; nombre: string }; }

export const ExpedienteComentariosModal: React.FC<Props> = ({ isOpen, onClose, expedienteId, folio, authUser }) => {
  const [items, setItems] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [tipo, setTipo] = useState<'COMENTARIO' | 'SOLICITUD'>('COMENTARIO');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottom = useRef<HTMLDivElement | null>(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try { const res = await api.getExpedienteComentarios(expedienteId); if (res.success) setItems(res.comentarios || []); else setError(res.message || 'No se pudieron cargar los comentarios.'); }
    catch (err: any) { if (!silent) setError(err.message || 'No se pudieron cargar los comentarios.'); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    if (!isOpen) return;
    load(false);
    const timer = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(timer);
  }, [isOpen, expedienteId]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [items.length]);

  const send = async () => {
    const value = text.trim(); if (!value || sending) return;
    setSending(true); setError('');
    try { const res = await api.addExpedienteComentario(expedienteId, { comentario: value, tipo }); if (res.success && res.comentario) { setItems((prev) => [...prev, res.comentario]); setText(''); setTipo('COMENTARIO'); } else setError(res.message || 'No se pudo guardar el comentario.'); }
    catch (err: any) { setError(err.message || 'No se pudo guardar el comentario.'); }
    finally { setSending(false); }
  };

  if (!isOpen) return null;
  return <div className='fixed inset-0 z-[85] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5'>
    <div className='w-full max-w-2xl h-[75vh] bg-slate-950 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col'>
      <div className='px-5 py-4 border-b border-slate-800 flex items-center justify-between'>
        <div><div className='flex items-center gap-2 text-white font-black'><MessageSquare className='w-5 h-5 text-red-400' /> Comentarios del expediente</div><div className='text-xs text-red-400 font-mono mt-1'>{folio}</div></div>
        <div className='flex items-center gap-2'><button onClick={() => load(false)} className='p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-400 hover:text-white'><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /></button><button onClick={onClose} className='p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900'><X className='w-5 h-5' /></button></div>
      </div>
      <div className='flex-1 overflow-y-auto p-4 space-y-3'>
        {items.length === 0 ? <div className='h-full flex items-center justify-center text-sm text-slate-500 text-center'><div><MessageSquare className='w-10 h-10 mx-auto mb-3 text-slate-700' /><div>No hay comentarios todavía.</div><div className='text-xs mt-1'>Úsalo para pedir documentos, aclaraciones o seguimiento.</div></div></div> : items.map((item) => <div key={item.id} className='bg-slate-900 border border-slate-800 rounded-2xl p-4'><div className='flex items-center justify-between gap-3 mb-2'><div className='text-xs font-bold text-white'>{item.autor_nombre} <span className='text-slate-500'>• {item.autor_tipo === 'lote' ? 'Lote' : 'CrediMóvil'}</span></div><span className={'text-[10px] font-bold px-2 py-1 rounded-full border ' + (item.tipo === 'SOLICITUD' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' : 'bg-slate-800 text-slate-400 border-slate-700')}>{item.tipo === 'SOLICITUD' ? 'SOLICITUD' : 'COMENTARIO'}</span></div><div className='text-sm text-slate-200 whitespace-pre-wrap'>{item.comentario}</div><div className='text-[10px] text-slate-600 mt-2'>{item.created_at ? new Date(item.created_at).toLocaleString('es-MX') : ''}</div></div>)}
        <div ref={bottom} />
      </div>
      {error && <div className='px-4 py-2 bg-rose-950/50 border-t border-rose-800/50 text-rose-200 text-xs'>{error}</div>}
      <div className='p-4 border-t border-slate-800'>
        <div className='flex gap-2 mb-2'><button type='button' onClick={() => setTipo('COMENTARIO')} className={'px-3 py-1.5 rounded-lg text-[11px] font-bold border ' + (tipo === 'COMENTARIO' ? 'bg-slate-700 text-white border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-800')}><MessageSquare className='w-3 h-3 inline mr-1' />Comentario</button><button type='button' onClick={() => setTipo('SOLICITUD')} className={'px-3 py-1.5 rounded-lg text-[11px] font-bold border ' + (tipo === 'SOLICITUD' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-slate-900 text-slate-500 border-slate-800')}><ClipboardList className='w-3 h-3 inline mr-1' />Solicitar documento/dato</button></div>
        <div className='flex items-end gap-2'><textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if(e.key==='Enter' && !e.shiftKey){e.preventDefault();send();} }} rows={2} maxLength={3000} placeholder={tipo === 'SOLICITUD' ? 'Ej. Falta comprobante de domicilio...' : 'Escribe una nota del expediente...'} className='flex-1 resize-none py-3 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-red-500' /><button onClick={send} disabled={sending || !text.trim()} className='p-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white'><Send className='w-5 h-5' /></button></div>
      </div>
    </div>
  </div>;
};
