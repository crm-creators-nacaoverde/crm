import { useState, useEffect, useRef } from 'react';
import AppLayout from '../../../components/feature/AppLayout';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';
import { useNotificationContext } from '../../../contexts/NotificationContext';

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div className="fixed bottom-6 right-6 z-50 animate-[fadeIn_0.2s_ease-out]">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl ${type === 'success' ? 'bg-gray-900 text-white' : 'bg-rose-600 text-white'}`}>
        <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${type === 'success' ? 'bg-emerald-500/20' : 'bg-white/20'}`}>
          <i className={`text-lg ${type === 'success' ? 'ri-check-line text-emerald-400' : 'ri-error-warning-line text-white'}`}></i>
        </div>
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}

const AVATAR_COLORS = [
  'from-[#5de0e6] to-[#004aad]',
  'from-violet-400 to-purple-600',
  'from-emerald-400 to-teal-600',
  'from-rose-400 to-pink-600',
  'from-amber-400 to-orange-500',
  'from-sky-400 to-blue-600',
];

export default function ConfiguracoesUsuarioPage() {
  const { user, profile } = useAuth();
  const { logActivity } = useActivityLog();
  const { requestPermission, permission, sendNotification } = useNotificationContext();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [activeSection, setActiveSection] = useState<'perfil' | 'seguranca' | 'notificacoes'>('perfil');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [selectedAvatarColor, setSelectedAvatarColor] = useState(AVATAR_COLORS[0]);

  // Perfil
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    whatsapp: '',
  });

  // Segurança
  const [passForm, setPassForm] = useState({
    current: '',
    new: '',
    confirm: '',
  });
  const [showPass, setShowPass] = useState({ current: false, new: false, confirm: false });
  const [passErrors, setPassErrors] = useState<Record<string, string>>({});

  // Notificações
  const [notifForm, setNotifForm] = useState({
    notif_push: true,
    notif_email: true,
    notif_sample_days: 3,
    notif_sample_transit: true,
    notif_sample_no_address: true,
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        email: profile.email || '',
        phone: (profile as any).phone || '',
        whatsapp: (profile as any).whatsapp || '',
      });
      setNotifForm({
        notif_push: (profile as any).notif_push ?? true,
        notif_email: (profile as any).notif_email ?? true,
        notif_sample_days: (profile as any).notif_sample_days ?? 3,
        notif_sample_transit: (profile as any).notif_sample_transit ?? true,
        notif_sample_no_address: (profile as any).notif_sample_no_address ?? true,
      });
      if ((profile as any).avatar_base64) setAvatarPreview((profile as any).avatar_base64);
    }
  }, [profile]);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setToast({ message: 'Imagem deve ter no máximo 2MB', type: 'error' }); return; }
    const reader = new FileReader();
    reader.onload = ev => { setAvatarPreview(ev.target?.result as string); };
    reader.readAsDataURL(file);
  };

  // ── Salvar Perfil ──
  const saveProfile = async () => {
    if (!profileForm.full_name.trim()) { setToast({ message: 'Nome é obrigatório', type: 'error' }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('user_profiles').update({
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone,
        whatsapp: profileForm.whatsapp,
        avatar_base64: avatarPreview || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user!.id);
      if (error) throw error;
      await logActivity({ action: 'update', module: 'settings', entityId: user!.id, entityName: profileForm.full_name, details: { section: 'user_profile' } });
      setToast({ message: 'Perfil atualizado com sucesso!', type: 'success' });
    } catch {
      setToast({ message: 'Erro ao salvar perfil.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Salvar Senha ──
  const savePassword = async () => {
    const errs: Record<string, string> = {};
    if (!passForm.current) errs.current = 'Informe a senha atual';
    if (!passForm.new || passForm.new.length < 6) errs.new = 'Mínimo 6 caracteres';
    if (passForm.new !== passForm.confirm) errs.confirm = 'As senhas não coincidem';
    if (Object.keys(errs).length) { setPassErrors(errs); return; }
    setPassErrors({});
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passForm.new });
      if (error) throw error;
      setPassForm({ current: '', new: '', confirm: '' });
      setToast({ message: 'Senha alterada com sucesso!', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Erro ao alterar senha.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Salvar Notificações ──
  const saveNotifications = async () => {
    setSaving(true);
    try {
      if (notifForm.notif_push && permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setToast({ message: 'Permissão de notificação negada pelo navegador', type: 'error' });
          setSaving(false);
          return;
        }
      }
      const { error } = await supabase.from('user_profiles').update({
        notif_push: notifForm.notif_push,
        notif_email: notifForm.notif_email,
        notif_sample_days: notifForm.notif_sample_days,
        notif_sample_transit: notifForm.notif_sample_transit,
        notif_sample_no_address: notifForm.notif_sample_no_address,
        updated_at: new Date().toISOString(),
      }).eq('id', user!.id);
      if (error) throw error;
      // Salvar também no localStorage (compatibilidade)
      const ls = JSON.parse(localStorage.getItem('crm_settings') || '{}');
      localStorage.setItem('crm_settings', JSON.stringify({
        ...ls,
        notifications: notifForm.notif_push,
        emailAlerts: notifForm.notif_email,
        sampleAlertDays: notifForm.notif_sample_days,
        sampleAlertTransit: notifForm.notif_sample_transit,
        sampleAlertNoAddress: notifForm.notif_sample_no_address,
      }));
      if (notifForm.notif_push) sendNotification('Notificações ativas! 🔔', { body: 'Você receberá alertas de amostras e atualizações.' });
      setToast({ message: 'Preferências de notificação salvas!', type: 'success' });
    } catch {
      setToast({ message: 'Erro ao salvar notificações.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/30 focus:border-[#5de0e6] bg-white transition-all';
  const lbl = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  const NAV = [
    { id: 'perfil',        label: 'Meu Perfil',      icon: 'ri-user-line' },
    { id: 'seguranca',     label: 'Segurança',        icon: 'ri-shield-keyhole-line' },
    { id: 'notificacoes',  label: 'Notificações',     icon: 'ri-notification-3-line' },
  ] as const;

  const roleLabel: Record<string, string> = {
    admin: 'Administrador', manager: 'Gerente', operator: 'Operador', viewer: 'Visualizador',
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── HEADER ── */}
        <div className="flex items-center gap-4">
          {/* Avatar grande */}
          <div className="relative group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-md overflow-hidden bg-gradient-to-br ${selectedAvatarColor}`}
              style={avatarPreview ? {} : undefined}>
              {avatarPreview
                ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                : <span className="text-white font-bold text-xl">{profile?.full_name?.charAt(0)?.toUpperCase() || '?'}</span>}
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{profile?.full_name || 'Meu Perfil'}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-gray-400">{profile?.email}</span>
              <span className="w-1 h-1 rounded-full bg-gray-300"></span>
              <span className="text-xs font-medium text-[#004aad] bg-[#5de0e6]/10 px-2 py-0.5 rounded-lg">
                {roleLabel[profile?.role || 'viewer'] || profile?.role}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[220px_1fr] gap-6">
          {/* ── SIDEBAR NAV ── */}
          <div className="space-y-1">
            {NAV.map(n => (
              <button key={n.id} onClick={() => setActiveSection(n.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeSection === n.id ? 'bg-[#5de0e6]/10 text-[#004aad]' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}>
                <i className={`${n.icon} text-base`}></i>{n.label}
              </button>
            ))}

            {/* Card de status */}
            <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Status da conta</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs font-medium text-emerald-700">Ativa</span>
              </div>
              {permission === 'granted' && (
                <div className="flex items-center gap-1.5">
                  <i className="ri-notification-badge-fill text-xs text-[#004aad]"></i>
                  <span className="text-xs text-[#004aad]">Push ativas</span>
                </div>
              )}
              {permission === 'denied' && (
                <div className="flex items-center gap-1.5">
                  <i className="ri-notification-off-line text-xs text-rose-500"></i>
                  <span className="text-xs text-rose-500">Push bloqueadas</span>
                </div>
              )}
              <p className="text-[10px] text-gray-400 pt-1">
                Desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>

          {/* ── CONTENT ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">

            {/* ── PERFIL ── */}
            {activeSection === 'perfil' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-9 h-9 bg-[#5de0e6]/10 rounded-xl flex items-center justify-center">
                    <i className="ri-user-line text-[#004aad] text-base"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Informações Pessoais</h3>
                    <p className="text-xs text-gray-400">Foto, nome e contatos pessoais</p>
                  </div>
                </div>

                {/* Avatar */}
                <div>
                  <label className={lbl}>Foto de perfil</label>
                  <div className="flex items-start gap-5">
                    {/* Preview */}
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow overflow-hidden bg-gradient-to-br ${selectedAvatarColor}`}
                        style={avatarPreview ? {} : undefined}>
                        {avatarPreview
                          ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                          : <span className="text-white font-bold text-2xl">{profileForm.full_name?.charAt(0)?.toUpperCase() || '?'}</span>}
                      </div>
                      {avatarPreview && (
                        <button onClick={() => { setAvatarPreview(null); if (avatarInputRef.current) avatarInputRef.current.value = ''; }}
                          className="text-[11px] text-rose-500 hover:text-rose-600 cursor-pointer">
                          Remover foto
                        </button>
                      )}
                    </div>

                    <div className="flex-1 space-y-3">
                      <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                      <button onClick={() => avatarInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#004aad] bg-[#5de0e6]/10 hover:bg-[#5de0e6]/20 rounded-xl transition-colors cursor-pointer whitespace-nowrap">
                        <i className="ri-upload-2-line text-sm"></i>Enviar foto
                      </button>
                      <p className="text-[11px] text-gray-400">JPG, PNG ou WebP · Máximo 2MB · Recomendado 256×256px</p>

                      {/* Cores do avatar (quando sem foto) */}
                      {!avatarPreview && (
                        <div>
                          <p className="text-[11px] text-gray-400 mb-2">Cor do avatar</p>
                          <div className="flex gap-2">
                            {AVATAR_COLORS.map(c => (
                              <button key={c} onClick={() => setSelectedAvatarColor(c)}
                                className={`w-7 h-7 rounded-lg cursor-pointer transition-all hover:scale-110 bg-gradient-to-br ${c} ${selectedAvatarColor === c ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Nome */}
                <div>
                  <label className={lbl}>Nome completo <span className="text-rose-500">*</span></label>
                  <input type="text" value={profileForm.full_name}
                    onChange={e => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Seu nome completo" className={inp} maxLength={80} />
                </div>

                {/* E-mail — readonly (auth gerenciado pelo Supabase) */}
                <div>
                  <label className={lbl}>E-mail</label>
                  <div className="relative">
                    <i className="ri-mail-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                    <input type="email" value={profileForm.email} readOnly
                      className={`${inp} pl-9 bg-gray-50 cursor-not-allowed text-gray-500`} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">somente leitura</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                    <i className="ri-information-line text-xs"></i>
                    Para alterar o e-mail, entre em contato com o administrador do sistema.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={lbl}>Telefone pessoal</label>
                    <div className="relative">
                      <i className="ri-phone-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                      <input type="tel" value={profileForm.phone}
                        onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+55 11 99999-9999" className={`${inp} pl-9`} />
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>WhatsApp</label>
                    <div className="relative">
                      <i className="ri-whatsapp-line absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm"></i>
                      <input type="tel" value={profileForm.whatsapp}
                        onChange={e => setProfileForm(f => ({ ...f, whatsapp: e.target.value }))}
                        placeholder="+55 11 99999-9999" className={`${inp} pl-9`} />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button onClick={saveProfile} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm">
                    {saving ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</> : <><i className="ri-save-line"></i>Salvar Perfil</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── SEGURANÇA ── */}
            {activeSection === 'seguranca' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center">
                    <i className="ri-shield-keyhole-line text-amber-600 text-base"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Segurança da Conta</h3>
                    <p className="text-xs text-gray-400">Altere sua senha de acesso</p>
                  </div>
                </div>

                {/* Info de segurança */}
                <div className="flex items-start gap-3 p-4 bg-amber-50/60 border border-amber-100 rounded-xl">
                  <i className="ri-shield-check-line text-amber-500 text-lg mt-0.5"></i>
                  <div>
                    <p className="text-sm font-medium text-amber-800">Dicas de segurança</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                      Use pelo menos 8 caracteres com letras maiúsculas, minúsculas, números e símbolos. Não reutilize senhas de outros serviços.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Senha atual */}
                  <div>
                    <label className={lbl}>Senha atual <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <i className="ri-lock-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                      <input
                        type={showPass.current ? 'text' : 'password'}
                        value={passForm.current}
                        onChange={e => { setPassForm(f => ({ ...f, current: e.target.value })); setPassErrors(p => ({ ...p, current: '' })); }}
                        placeholder="••••••••" className={`${inp} pl-9 pr-10 ${passErrors.current ? 'border-rose-300' : ''}`} />
                      <button type="button" onClick={() => setShowPass(s => ({ ...s, current: !s.current }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                        <i className={showPass.current ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                      </button>
                    </div>
                    {passErrors.current && <p className="text-xs text-rose-500 mt-1">{passErrors.current}</p>}
                  </div>

                  {/* Nova senha */}
                  <div>
                    <label className={lbl}>Nova senha <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <i className="ri-lock-password-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                      <input
                        type={showPass.new ? 'text' : 'password'}
                        value={passForm.new}
                        onChange={e => { setPassForm(f => ({ ...f, new: e.target.value })); setPassErrors(p => ({ ...p, new: '' })); }}
                        placeholder="Mínimo 6 caracteres" className={`${inp} pl-9 pr-10 ${passErrors.new ? 'border-rose-300' : ''}`} />
                      <button type="button" onClick={() => setShowPass(s => ({ ...s, new: !s.new }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                        <i className={showPass.new ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                      </button>
                    </div>
                    {passErrors.new && <p className="text-xs text-rose-500 mt-1">{passErrors.new}</p>}
                    {/* Força da senha */}
                    {passForm.new && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1,2,3,4].map(n => {
                            const strength = [passForm.new.length >= 6, /[A-Z]/.test(passForm.new), /[0-9]/.test(passForm.new), /[^A-Za-z0-9]/.test(passForm.new)].filter(Boolean).length;
                            return <div key={n} className={`flex-1 h-1.5 rounded-full transition-colors ${n <= strength ? (strength <= 1 ? 'bg-rose-400' : strength <= 2 ? 'bg-amber-400' : strength <= 3 ? 'bg-sky-400' : 'bg-emerald-500') : 'bg-gray-200'}`}></div>;
                          })}
                        </div>
                        <p className="text-[11px] text-gray-400">
                          {(() => {
                            const s = [passForm.new.length >= 6, /[A-Z]/.test(passForm.new), /[0-9]/.test(passForm.new), /[^A-Za-z0-9]/.test(passForm.new)].filter(Boolean).length;
                            return s <= 1 ? '🔴 Fraca' : s <= 2 ? '🟡 Razoável' : s <= 3 ? '🔵 Boa' : '🟢 Forte';
                          })()}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirmar nova senha */}
                  <div>
                    <label className={lbl}>Confirmar nova senha <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <i className="ri-lock-check-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                      <input
                        type={showPass.confirm ? 'text' : 'password'}
                        value={passForm.confirm}
                        onChange={e => { setPassForm(f => ({ ...f, confirm: e.target.value })); setPassErrors(p => ({ ...p, confirm: '' })); }}
                        placeholder="Repita a nova senha" className={`${inp} pl-9 pr-10 ${passErrors.confirm ? 'border-rose-300' : passForm.confirm && passForm.new === passForm.confirm ? 'border-emerald-300' : ''}`} />
                      <button type="button" onClick={() => setShowPass(s => ({ ...s, confirm: !s.confirm }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer">
                        <i className={showPass.confirm ? 'ri-eye-off-line' : 'ri-eye-line'}></i>
                      </button>
                      {passForm.confirm && passForm.new === passForm.confirm && (
                        <i className="ri-check-circle-fill absolute right-10 top-1/2 -translate-y-1/2 text-emerald-500 text-sm"></i>
                      )}
                    </div>
                    {passErrors.confirm && <p className="text-xs text-rose-500 mt-1">{passErrors.confirm}</p>}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button onClick={savePassword} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm">
                    {saving ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</> : <><i className="ri-shield-keyhole-line"></i>Alterar Senha</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── NOTIFICAÇÕES ── */}
            {activeSection === 'notificacoes' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center">
                    <i className="ri-notification-3-line text-sky-600 text-base"></i>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Minhas Notificações</h3>
                    <p className="text-xs text-gray-400">Preferências pessoais de alertas</p>
                  </div>
                  {/* Badge de status push */}
                  {permission === 'granted' && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      <i className="ri-checkbox-circle-fill text-xs"></i>Push ativadas
                    </span>
                  )}
                  {permission === 'denied' && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                      <i className="ri-close-circle-fill text-xs"></i>Push bloqueadas
                    </span>
                  )}
                </div>

                {/* Aviso push bloqueada */}
                {permission === 'denied' && (
                  <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-xl">
                    <i className="ri-error-warning-line text-rose-500 text-lg mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-rose-800">Notificações push bloqueadas</p>
                      <p className="text-xs text-rose-600 mt-0.5">Para ativar, acesse as configurações do seu navegador e permita notificações para este site.</p>
                    </div>
                  </div>
                )}

                {/* Canais */}
                <div className="space-y-2">
                  <p className={lbl}>Canais de notificação</p>
                  {[
                    { key: 'notif_push' as const, label: 'Notificações Push', desc: 'Alertas no navegador em tempo real', icon: 'ri-notification-badge-line', color: 'text-[#004aad] bg-[#5de0e6]/10' },
                    { key: 'notif_email' as const, label: 'Alertas por E-mail', desc: 'Resumos e notificações por e-mail', icon: 'ri-mail-check-line', color: 'text-violet-600 bg-violet-50' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                          <i className={`${item.icon} text-sm`}></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.label}</p>
                          <p className="text-[11px] text-gray-400">{item.desc}</p>
                        </div>
                      </div>
                      <button onClick={() => setNotifForm(f => ({ ...f, [item.key]: !f[item.key] }))}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${notifForm[item.key] ? 'bg-[#004aad]' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${notifForm[item.key] ? 'translate-x-5' : 'translate-x-0'}`}></span>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Alertas de amostra */}
                <div className="space-y-3 pt-2 border-t border-gray-100">
                  <p className={lbl}>Alertas de amostras</p>

                  {/* Prazo pessoal */}
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm font-medium text-gray-800 mb-1">Meu prazo de alerta</p>
                    <p className="text-xs text-gray-400 mb-3">Receber alertas após X dias sem envio de amostra</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <button type="button" onClick={() => setNotifForm(f => ({ ...f, notif_sample_days: Math.max(1, f.notif_sample_days - 1) }))}
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 cursor-pointer">
                          <i className="ri-subtract-line text-sm"></i>
                        </button>
                        <input type="number" min={1} max={90} value={notifForm.notif_sample_days}
                          onChange={e => setNotifForm(f => ({ ...f, notif_sample_days: Math.min(90, Math.max(1, parseInt(e.target.value) || 1)) }))}
                          className="w-12 h-9 text-center text-sm font-semibold text-gray-900 border-x border-gray-200 bg-white focus:outline-none" />
                        <button type="button" onClick={() => setNotifForm(f => ({ ...f, notif_sample_days: Math.min(90, f.notif_sample_days + 1) }))}
                          className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 cursor-pointer">
                          <i className="ri-add-line text-sm"></i>
                        </button>
                      </div>
                      <span className="text-sm text-gray-500">dias</span>
                      {/* Presets rápidos */}
                      <div className="flex gap-1.5 ml-2">
                        {[{ d: 3, l: '3d' }, { d: 7, l: '7d' }, { d: 14, l: '14d' }].map(p => (
                          <button key={p.d} onClick={() => setNotifForm(f => ({ ...f, notif_sample_days: p.d }))}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-all cursor-pointer ${notifForm.notif_sample_days === p.d ? 'bg-[#004aad] text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                            {p.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {[
                    { key: 'notif_sample_transit' as const, label: 'Amostra em trânsito há muito tempo', desc: 'Alerta quando ultrapassar o prazo sem confirmação', icon: 'ri-truck-line', color: 'text-amber-500 bg-amber-50' },
                    { key: 'notif_sample_no_address' as const, label: 'Creator sem endereço de entrega', desc: 'Alerta para creators sem endereço cadastrado', icon: 'ri-map-pin-line', color: 'text-sky-500 bg-sky-50' },
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                          <i className={`${item.icon} text-sm`}></i>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{item.label}</p>
                          <p className="text-[11px] text-gray-400">{item.desc}</p>
                        </div>
                      </div>
                      <button onClick={() => setNotifForm(f => ({ ...f, [item.key]: !f[item.key] }))}
                        className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${notifForm[item.key] ? 'bg-[#004aad]' : 'bg-gray-300'}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${notifForm[item.key] ? 'translate-x-5' : 'translate-x-0'}`}></span>
                      </button>
                    </div>
                  ))}
                </div>

                <div className="pt-4 border-t border-gray-100 flex justify-end">
                  <button onClick={saveNotifications} disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-sm">
                    {saving ? <><i className="ri-loader-4-line animate-spin"></i>Salvando...</> : <><i className="ri-save-line"></i>Salvar Notificações</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </AppLayout>
  );
}
