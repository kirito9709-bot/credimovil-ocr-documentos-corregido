import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X, RefreshCw, Building2, User } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  authUser: { username: string; role: 'admin' | 'asesor' | 'lote'; nombre: string; loteId?: string | null };
  lotes: Array<{ id: string; nombre: string }>;
  initialLoteId?: string | null;
}

export const ChatLoteModal: React.FC<Props> = ({ isOpen, onClose, authUser, lotes, initialLoteId }) => {
  const isLote = authUser.role === 'lote';
  const [selectedLoteId, setSelectedLoteId] = useState(initialLoteId || authUser.loteId || '');
  const [messages, setMessages] = useState<any[]>([]);
  const [chatLoteName, setChatLoteName] = useState('Lote');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const lotName = useMemo(() => lotes.find((l) => l.id === selectedLoteId)?.nombre || chatLoteName, [lotes, selectedLoteId, chatLoteName]);

  const load = async (silent = false) => {
    if (!selectedLoteId) return;
    if (!silent) setLoading(true);
    try {
      const res = await api.getLoteChat(selectedLoteId);
      if (res.success) { setMessages(res.mensajes || []); setChatLoteName(res.lote?.nombre || 'Lote'); }
      else setError(res.message || 'No se pudo cargar el chat.');
    } catch (err: any) { if (!silent) setError(err.message || 'No se pudo cargar el chat.'); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (isLote) setSelectedLoteId(authUser.loteId || '');
    else if (!initialLoteId && lotes.length && !selectedLoteId) setSelectedLoteId(lotes[0].id);
  }, [isOpen, isLote, authUser.loteId, initialLoteId, lotes.length]);

  useEffect(() => {
    if (!isOpen || !selectedLoteId) return;
    load(false);
    const timer = window.setInterval(() => load(true), 4000);
    return () => window.clearInterval(timer);
  }, [isOpen, selectedLoteId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    const text = input.trim();
    if (!text || !selectedLoteId || sending) return;
    setSending(true); setError('');
    try {
      const res = await api.sendLoteChatMessage(selectedLoteId, text);
      if (res.success && res.mensaje) { setMessages((prev) => [...prev, res.mensaje]); setInput(''); }
      else setError(res.message || 'No se pudo enviar el mensaje.');
    } catch (err: any) { setError(err.message || 'No se pudo enviar el mensaje.'); }
    finally { setSending(false); }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5'>
      <div className='w-full max-w-2xl h-[80vh] bg-slate-950 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col'>
        <div className='px-5 py-4 border-b border-slate-800 flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <div className='flex items-center gap-2 text-white font-black'><MessageCircle className='w-5 h-5 text-emerald-400' /> Chat con CrediMóvil</div>
            <div className='text-xs text-slate-400 mt-1 truncate'>{lotName}</div>
          </div>
          <div className='flex items-center gap-2'>
            {!isLote && <select value={selectedLoteId} onChange={(e) => setSelectedLoteId(e.target.value)} className='max-w-48 py-2 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs'>
              <option value=''>Selecciona lote...</option>
              {lotes.map((lote) => <option key={lote.id} value={lote.id}>{lote.nombre}</option>)}
            </select>}
            <button onClick={() => load(false)} className='p-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white' title='Actualizar'><RefreshCw className={loading ? 'w-4 h-4 animate-spin' : 'w-4 h-4'} /></button>
            <button onClick={onClose} className='p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900'><X className='w-5 h-5' /></button>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto p-4 space-y-3'>
          {!selectedLoteId ? (
            <div className='h-full flex items-center justify-center text-sm text-slate-500'>Selecciona un lote para iniciar la conversación.</div>
          ) : messages.length === 0 ? (
            <div className='h-full flex items-center justify-center text-center text-sm text-slate-500'>
              <div><MessageCircle className='w-10 h-10 mx-auto mb-3 text-slate-700' /><div className='font-semibold'>Aún no hay mensajes</div><div className='text-xs mt-1'>Escribe para comunicarte directamente con el lote.</div></div>
            </div>
          ) : messages.map((m) => {
            const mine = m.autor_usuario === authUser.username;
            return <div key={m.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}>
              <div className={'max-w-[82%] rounded-2xl px-4 py-3 border ' + (mine ? 'bg-emerald-600/20 border-emerald-500/30' : 'bg-slate-900 border-slate-800')}>
                <div className='flex items-center gap-1.5 text-[10px] text-slate-400 mb-1'><User className='w-3 h-3' />{m.autor_nombre} • {m.autor_tipo === 'lote' ? 'Lote' : 'CrediMóvil'}</div>
                <div className='text-sm text-slate-100 whitespace-pre-wrap break-words'>{m.mensaje}</div>
                <div className='text-[10px] text-slate-500 mt-1.5 text-right'>{m.created_at ? new Date(m.created_at).toLocaleString('es-MX') : ''}</div>
              </div>
            </div>;
          })}
          <div ref={bottomRef} />
        </div>

        {error && <div className='px-4 py-2 bg-rose-950/50 border-t border-rose-800/50 text-rose-200 text-xs'>{error}</div>}
        <div className='p-4 border-t border-slate-800 bg-slate-950'>
          <div className='flex items-end gap-2'>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} rows={2} maxLength={2000} placeholder='Escribe un mensaje para el lote...' className='flex-1 resize-none py-3 px-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm outline-none focus:border-emerald-500' />
            <button onClick={send} disabled={sending || !selectedLoteId || !input.trim()} className='p-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950' title='Enviar'><Send className='w-5 h-5' /></button>
          </div>
          <div className='text-[10px] text-slate-600 mt-1'>Enter para enviar • Shift+Enter para salto de línea</div>
        </div>
      </div>
    </div>
  );
};
