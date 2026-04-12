// src/pages/metricas/components/GoalFormModal.tsx
import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import { supabase } from '../../../lib/supabase';
import type { Goal, GoalCategory, GoalType, PeriodType } from '../../../hooks/useGoals';
import {
  GOAL_CATEGORY_LABELS, GOAL_TYPES_BY_CATEGORY, GOAL_TYPE_LABELS,
  PERIOD_LABELS, CAPTURE_SOURCES,
} from '../../../hooks/useGoals';

const CHANNELS = ['TikTok', 'Instagram', 'YouTube', 'Kwai', 'Facebook', 'Twitter/X', 'Twitch', 'Outro'];
const CATEGORIES_FILTER = ['Creators', 'Embaixadores', 'Influenciadores', 'Parceiros', 'Afiliados'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

interface Props {
  goal?: Goal | null;
  onClose: () => void;
  onSave: (data: Omit<Goal, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
}

const EMPTY: Omit<Goal, 'id' | 'created_at' | 'updated_at'> = {
  title: '', description: null, category: 'hunter', type: 'leads_prospectados',
  target_value: 0, period_type: 'monthly', period_month: new Date().getMonth() + 1,
  period_year: new Date().getFullYear(), period_start: null, period_end: null,
  scope: 'global', assigned_to: [], assigned_name: [], reward_description: null,
  funnel_id: null, filter_channel: null, filter_category: null, filter_source: null,
  notify_at_percent: 80, is_active: true, created_by: null,
};

export default function GoalFormModal({ goal, onClose, onSave }: Props) {
  const [form, setForm] = useState<Omit<Goal, 'id' | 'created_at' | 'updated_at'>>(
    goal ? { ...EMPTY, ...goal } : { ...EMPTY }
  );
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [users, setUsers]     = useState<{ id: string; full_name: string }[]>([]);
  const [funnels, setFunnels] = useState<{ id: string; name: string }[]>([]);
  const [activeTab, setActiveTab] = useState<'geral' | 'periodo' | 'filtros'>('geral');

  useEffect(() => {
    supabase.from('user_profiles').select('id, full_name').eq('is_active', true).neq('role', 'admin')
      .then(({ data }) => setUsers(data || []));
    supabase.from('funnels').select('id, name').order('is_default', { ascending: false })
      .then(({ data }) => setFunnels(data || []));
  }, []);

  // Ao trocar categoria, ajusta o tipo para o primeiro da nova categoria
  useEffect(() => {
    const types = GOAL_TYPES_BY_CATEGORY[form.category];
    if (!types.includes(form.type as GoalType)) {
      setForm(p => ({ ...p, type: types[0] }));
    }
  }, [form.category]);

  const set = (key: string, value: unknown) => setForm(p => ({ ...p, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Título é obrigatório'); return; }
    if (form.target_value <= 0) { setError('Valor alvo deve ser maior que zero'); return; }
    setSaving(true); setError('');
    try {
      await onSave(form);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500';
  const lbl = 'block text-xs font-medium text-gray-600 mb-1.5';

  const tabs = [
    { id: 'geral',   label: 'Geral',    icon: 'ri-target-line' },
    { id: 'periodo', label: 'Período',  icon: 'ri-calendar-line' },
    { id: 'filtros', label: 'Filtros',  icon: 'ri-filter-3-line' },
  ];

  return (
    <Modal isOpen={true} onClose={onClose}
      title={goal ? 'Editar Meta' : 'Nova Meta'}
      subtitle="Configure os parâmetros da meta" size="md">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm">
            <i className="ri-error-warning-line"></i>{error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1">
          {tabs.map(t => (
            <button key={t.id} type="button" onClick={() => setActiveTab(t.id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${activeTab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              <i className={`${t.icon} text-sm`}></i>{t.label}
            </button>
          ))}
        </div>

        {/* ── Aba Geral ── */}
        {activeTab === 'geral' && (
          <div className="space-y-4">
            <div>
              <label className={lbl}>Título <span className="text-rose-500">*</span></label>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder="Ex: Meta Hunters - Março" className={inp} />
            </div>
            <div>
              <label className={lbl}>Descrição</label>
              <textarea value={form.description || ''} onChange={e => set('description', e.target.value || null)}
                placeholder="Descrição opcional..." rows={2}
                className={`${inp} resize-none`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Categoria</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className={`${inp} cursor-pointer`}>
                  {Object.entries(GOAL_CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>Tipo de meta</label>
                <select value={form.type} onChange={e => set('type', e.target.value)} className={`${inp} cursor-pointer`}>
                  {GOAL_TYPES_BY_CATEGORY[form.category].map(t => (
                    <option key={t} value={t}>{GOAL_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={lbl}>Valor alvo <span className="text-rose-500">*</span></label>
              <input type="number" min="1" value={form.target_value}
                onChange={e => set('target_value', parseFloat(e.target.value) || 0)}
                placeholder="Ex: 50" className={inp} />
            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Escopo</label>
                  <select value={form.scope} onChange={e => { 
                    set('scope', e.target.value); 
                    if (e.target.value === 'global') { 
                      set('assigned_to', []); 
                      set('assigned_name', []); 
                    }
                  }} className={`${inp} cursor-pointer`}>
                    <option value="global">Global (toda equipe)</option>
                    <option value="individual">Time / Usuários</option>
                  </select>
                </div>
                {form.scope === 'individual' && (
                  <div>
                    <label className={lbl}>Usuários (Time)</label>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-lg bg-gray-50 min-h-[42px]">
                        {(form.assigned_to || []).length === 0 && <span className="text-gray-400 text-xs p-1">Nenhum selecionado</span>}
                        {(form.assigned_to || []).map(uid => {
                          const u = users.find(user => user.id === uid);
                          return (
                            <span key={uid} className="flex items-center gap-1 px-2 py-1 bg-brand-500 text-white text-[10px] font-bold rounded-md">
                              {u?.full_name || 'Usuário'}
                              <button type="button" onClick={() => {
                                const newIds = (form.assigned_to || []).filter(id => id !== uid);
                                const newNames = (form.assigned_name || []).filter(n => n !== u?.full_name);
                                set('assigned_to', newIds);
                                set('assigned_name', newNames);
                              }} className="hover:text-white/80"><i className="ri-close-line"></i></button>
                            </span>
                          );
                        })}
                      </div>
                      <select 
                        value="" 
                        onChange={e => {
                          if (!e.target.value) return;
                          const u = users.find(u => u.id === e.target.value);
                          if (u && !(form.assigned_to || []).includes(u.id)) {
                            set('assigned_to', [...(form.assigned_to || []), u.id]);
                            set('assigned_name', [...(form.assigned_name || []), u.full_name]);
                          }
                        }} 
                        className={`${inp} cursor-pointer`}
                      >
                        <option value="">Adicionar usuário...</option>
                        {users.filter(u => !(form.assigned_to || []).includes(u.id)).map(u => (
                          <option key={u.id} value={u.id}>{u.full_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className={lbl}>Prêmio ao atingir meta (Opcional)</label>
                <input 
                  value={form.reward_description || ''} 
                  onChange={e => set('reward_description', e.target.value || null)}
                  placeholder="Ex: Bônus extra por atingir meta de GMV" 
                  className={inp} 
                />
              </div>
            <div>
              <label className={lbl}>Notificar ao atingir (%)</label>
              <div className="flex items-center gap-3">
                <input type="range" min="10" max="100" step="5" value={form.notify_at_percent}
                  onChange={e => set('notify_at_percent', parseInt(e.target.value))}
                  className="flex-1 accent-brand-500 cursor-pointer" />
                <span className="text-sm font-semibold text-gray-800 w-10 text-right">{form.notify_at_percent}%</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Aba Período ── */}
        {activeTab === 'periodo' && (
          <div className="space-y-4">
            <div>
              <label className={lbl}>Tipo de período</label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(PERIOD_LABELS) as [PeriodType, string][]).map(([k, v]) => (
                  <button key={k} type="button" onClick={() => set('period_type', k)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border-2 cursor-pointer transition-all text-left ${form.period_type === k ? 'border-[#004aad] bg-[#004aad]/5 text-[#004aad]' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {form.period_type === 'monthly' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Mês</label>
                  <select value={form.period_month || ''} onChange={e => set('period_month', parseInt(e.target.value))} className={`${inp} cursor-pointer`}>
                    {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className={lbl}>Ano</label>
                  <select value={form.period_year || new Date().getFullYear()} onChange={e => set('period_year', parseInt(e.target.value))} className={`${inp} cursor-pointer`}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            )}

            {form.period_type === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Data início</label>
                  <input type="date" value={form.period_start || ''} onChange={e => set('period_start', e.target.value || null)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Data fim</label>
                  <input type="date" value={form.period_end || ''} onChange={e => set('period_end', e.target.value || null)} className={inp} />
                </div>
              </div>
            )}

            <div>
              <label className={lbl}>Funil (opcional)</label>
              <select value={form.funnel_id || ''} onChange={e => set('funnel_id', e.target.value || null)} className={`${inp} cursor-pointer`}>
                <option value="">Todos os funis</option>
                {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
        )}

        {/* ── Aba Filtros ── */}
        {activeTab === 'filtros' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
              <i className="ri-information-line text-blue-500 text-sm mt-0.5"></i>
              <p className="text-xs text-blue-700">Os filtros restringem quais registros são contabilizados na meta. Deixe em branco para incluir todos.</p>
            </div>
            <div>
              <label className={lbl}>Canal</label>
              <select value={form.filter_channel || ''} onChange={e => set('filter_channel', e.target.value || null)} className={`${inp} cursor-pointer`}>
                <option value="">Todos os canais</option>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Categoria de creator</label>
              <select value={form.filter_category || ''} onChange={e => set('filter_category', e.target.value || null)} className={`${inp} cursor-pointer`}>
                <option value="">Todas as categorias</option>
                {CATEGORIES_FILTER.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Fonte de captura</label>
              <select value={form.filter_source || ''} onChange={e => set('filter_source', e.target.value || null)} className={`${inp} cursor-pointer`}>
                <option value="">Todas as fontes</option>
                {CAPTURE_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} className="flex-1" disabled={saving}>
            {saving
              ? <span className="flex items-center gap-2"><i className="ri-loader-4-line animate-spin"></i>Salvando...</span>
              : <span className="flex items-center gap-2"><i className="ri-save-line"></i>{goal ? 'Salvar' : 'Criar Meta'}</span>}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
