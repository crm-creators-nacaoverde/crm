import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { FormField } from './FormFieldEditor';

interface FormTemplate {
  id: string;
  name: string;
  public_name?: string | null;
  slug?: string | null;
  description: string;
  fields: FormField[];
  is_active: boolean;
  share_token: string;
  auto_funnel_id?: string | null;
  auto_stage_id?: string | null;
  auto_owner_id?: string | null;
  auto_supervisor_id?: string | null;
  auto_category?: string | null;
}

interface CreatorData {
  id: string;
  name: string;
  email: string;
  phone: string;
  tiktok_channel: string | null;
}

const maskCPF = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const maskCEP = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
};

const isValidCPF = (cpf: string): boolean => {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(digits[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(digits[10]);
};

const isValidCEP = (cep: string): boolean => cep.replace(/\D/g, '').length === 8;
const isCPFField = (field: FormField): boolean => field.label.toLowerCase().includes('cpf');
const isCEPField = (field: FormField): boolean => {
  const l = field.label.toLowerCase();
  return l === 'cep' || l.includes('cep') || l.includes('código postal');
};
const isAddressStreetField = (field: FormField): boolean => {
  const l = field.label.toLowerCase();
  return l.includes('rua') || l.includes('logradouro') || (l.includes('endere') && !l.includes('complement'));
};
const isNeighborhoodField = (field: FormField): boolean => field.label.toLowerCase().includes('bairro');
const isCityField = (field: FormField): boolean => {
  const l = field.label.toLowerCase();
  return l.includes('cidade') || l.includes('município') || l.includes('municipio');
};
const isStateField = (field: FormField): boolean => {
  const l = field.label.toLowerCase();
  return l.includes('estado') || l === 'uf';
};

// Detecta campos de nome do creator de forma ampla
// Pega: "Nome Completo", "Nome do Creator", "Como podemos te chamar?", "Seu nome", etc.
const isNameField = (label: string): boolean => {
  const l = label.toLowerCase().trim();
  return (
    l === 'name' ||
    l === 'nome' ||
    l.includes('nome completo') ||
    l.includes('nome do creator') ||
    l.includes('nome do criador') ||
    l.includes('como podemos te chamar') ||
    l.includes('como te chamam') ||
    l.includes('qual seu nome') ||
    l.includes('qual o seu nome') ||
    l.includes('seu nome') ||
    (l.includes('nome') && !l.includes('nome da empresa') && !l.includes('nome do produto') && !l.includes('nome público') && !l.includes('nome interno'))
  );
};

interface ViaCEPResponse {
  cep: string; logradouro: string; complemento: string;
  bairro: string; localidade: string; uf: string; erro?: boolean;
}

export default function PublicFormPage() {
  const { token, slug } = useParams<{ token?: string; slug?: string }>();
  const [searchParams] = useSearchParams();
  const creatorId = searchParams.get('creator');

  const [form, setForm] = useState<FormTemplate | null>(null);
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [autoFilledFields, setAutoFilledFields] = useState<Set<string>>(new Set());
  const [cepLoading, setCepLoading] = useState(false);
  const [cepAutoFilled, setCepAutoFilled] = useState<Set<string>>(new Set());

  useEffect(() => { loadForm(); }, [token, slug]);

  const matchFieldToCreator = (field: FormField, creatorData: CreatorData): string | null => {
    const label = field.label.toLowerCase().trim();
    const type = field.type;
    if (type === 'email' || label.includes('email') || label.includes('e-mail')) return creatorData.email || null;
    if (type === 'phone' || label.includes('telefone') || label.includes('whatsapp') || label.includes('celular')) return creatorData.phone || null;
    if (isNameField(label)) return creatorData.name || null;
    if (label.includes('canal') && label.includes('tiktok')) return creatorData.tiktok_channel || null;
    return null;
  };

  const loadForm = async () => {
    const identifier = slug || token;
    if (!identifier) { setError('Link inválido'); setLoading(false); return; }

    try {
      let data: FormTemplate | null = null;

      // Tenta buscar por slug primeiro (URL amigável)
      if (slug) {
        const { data: bySlug, error: slugErr } = await supabase
          .from('form_templates')
          .select('id, name, public_name, slug, description, fields, is_active, share_token, auto_funnel_id, auto_stage_id, auto_owner_id, auto_supervisor_id')
          .eq('slug', slug)
          .maybeSingle();
        if (!slugErr && bySlug) data = bySlug;
      }

      // Fallback: busca por share_token (rota /formulario/:token ou /form/:token)
      if (!data && token) {
        const { data: byToken, error: tokenErr } = await supabase
          .from('form_templates')
          .select('id, name, public_name, slug, description, fields, is_active, share_token, auto_funnel_id, auto_stage_id, auto_owner_id, auto_supervisor_id')
          .eq('share_token', token)
          .maybeSingle();
        if (!tokenErr && byToken) data = byToken;
      }

      if (!data) { setError('Formulário não encontrado'); setLoading(false); return; }
      if (!data.is_active) { setError('Este formulário não está mais disponível'); setLoading(false); return; }

      setForm(data);

      let creatorData: CreatorData | null = null;
      if (creatorId) {
        const { data: cData, error: cErr } = await supabase
          .from('clients')
          .select('id, name, email, phone, tiktok_channel')
          .eq('id', creatorId)
          .maybeSingle();
        if (!cErr && cData) { creatorData = cData; setCreator(cData); }
      }

      const initial: Record<string, any> = {};
      const filled = new Set<string>();
      (data.fields || []).forEach((f: FormField) => {
        if (f.type === 'multiselect') initial[f.id] = [];
        else if (f.type === 'checkbox') initial[f.id] = false;
        else if (f.type === 'rating') initial[f.id] = 0;
        else initial[f.id] = '';
        if (creatorData) {
          const autoValue = matchFieldToCreator(f, creatorData);
          if (autoValue) { initial[f.id] = autoValue; filled.add(f.id); }
        }
      });
      setResponses(initial);
      setAutoFilledFields(filled);
    } catch (err) {
      console.error('Erro ao carregar formulário:', err);
      setError('Erro ao carregar o formulário. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form) return false;
    form.fields.forEach((field) => {
      if (field.required) {
        const val = responses[field.id];
        if (field.type === 'multiselect' && (!val || val.length === 0)) errors[field.id] = 'Selecione pelo menos uma opção';
        else if (field.type === 'rating' && (!val || val === 0)) errors[field.id] = 'Selecione uma avaliação';
        else if (typeof val === 'string' && !val.trim()) errors[field.id] = 'Este campo é obrigatório';
      }
      if (isCPFField(field) && responses[field.id] && !isValidCPF(responses[field.id])) errors[field.id] = 'CPF inválido.';
      if (isCEPField(field) && responses[field.id] && !isValidCEP(responses[field.id])) errors[field.id] = 'CEP inválido.';
      if (field.type === 'email' && responses[field.id]) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responses[field.id])) errors[field.id] = 'E-mail inválido';
      }
      if (field.type === 'url' && responses[field.id]) {
        try { new URL(responses[field.id]); } catch { errors[field.id] = 'URL inválida'; }
      }
    });
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const extractFieldValues = (fields: FormField[], fieldResponses: Record<string, any>) => {
    let cpf = '', phone = '', name = '', email = '', tiktokChannel = '',
      enderecoCep = '', enderecoRua = '', enderecoNumero = '', enderecoComplemento = '',
      enderecoBairro = '', enderecoCidade = '', enderecoEstado = '', chavePix = '', chavePixTipo = '';
    let platformPrincipal = ''; // preenche clients.platform
    let instagramProfile = '';  // preenche clients.instagram_profile
    let youtubeCanal = '';      // preenche clients.youtube_canal

    fields.forEach((field) => {
      const value = fieldResponses[field.id];
      if (!value || (typeof value === 'string' && !value.trim())) return;
      const label = field.label.toLowerCase().trim();
      const type = field.type;
      if (isCPFField(field) && typeof value === 'string') cpf = value.replace(/\D/g, '');
      if (type === 'phone' || label.includes('telefone') || label.includes('whatsapp') || label.includes('celular')) { if (typeof value === 'string') phone = value.trim(); }
      if (isNameField(label)) { if (typeof value === 'string') name = value.trim(); }
      if (type === 'email' || label.includes('email') || label.includes('e-mail')) { if (typeof value === 'string') email = value.trim(); }
      // TikTok → tiktok_links
      if (label === 'canal do tiktok' || (label.includes('canal') && label.includes('tiktok'))) { if (typeof value === 'string') tiktokChannel = value.trim(); }
      // Instagram → instagram_profile
      if (label === 'perfil do instagram' || (label.includes('instagram') && label.includes('perfil'))) { if (typeof value === 'string') instagramProfile = value.trim(); }
      // YouTube → youtube_canal
      if (label === 'canal do youtube' || (label.includes('canal') && label.includes('youtube'))) { if (typeof value === 'string') youtubeCanal = value.trim(); }
      if (isCEPField(field) && typeof value === 'string') enderecoCep = value.trim();
      if (isAddressStreetField(field) && typeof value === 'string') enderecoRua = value.trim();
      if ((label.includes('número') || label.includes('numero') || label === 'número') && typeof value === 'string') enderecoNumero = value.trim();
      if ((label.includes('complemento') || label.includes('apto')) && typeof value === 'string') enderecoComplemento = value.trim();
      if (isNeighborhoodField(field) && typeof value === 'string') enderecoBairro = value.trim();
      if (isCityField(field) && typeof value === 'string') enderecoCidade = value.trim();
      if (isStateField(field) && typeof value === 'string') enderecoEstado = value.trim();
      if (label.includes('pix') && label.includes('chave') && typeof value === 'string') chavePix = value.trim();
      if (label.includes('pix') && label.includes('tipo') && typeof value === 'string') chavePixTipo = value.trim();
      // Plataforma Principal → clients.platform
      if (label === 'plataforma principal' && typeof value === 'string' && value.trim()) {
        platformPrincipal = value.trim();
      }
    });
    return { cpf, phone, name, email, tiktokChannel, enderecoCep, enderecoRua, enderecoNumero, enderecoComplemento, enderecoBairro, enderecoCidade, enderecoEstado, chavePix, chavePixTipo, platformPrincipal, instagramProfile, youtubeCanal };
  };

  const findOrCreateCreator = async (fields: FormField[], fieldResponses: Record<string, any>): Promise<string | null> => {
    const { cpf, phone, name, email, tiktokChannel, enderecoCep, enderecoRua, enderecoNumero, enderecoComplemento, enderecoBairro, enderecoCidade, enderecoEstado, chavePix, chavePixTipo, platformPrincipal, instagramProfile, youtubeCanal } = extractFieldValues(fields, fieldResponses);
    // Precisa de nome OU cpf para criar/identificar o creator
    if (!name && !cpf) return null;
    try {
      if (cpf) {
        const { data: byCpf } = await supabase.from('clients').select('id').eq('cpf_cnpj', cpf).maybeSingle();
        if (byCpf) return byCpf.id;
        const { data: byCpfF } = await supabase.from('clients').select('id').eq('cpf_cnpj', maskCPF(cpf)).maybeSingle();
        if (byCpfF) return byCpfF.id;
      }
      // Deduplicação por telefone removida — telefone não é único por pessoa.
      // Apenas CPF/CNPJ garante unicidade.
      const formDisplayName = form?.public_name || form?.name || 'Formulário';
      const creatorName = name || `Creator | ${formDisplayName}`;
      const defaultEmail = email || `${creatorName.toLowerCase().replace(/\s+/g, '')}@creator.com`;
      const mainPlatform = platformPrincipal || 'TikTok';
      const tiktokLinksArr: string[] = tiktokChannel ? [tiktokChannel] : [];

      const autoCategory = form?.auto_category || 'Creators';
      const newClientPayload: Record<string, any> = {
        name: creatorName,
        email: defaultEmail,
        platform: mainPlatform,
        category: autoCategory,
        status: 'active',
        tiktok_links: tiktokLinksArr,
      };

      if (phone) newClientPayload.phone = phone;
      if (cpf) newClientPayload.cpf_cnpj = cpf;
      if (instagramProfile) newClientPayload.instagram_profile = instagramProfile;
      if (youtubeCanal) newClientPayload.youtube_canal = youtubeCanal;
      if (enderecoCep) newClientPayload.endereco_cep = enderecoCep;
      if (enderecoRua) newClientPayload.endereco_rua = enderecoRua;
      if (enderecoNumero) newClientPayload.endereco_numero = enderecoNumero;
      if (enderecoComplemento) newClientPayload.endereco_complemento = enderecoComplemento;
      if (enderecoBairro) newClientPayload.endereco_bairro = enderecoBairro;
      if (enderecoCidade) newClientPayload.endereco_cidade = enderecoCidade;
      if (enderecoEstado) newClientPayload.endereco_estado = enderecoEstado;
      if (chavePix) newClientPayload.chave_pix = chavePix;
      if (chavePixTipo) newClientPayload.chave_pix_tipo = chavePixTipo;

      const { data: newClient, error: clientErr } = await supabase.from('clients').insert([newClientPayload]).select('id').maybeSingle();
      if (clientErr || !newClient) return null;

      let targetFunnelId = form?.auto_funnel_id || null;
      let targetStageId = form?.auto_stage_id || null;
      if (!targetFunnelId) {
        const { data: defaultFunnel } = await supabase.from('funnels').select('id').eq('is_default', true).maybeSingle();
        if (defaultFunnel) targetFunnelId = defaultFunnel.id;
      }
      if (targetFunnelId && !targetStageId) {
        const { data: firstStage } = await supabase.from('funnel_stages').select('id').eq('funnel_id', targetFunnelId).order('sort_order', { ascending: true }).limit(1).maybeSingle();
        if (firstStage) targetStageId = firstStage.id;
      }
      if (targetFunnelId && targetStageId) {
        // Título: "Nome do Creator | Nome do Formulário"
        const formDisplayName = form?.public_name || form?.name || 'Formulário';
        const dealTitle = name ? `${name} | ${formDisplayName}` : `Creator | ${formDisplayName}`;
        let ownerName = '', supervisorName = '';
        const ownerId = form?.auto_owner_id || null;
        const supervisorId = form?.auto_supervisor_id || null;
        if (ownerId) { const { data: ownerData } = await supabase.from('user_profiles').select('full_name').eq('id', ownerId).maybeSingle(); if (ownerData) ownerName = ownerData.full_name; }
        if (supervisorId) { const { data: supervisorData } = await supabase.from('user_profiles').select('full_name').eq('id', supervisorId).maybeSingle(); if (supervisorData) supervisorName = supervisorData.full_name; }
        await supabase.from('deals').insert([{ title: dealTitle, client_id: newClient.id, stage: targetStageId, funnel_id: targetFunnelId, priority: 'medium', value: 0, assigned_to: ownerId || null, assigned_name: ownerName || null, supervisor_id: supervisorId || null, supervisor_name: supervisorName || null, description: 'Criado automaticamente via formulário público.' }]);
      }
      return newClient.id;
    } catch (err) {
      console.error('Erro ao buscar/criar creator:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !validate()) return;
    setSubmitting(true);
    try {
      const formattedResponses: Record<string, any> = {};
      form.fields.forEach((field) => { formattedResponses[field.label || field.id] = responses[field.id]; });
      let clientId: string | null = creator?.id || null;
      if (!clientId) clientId = await findOrCreateCreator(form.fields, responses);
      const insertPayload: Record<string, any> = { form_id: form.id, responses: formattedResponses, status: 'submitted', submitted_at: new Date().toISOString() };
      if (clientId) insertPayload.client_id = clientId;
      const { error: err } = await supabase.from('form_submissions').insert(insertPayload);
      if (err) throw err;
      if (clientId) await syncCreatorDataById(clientId, form.fields, responses);
      setSubmitted(true);
    } catch (err) {
      console.error('Erro ao enviar:', err);
      setValidationErrors({ _form: 'Erro ao enviar o formulário. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const syncCreatorDataById = async (clientId: string, fields: FormField[], fieldResponses: Record<string, any>) => {
    // Categoria vem sempre da configuração do formulário, não do preenchimento
    const categoryFromForm = form?.auto_category || 'Creators';
    const updatePayload: Record<string, any> = { category: categoryFromForm };
    const { platformPrincipal, instagramProfile, youtubeCanal, tiktokChannel } = extractFieldValues(fields, fieldResponses);

    fields.forEach((field) => {
      const value = fieldResponses[field.id];
      if (value === undefined || value === null || value === '') return;
      const label = field.label.toLowerCase().trim();
      const type = field.type;
      if (isNameField(label)) { if (typeof value === 'string' && value.trim()) updatePayload.name = value.trim(); }
      if (type === 'email' || label.includes('email') || label.includes('e-mail')) { if (typeof value === 'string' && value.trim()) updatePayload.email = value.trim(); }
      if (type === 'phone' || label.includes('telefone') || label.includes('whatsapp') || label.includes('celular')) { if (typeof value === 'string' && value.trim()) updatePayload.phone = value.trim(); }
      if (isCPFField(field)) { if (typeof value === 'string' && value.trim()) updatePayload.cpf_cnpj = value.replace(/\D/g, ''); }
      if (label.includes('cep')) { if (typeof value === 'string' && value.trim()) updatePayload.endereco_cep = value.trim(); }
      if (label.includes('rua') || label.includes('logradouro')) { if (typeof value === 'string' && value.trim()) updatePayload.endereco_rua = value.trim(); }
      if ((label.includes('número') || label.includes('numero')) && !label.includes('telefone')) { if (typeof value === 'string' && value.trim()) updatePayload.endereco_numero = value.trim(); }
      if (label.includes('complemento')) { if (typeof value === 'string' && value.trim()) updatePayload.endereco_complemento = value.trim(); }
      if (label.includes('bairro')) { if (typeof value === 'string' && value.trim()) updatePayload.endereco_bairro = value.trim(); }
      if (label.includes('cidade')) { if (typeof value === 'string' && value.trim()) updatePayload.endereco_cidade = value.trim(); }
      if (label.includes('estado') || label === 'uf') { if (typeof value === 'string' && value.trim()) updatePayload.endereco_estado = value.trim(); }
      if (label.includes('pix') && label.includes('chave')) { if (typeof value === 'string' && value.trim()) updatePayload.chave_pix = value.trim(); }
      if (label.includes('pix') && label.includes('tipo')) { if (typeof value === 'string' && value.trim()) updatePayload.chave_pix_tipo = value.trim().toLowerCase(); }
    });

    // Sincroniza plataforma principal → clients.platform
    if (platformPrincipal) updatePayload.platform = platformPrincipal;
    // Sincroniza canais → colunas específicas
    if (instagramProfile) updatePayload.instagram_profile = instagramProfile;
    if (youtubeCanal) updatePayload.youtube_canal = youtubeCanal;
    if (tiktokChannel) {
      // Adiciona ao array tiktok_links sem duplicar
      const { data: cur } = await supabase.from('clients').select('tiktok_links').eq('id', clientId).maybeSingle();
      const existing: string[] = cur?.tiktok_links || [];
      if (!existing.includes(tiktokChannel)) {
        updatePayload.tiktok_links = [...existing, tiktokChannel];
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      updatePayload.updated_at = new Date().toISOString();
      await supabase.from('clients').update(updatePayload).eq('id', clientId);
    }
  };

  const fetchAddressByCEP = async (cep: string, currentFieldId: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: ViaCEPResponse = await response.json();
      if (data.erro) { setValidationErrors((prev) => ({ ...prev, [currentFieldId]: 'CEP não encontrado' })); setCepLoading(false); return; }
      setValidationErrors((prev) => { const next = { ...prev }; delete next[currentFieldId]; return next; });
      if (!form) return;
      const newResponses: Record<string, any> = {};
      const newCepFilled = new Set<string>();
      form.fields.forEach((field) => {
        if (isAddressStreetField(field) && data.logradouro) { newResponses[field.id] = data.logradouro; newCepFilled.add(field.id); }
        if (isNeighborhoodField(field) && data.bairro) { newResponses[field.id] = data.bairro; newCepFilled.add(field.id); }
        if (isCityField(field) && data.localidade) { newResponses[field.id] = data.localidade; newCepFilled.add(field.id); }
        if (isStateField(field)) { newResponses[field.id] = data.uf; newCepFilled.add(field.id); }
      });
      setResponses((prev) => ({ ...prev, ...newResponses }));
      setCepAutoFilled(newCepFilled);
    } catch (err) {
      setValidationErrors((prev) => ({ ...prev, [currentFieldId]: 'Erro ao buscar CEP.' }));
    } finally {
      setCepLoading(false);
    }
  };

  const updateResponse = (fieldId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [fieldId]: value }));
    if (autoFilledFields.has(fieldId)) { setAutoFilledFields((prev) => { const next = new Set(prev); next.delete(fieldId); return next; }); }
    if (validationErrors[fieldId]) { setValidationErrors((prev) => { const next = { ...prev }; delete next[fieldId]; return next; }); }
  };

  const toggleMultiselect = (fieldId: string, option: string) => {
    setResponses((prev) => {
      const current = prev[fieldId] || [];
      const updated = current.includes(option) ? current.filter((o: string) => o !== option) : [...current, option];
      return { ...prev, [fieldId]: updated };
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-[#5de0e6] border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-sm text-gray-500">Carregando formulário...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md text-center">
        <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <i className="ri-file-warning-line text-3xl text-rose-400"></i>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{error}</h2>
        <p className="text-sm text-gray-500">Verifique o link e tente novamente.</p>
      </div>
    </div>
  );

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <div key={i} className={`absolute w-${i % 2 === 0 ? 2 : 1.5} h-${i % 2 === 0 ? 2 : 1.5} rounded-full bg-yellow-400/${i % 3 === 0 ? 30 : 20} animate-pulse`} style={{ top: `${10 + i * 15}%`, left: i % 2 === 0 ? `${10 + i * 3}%` : undefined, right: i % 2 !== 0 ? `${8 + i * 2}%` : undefined, animationDelay: `${i * 0.3}s` }}></div>
        ))}
      </div>
      <div className="relative max-w-lg w-full text-center">
        <div className="relative mx-auto mb-8 w-24 h-24">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-yellow-600/10 rounded-full blur-xl"></div>
          <div className="relative w-24 h-24 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center shadow-lg shadow-yellow-500/20">
            <i className="ri-trophy-line text-4xl text-black"></i>
          </div>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold mb-3" style={{ background: 'linear-gradient(135deg, #FFD700, #FFA500, #FFD700)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Parabéns!</h1>
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">Agora você é um Creator Milionário.</h2>
        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-yellow-500 to-transparent mx-auto mb-6"></div>
        <p className="text-gray-400 text-sm sm:text-base mb-10 leading-relaxed max-w-md mx-auto">Recebemos seu formulário, agora faz o seguinte, entra em nossas comunidades:</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">
          <a href="https://discord.gg/bDYr7N2yCN" target="_blank" rel="noopener noreferrer nofollow" className="w-full sm:w-auto flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer whitespace-nowrap" style={{ background: '#5865F2', color: '#ffffff' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#4752C4'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#5865F2'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617 1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            Entrar no Discord
          </a>
          <a href="https://whatsapp.com/channel/0029Vag9KSdCRs1oXjssgl0D" target="_blank" rel="noopener noreferrer nofollow" className="w-full sm:w-auto flex items-center justify-center gap-3 px-7 py-3.5 rounded-xl font-semibold text-sm transition-all duration-300 cursor-pointer whitespace-nowrap" style={{ background: '#25D366', color: '#ffffff' }} onMouseEnter={(e) => { e.currentTarget.style.background = '#1DA851'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#25D366'; e.currentTarget.style.transform = 'translateY(0)'; }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/></svg>
            Canal do WhatsApp
          </a>
        </div>
        <p className="text-gray-600 text-xs">Creator Milionário</p>
      </div>
    </div>
  );

  if (!form) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-[#004aad] to-[#003d91] px-6 py-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                <i className="ri-survey-line text-white text-lg"></i>
              </div>
              <span className="text-white/70 text-xs font-medium">Formulário</span>
            </div>
            <h1 className="text-xl font-bold text-white">{form.public_name || form.name}</h1>
            {form.description && <p className="text-white/80 text-sm mt-1.5">{form.description}</p>}
          </div>
          <div className="px-6 py-3 bg-[#5de0e6]/10 border-b border-[#5de0e6]/20 flex items-center justify-between">
            <p className="text-xs text-[#004aad] flex items-center gap-1.5">
              <i className="ri-information-line text-sm"></i>
              Campos marcados com <span className="text-rose-500 font-bold">*</span> são obrigatórios
            </p>
            {creator && <p className="text-xs text-[#004aad] flex items-center gap-1.5"><i className="ri-user-star-line text-sm"></i>{creator.name}</p>}
          </div>
        </div>

        {creator && autoFilledFields.size > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 mb-6 flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center"><i className="ri-magic-line text-emerald-600 text-sm"></i></div>
            <div>
              <p className="text-xs font-medium text-emerald-800">Preenchimento automático ativo</p>
              <p className="text-[11px] text-emerald-600 mt-0.5">Alguns campos foram preenchidos com seus dados. Você pode editá-los se necessário.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
          {form.fields.map((field) => {
            if (field.type === 'section_title') return (
              <div key={field.id} className="pt-3 pb-1">
                <div className="border-b-2 border-teal-100 pb-3">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2.5">
                    <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#5de0e6]/10 text-[#004aad]"><i className="ri-heading text-sm"></i></div>
                    {field.label}
                  </h3>
                  {field.description && <p className="text-sm text-gray-500 mt-1.5">{field.description}</p>}
                </div>
              </div>
            );
            if (field.type === 'image') {
              if (!field.image_url) return null;
              return (
                <div key={field.id} className="w-full rounded-xl overflow-hidden">
                  <div className="w-full" style={{ aspectRatio: '1920 / 650' }}>
                    <img src={field.image_url} alt={field.label || 'Imagem'} className="w-full h-full object-cover object-top" />
                  </div>
                </div>
              );
            }
            const isAutoFilled = autoFilledFields.has(field.id);
            const isCepAutoFilledField = cepAutoFilled.has(field.id);
            return (
              <div key={field.id}>
                <label className="block text-sm font-medium text-gray-800 mb-2">
                  {field.label}{field.required && <span className="text-rose-500 ml-1">*</span>}
                  {isAutoFilled && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md"><i className="ri-magic-line text-[10px]"></i>Preenchido</span>}
                  {isCepAutoFilledField && !isAutoFilled && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded-md"><i className="ri-map-pin-line text-[10px]"></i>Via CEP</span>}
                </label>

                {field.type === 'text' && (
                  <div className="relative">
                    <input type="text" name={field.id} value={responses[field.id] || ''} onChange={(e) => {
                      let val = e.target.value;
                      if (isCPFField(field)) val = maskCPF(val);
                      else if (isCEPField(field)) {
                        val = maskCEP(val);
                        updateResponse(field.id, val);
                        if (val.replace(/\D/g, '').length === 8) fetchAddressByCEP(val, field.id);
                        return;
                      }
                      updateResponse(field.id, val);
                    }} placeholder={field.placeholder} maxLength={isCPFField(field) ? 14 : isCEPField(field) ? 9 : undefined}
                      className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/40 focus:border-[#5de0e6] transition-all ${validationErrors[field.id] ? 'border-rose-300 bg-rose-50/30' : isAutoFilled ? 'border-emerald-200 bg-emerald-50/30' : isCepAutoFilledField ? 'border-sky-200 bg-sky-50/30' : 'border-gray-200'}`} />
                    {isCEPField(field) && cepLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2"><div className="w-4 h-4 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div><span className="text-[11px] text-gray-400">Buscando...</span></div>}
                  </div>
                )}
                {field.type === 'textarea' && <div><textarea name={field.id} value={responses[field.id] || ''} onChange={(e) => { if (e.target.value.length <= 500) updateResponse(field.id, e.target.value); }} placeholder={field.placeholder} rows={4} maxLength={500} className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/40 focus:border-[#5de0e6] transition-all resize-none ${validationErrors[field.id] ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'}`} /><p className="text-[11px] text-gray-400 text-right mt-1">{(responses[field.id] || '').length}/500</p></div>}
                {field.type === 'number' && <input type="number" name={field.id} value={responses[field.id] || ''} onChange={(e) => updateResponse(field.id, e.target.value)} placeholder={field.placeholder} className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/40 focus:border-[#5de0e6] transition-all ${validationErrors[field.id] ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'}`} />}
                {field.type === 'email' && <input type="email" name={field.id} value={responses[field.id] || ''} onChange={(e) => updateResponse(field.id, e.target.value)} placeholder={field.placeholder || 'email@exemplo.com'} className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/40 focus:border-[#5de0e6] transition-all ${validationErrors[field.id] ? 'border-rose-300 bg-rose-50/30' : isAutoFilled ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}`} />}
                {field.type === 'phone' && <input type="tel" name={field.id} value={responses[field.id] || ''} onChange={(e) => updateResponse(field.id, e.target.value)} placeholder={field.placeholder || '(00) 00000-0000'} className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/40 focus:border-[#5de0e6] transition-all ${validationErrors[field.id] ? 'border-rose-300 bg-rose-50/30' : isAutoFilled ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}`} />}
                {field.type === 'url' && <input type="url" name={field.id} value={responses[field.id] || ''} onChange={(e) => updateResponse(field.id, e.target.value)} placeholder={field.placeholder || 'https://'} className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/40 focus:border-[#5de0e6] transition-all ${validationErrors[field.id] ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'}`} />}
                {field.type === 'date' && <input type="date" name={field.id} value={responses[field.id] || ''} onChange={(e) => updateResponse(field.id, e.target.value)} className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/40 focus:border-[#5de0e6] transition-all ${validationErrors[field.id] ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'}`} />}
                {field.type === 'select' && <select name={field.id} value={responses[field.id] || ''} onChange={(e) => updateResponse(field.id, e.target.value)} className={`w-full px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/40 focus:border-[#5de0e6] transition-all bg-white cursor-pointer ${validationErrors[field.id] ? 'border-rose-300 bg-rose-50/30' : isCepAutoFilledField ? 'border-sky-200 bg-sky-50/30' : 'border-gray-200'}`}><option value="">{field.placeholder || 'Selecione...'}</option>{(field.options || []).map((opt, i) => <option key={i} value={opt}>{opt}</option>)}</select>}
                {field.type === 'multiselect' && <div className="flex flex-wrap gap-2">{(field.options || []).map((opt, i) => { const selected = (responses[field.id] || []).includes(opt); return <button key={i} type="button" onClick={() => toggleMultiselect(field.id, opt)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${selected ? 'bg-[#5de0e6]/10 border-2 border-[#5de0e6] text-[#004aad]' : 'bg-gray-50 border-2 border-gray-200 text-gray-600 hover:border-gray-300'}`}><div className={`w-4 h-4 rounded flex items-center justify-center ${selected ? 'bg-[#004aad]' : 'border border-gray-300'}`}>{selected && <i className="ri-check-line text-white text-xs"></i>}</div>{opt}</button>; })}</div>}
                {field.type === 'checkbox' && <button type="button" onClick={() => updateResponse(field.id, !responses[field.id])} className="flex items-center gap-3 cursor-pointer group"><div className={`w-5 h-5 rounded flex items-center justify-center transition-all ${responses[field.id] ? 'bg-[#004aad]' : 'border-2 border-gray-300 group-hover:border-[#5de0e6]'}`}>{responses[field.id] && <i className="ri-check-line text-white text-xs"></i>}</div><span className="text-sm text-gray-700">{field.placeholder || 'Sim'}</span></button>}
                {field.type === 'rating' && <div className="flex items-center gap-1">{[1,2,3,4,5].map((star) => <button key={star} type="button" onClick={() => updateResponse(field.id, star)} className="w-9 h-9 flex items-center justify-center cursor-pointer transition-transform hover:scale-110"><i className={`text-2xl ${star <= (responses[field.id] || 0) ? 'ri-star-fill text-amber-400' : 'ri-star-line text-gray-300 hover:text-amber-300'}`}></i></button>)}{responses[field.id] > 0 && <span className="text-xs text-gray-400 ml-2">{responses[field.id]}/5</span>}</div>}

                {validationErrors[field.id] && <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1"><i className="ri-error-warning-line text-sm"></i>{validationErrors[field.id]}</p>}
              </div>
            );
          })}

          {validationErrors._form && (
            <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-100 rounded-xl">
              <i className="ri-error-warning-line text-rose-500"></i>
              <span className="text-sm text-rose-600">{validationErrors._form}</span>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100">
            <button type="submit" disabled={submitting} className="w-full sm:w-auto px-8 py-3 bg-[#004aad] text-white text-sm font-semibold rounded-xl hover:bg-[#003d91] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center gap-2">
              {submitting ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Enviando...</> : <><i className="ri-send-plane-line"></i>Enviar Respostas</>}
            </button>
          </div>
        </form>

        <div className="text-center mt-6">
          <p className="text-xs text-gray-400">Formulário criado com CRM Creators</p>
        </div>
      </div>
    </div>
  );
}
