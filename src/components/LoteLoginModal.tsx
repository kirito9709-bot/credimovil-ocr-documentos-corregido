import React, { useState } from 'react';
import { Building2, Lock, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { api } from '../services/api';

interface Props { isOpen: boolean; onClose: () => void; onSuccess: (user: any) => void; }

export const LoteLoginModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setMessage('');
    try {
      const res = await api.login(username.trim(), password);
      if (res.user?.role !== 'lote') throw new Error('Estas credenciales no corresponden a un usuario de lote.');
      localStorage.setItem('credimovil_auth_token', res.token);
      localStorage.setItem('credimovil_auth_user', JSON.stringify(res.user));
      onSuccess(res.user); setUsername(''); setPassword('');
    } catch (err: any) { setMessage(err.message || 'No se pudo iniciar sesión.'); }
    finally { setLoading(false); }
  };

  return <div className='fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4'>
    <div className='w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden'>
      <div className='flex items-center justify-between px-6 py-4 border-b border-slate-800'><div className='flex items-center gap-2'><Building2 className='w-5 h-5 text-emerald-400' /><h3 className='text-white font-bold'>Acceso para Lotes Aliados</h3></div><button onClick={onClose} className='p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800'><X className='w-4 h-4' /></button></div>
      <form onSubmit={submit} className='p-6 space-y-4'>
        <p className='text-xs text-slate-400'>Ingresa con el usuario y contraseña que te proporcionó CrediMóvil.</p>
        <div><label className='text-xs text-slate-400 block mb-1'>Usuario</label><div className='relative'><KeyRound className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500' /><input autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} className='w-full py-2.5 pl-9 pr-3 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-emerald-500' /></div></div>
        <div><label className='text-xs text-slate-400 block mb-1'>Contraseña</label><div className='relative'><Lock className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500' /><input required type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className='w-full py-2.5 pl-9 pr-10 rounded-xl bg-slate-950 border border-slate-700 text-white outline-none focus:border-emerald-500' /><button type='button' onClick={() => setShowPassword((v) => !v)} className='absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-500 hover:text-white'>{showPassword ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}</button></div></div>
        {message && <div className='p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-200 text-xs'>{message}</div>}
        <button disabled={loading} className='w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-black text-sm'>{loading ? 'Validando...' : 'Entrar al Portal'}</button>
      </form>
    </div>
  </div>;
};
