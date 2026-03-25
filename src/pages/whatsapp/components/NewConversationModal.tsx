import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onStart: (phone: string, clientId: string | null, clientName: string) => Promise<string | null>;
}

interface ClientOption { id: string; name: string; phone: string; }
interface FunnelOption { id: string; name: string; color: string; }
interface StageOption  { id: string; label: string; }

export default function NewConversationModal({ isOpen, onClose, onStart }: Props) {
  const { profile } = useAuth();
  const [step, setStep] = useState<'search' | 'new_creator'>('search');
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [starting, setStarting] = useState(false);

  // Formulário de novo creator
  const [newName, setNewName] = useState('');
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [selectedFunnel, setSelectedFunnel] = useState('');
  const [selectedStage, setSelectedStage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      supabase.from('clients').select('id, name, phone').eq('is_active', true).order('name').limit(50)
        .then(({ data }) => setClients(data || []));
      supabase.from('funnels').select('id, name, color').order('created_at')
        .then(({ data }) => { setFunnels(data || []); if (data?.[0]) setSelectedFunnel(data[0].id); });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!selectedFunnel) return;
    supabase.from('funnel_stages').select('id, label').eq('funnel_id', selectedFunnel).order('sort_order')
      .then(({ data }) => { setStages(data || []); if (data?.[0]) setSelectedStage(data[0].id); });
  }, [selectedFunnel]);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const handleStart = async () => {
    if (!phone && !selectedClient) return;
    setStarting(true);
    const p = selectedClient?.phone || phone;
    const n = selectedClient?.name || search || phone;
    const id = selectedClient?.id || null;
    await onStart(p, id, n);
    setStarting(false);
    onClose();
    reset();
  };

  const handleCreateAndStart = async () => {
    if (!newName.trim() || !phone) return;
    setSaving(true);
    const { data: newClient } = await supabase.from('clients').insert({
      name: newName.trim(),
      phone: phone,
      platform: 'TikTok',
      category: 'Creators',
      is_active: true,
      created_by: profile?.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single();

    if (newClient && selectedFunnel && selectedStage) {
      await supabase.from('deals').insert({
        title: `${newName.trim()} — WhatsApp`,
        client_id: newClient.id,
        stage: selectedStage,
        funnel_id: selectedFunnel,
        priority: 'medium',
        value: 0,
        assigned_to: profile?.id,
        assigned_name: profile?.full_name,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    setSaving(false);
    await onStart(phone, newClient?.id || null, newName.trim());
    onClose();
    reset();
  };

  const reset = () => {
    setStep('search'); setPhone(''); setSearch(''); setSelectedClient(null);
    setNewName(''); setShowDropdown(false);
  };

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300/40 focus:border-emerald-400 bg-white transition-all';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <i className="ri-whatsapp-line text-emerald-600 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Nova Conversa</p>
              <p className="text-[11px] text-gray-400">{step === 'search' ? 'Buscar creator ou digitar número' : 'Cadastrar novo creator'}</p>
            </div>
          </div>
          <button onClick={() => { onClose(); reset(); }}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {step === 'search' ? (
            <>
              {/* Número */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Número do WhatsApp</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+55 11 99999-9999" className={inp} />
              </div>

              {/* Buscar creator cadastrado */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Ou buscar creator cadastrado</label>
                <div className="relative">
                  <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input type="text" value={search} onChange={e => { setSearch(e.target.value); setShowDropdown(true); setSelectedClient(null); }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Nome ou telefone..." className={`${inp} pl-9`} />
                </div>
                {showDropdown && search && (
                  <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-40 overflow-y-auto">
                    {filteredClients.length === 0
                      ? <div className="px-4 py-3">
                          <p className="text-sm text-gray-400 mb-2">Nenhum creator encontrado</p>
                          <button onClick={() => { setStep('new_creator'); setNewName(search); setShowDropdown(false); }}
                            className="text-xs text-[#004aad] hover:underline cursor-pointer flex items-center gap-1">
                            <i className="ri-add-line text-xs"></i>Cadastrar "{search}" como novo creator
                          </button>
                        </div>
                      : filteredClients.map(c => (
                          <button key={c.id} onClick={() => { setSelectedClient(c); setPhone(c.phone || ''); setSearch(c.name); setShowDropdown(false); }}
                            className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 cursor-pointer">
                            <div className="w-7 h-7 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-xs font-bold">{c.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{c.name}</p>
                              <p className="text-[11px] text-gray-400">{c.phone}</p>
                            </div>
                          </button>
                        ))}
                  </div>
                )}
              </div>

              {selectedClient && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <i className="ri-checkbox-circle-line text-emerald-600 text-sm"></i>
                  <p className="text-xs font-medium text-emerald-800">Creator selecionado: {selectedClient.name}</p>
                </div>
              )}
            </>
          ) : (
            /* Formulário de novo creator */
            <>
              <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100 mb-2">
                <i className="ri-information-line text-amber-600 text-sm"></i>
                <p className="text-xs text-amber-800">Cadastrar novo creator para {phone}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Nome do creator *</label>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className={inp} placeholder="Nome completo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Funil</label>
                  <select value={selectedFunnel} onChange={e => setSelectedFunnel(e.target.value)} className={inp}>
                    {funnels.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Etapa inicial</label>
                  <select value={selectedStage} onChange={e => setSelectedStage(e.target.value)} className={inp}>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          {step === 'new_creator' && (
            <button onClick={() => setStep('search')}
              className="px-4 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">
              Voltar
            </button>
          )}
          <button onClick={step === 'search' ? handleStart : handleCreateAndStart}
            disabled={step === 'search' ? (!phone && !selectedClient) || starting : !newName.trim() || saving}
            className="flex-1 py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl cursor-pointer transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
            {(starting || saving) ? <><i className="ri-loader-4-line animate-spin"></i>Iniciando...</> :
             step === 'new_creator' ? <><i className="ri-user-add-line"></i>Cadastrar e iniciar conversa</> :
             <><i className="ri-send-plane-line"></i>Iniciar conversa</>}
          </button>
        </div>
      </div>
    </div>
  );
}
