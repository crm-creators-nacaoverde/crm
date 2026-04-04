import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import FormFieldEditor, { type FormField } from './FormFieldEditor';
import FormPreview from './FormPreview';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';

interface FormTemplate {
  id: string;
  name: string;
  public_name?: string | null;
  slug?: string | null;
  description: string;
  fields: FormField[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  auto_funnel_id?: string | null;
  auto_stage_id?: string | null;
  auto_owner_id?: string | null;
  auto_supervisor_id?: string | null;
  auto_category?: string | null;
}

interface FunnelOption {
  id: string;
  name: string;
  is_default: boolean;
}

interface StageOption {
  id: string;
  label: string;
  sort_order: number;
  funnel_id: string;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface FormBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editingForm?: FormTemplate | null;
}

export default function FormBuilderModal({ isOpen, onClose, onSaved, editingForm }: FormBuilderModalProps) {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const [formName, setFormName] = useState('');
  const [formPublicName, setFormPublicName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Funnel/Stage config
  const [funnels, setFunnels] = useState<FunnelOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [selectedFunnelId, setSelectedFunnelId] = useState<string>('');
  const [selectedStageId, setSelectedStageId] = useState<string>('');
  const [loadingFunnels, setLoadingFunnels] = useState(false);

  // Owner/Supervisor config
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string>('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('Creators');

  useEffect(() => {
    if (isOpen) {
      loadFunnels();
      loadUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingForm) {
      setFormName(editingForm.name);
      setFormPublicName(editingForm.public_name || '');
      setFormSlug(editingForm.slug || '');
      setFormDescription(editingForm.description || '');
      setFields(editingForm.fields || []);
      setSelectedFunnelId(editingForm.auto_funnel_id || '');
      setSelectedStageId(editingForm.auto_stage_id || '');
      setSelectedOwnerId(editingForm.auto_owner_id || '');
      setSelectedSupervisorId(editingForm.auto_supervisor_id || '');
      setSelectedCategory(editingForm.auto_category || 'Creators');
    } else {
      setFormName('');
      setFormPublicName('');
      setFormSlug('');
      setFormDescription('');
      setFields([]);
      setSelectedFunnelId('');
      setSelectedStageId('');
      setSelectedOwnerId('');
      setSelectedSupervisorId('');
      setSelectedCategory('Creators');
    }
    setActiveTab('editor');
    setError('');
  }, [editingForm, isOpen]);

  // Função para gerar slug a partir de uma string
  const slugify = (text: string, isFinal = true) => {
    let s = text
      .toString()
      .toLowerCase()
      .normalize('NFD') // Remove acentos
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s-]/g, '') // Remove caracteres especiais
      .replace(/[\s_]+/g, '-'); // Substitui espaços e underscores por hífens
    
    if (isFinal) {
      s = s.trim().replace(/^-+|-+$/g, ''); // Remove hífens no início e fim apenas no final
    }
    return s;
  };

  // Atualizar slug automaticamente quando o nome público mudar (apenas se não for edição manual ou se estiver vazio)
  const handlePublicNameChange = (val: string) => {
    setFormPublicName(val);
    // Se estiver criando um novo ou se o slug atual for igual ao slug do nome anterior, atualiza
    if (!editingForm || !formSlug || formSlug === slugify(formPublicName)) {
      setFormSlug(slugify(val));
    }
  };

  // Lidar com a mudança manual do slug permitindo hífens durante a digitação
  const handleSlugChange = (val: string) => {
    // Permite letras, números e hífens, mas não limpa hífens finais durante a digitação
    const cleaned = slugify(val, false);
    setFormSlug(cleaned);
  };

  // Quando muda o funil selecionado, carregar etapas
  useEffect(() => {
    if (selectedFunnelId) {
      loadStages(selectedFunnelId);
    } else {
      setStages([]);
      setSelectedStageId('');
    }
  }, [selectedFunnelId]);

  const loadFunnels = async () => {
    setLoadingFunnels(true);
    try {
      const { data, error: err } = await supabase
        .from('funnels')
        .select('id, name, is_default')
        .order('is_default', { ascending: false });
      if (!err && data) {
        setFunnels(data);
        // Se editando e tem funil configurado, carregar etapas
        if (editingForm?.auto_funnel_id) {
          loadStages(editingForm.auto_funnel_id);
        }
      }
    } catch (e) {
      console.error('Erro ao carregar funis:', e);
    } finally {
      setLoadingFunnels(false);
    }
  };

  const loadStages = async (funnelId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('funnel_stages')
        .select('id, label, sort_order, funnel_id')
        .eq('funnel_id', funnelId)
        .order('sort_order', { ascending: true });
      if (!err && data) {
        setStages(data);
        // Se a etapa selecionada não pertence a este funil, limpar
        if (selectedStageId && !data.find(s => s.id === selectedStageId)) {
          // Manter se estiver editando e o funil é o mesmo
          if (!(editingForm?.auto_funnel_id === funnelId && editingForm?.auto_stage_id === selectedStageId)) {
            setSelectedStageId('');
          }
        }
      }
    } catch (e) {
      console.error('Erro ao carregar etapas:', e);
    }
  };

  const generateId = () => `field_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error: err } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .order('full_name', { ascending: true });
      if (!err && data) setUsers(data);
    } catch (e) {
      console.error('Erro ao carregar usuários:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const addField = (type: FormField['type']) => {
    const newField: FormField = {
      id: generateId(),
      type,
      label: '',
      placeholder: '',
      required: false,
      options: (type === 'select' || type === 'multiselect') ? [] : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updated: FormField) => {
    const newFields = [...fields];
    newFields[index] = updated;
    setFields(newFields);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newFields.length) return;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError('Nome do formulário é obrigatório');
      return;
    }
    if (fields.length === 0) {
      setError('Adicione pelo menos um campo ao formulário');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const formData = {
        name: formName,
        public_name: formPublicName.trim() || null,
        slug: formSlug.trim() || null,
        description: formDescription,
        fields,
        is_active: editingForm?.is_active ?? true,
        auto_funnel_id: selectedFunnelId || null,
        auto_stage_id: selectedStageId || null,
        auto_owner_id: selectedOwnerId || null,
        auto_supervisor_id: selectedSupervisorId || null,
        auto_category: selectedCategory || 'Creators',
        updated_at: new Date().toISOString(),
      };

      if (editingForm) {
        const { error } = await supabase
          .from('form_templates')
          .update(formData)
          .eq('id', editingForm.id);
        if (error) throw error;
        
        await logActivity({
          action: 'update',
          module: 'forms',
          entityId: editingForm.id,
          entityName: formName,
          details: { before: editingForm, after: formData }
        });
      } else {
        const { data: newForm, error } = await supabase
          .from('form_templates')
          .insert([{ ...formData, created_by: user?.id || null }])
          .select()
          .single();
        if (error) throw error;
        
        await logActivity({
          action: 'create',
          module: 'forms',
          entityId: newForm.id,
          entityName: formName,
          details: { data: formData }
        });
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Erro ao salvar formulário:', err);
      setError('Erro ao salvar formulário. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const fieldTypes: { type: FormField['type']; label: string; icon: string }[] = [
    { type: 'section_title', label: 'Título/Seção', icon: 'ri-heading' },
    { type: 'image', label: 'Imagem', icon: 'ri-image-line' },
    { type: 'text', label: 'Texto', icon: 'ri-text' },
    { type: 'textarea', label: 'Texto longo', icon: 'ri-file-text-line' },
    { type: 'number', label: 'Número', icon: 'ri-hashtag' },
    { type: 'email', label: 'E-mail', icon: 'ri-mail-line' },
    { type: 'phone', label: 'Telefone', icon: 'ri-phone-line' },
    { type: 'select', label: 'Seleção', icon: 'ri-list-check' },
    { type: 'multiselect', label: 'Múltipla', icon: 'ri-checkbox-multiple-line' },
    { type: 'checkbox', label: 'Sim/Não', icon: 'ri-checkbox-line' },
    { type: 'date', label: 'Data', icon: 'ri-calendar-line' },
    { type: 'url', label: 'Link', icon: 'ri-link' },
    { type: 'rating', label: 'Avaliação', icon: 'ri-star-line' },
  ];

  const addAddressFields = () => {
    const addressFields: FormField[] = [
      {
        id: generateId(),
        type: 'text',
        label: 'CEP',
        placeholder: 'Ex: 01001-000',
        required: true,
      },
      {
        id: generateId(),
        type: 'text',
        label: 'Rua / Logradouro',
        placeholder: 'Ex: Rua das Flores',
        required: true,
      },
      {
        id: generateId(),
        type: 'text',
        label: 'Número',
        placeholder: 'Ex: 123',
        required: true,
      },
      {
        id: generateId(),
        type: 'text',
        label: 'Complemento',
        placeholder: 'Ex: Apto 45, Bloco B',
        required: false,
      },
      {
        id: generateId(),
        type: 'text',
        label: 'Bairro',
        placeholder: 'Ex: Centro',
        required: true,
      },
      {
        id: generateId(),
        type: 'text',
        label: 'Cidade',
        placeholder: 'Ex: São Paulo',
        required: true,
      },
      {
        id: generateId(),
        type: 'select',
        label: 'Estado',
        placeholder: 'Selecione o estado',
        required: true,
        options: [
          'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
          'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
          'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
        ],
      },
    ];
    setFields([...fields, ...addressFields]);
  };

  const addPersonalDataFields = () => {
    const personalFields: FormField[] = [
      {
        id: generateId(),
        type: 'text',
        label: 'Nome Completo',
        placeholder: 'Ex: Maria da Silva',
        required: true,
      },
      {
        id: generateId(),
        type: 'text',
        label: 'CPF',
        placeholder: 'Ex: 000.000.000-00',
        required: true,
      },
      {
        id: generateId(),
        type: 'date',
        label: 'Data de Nascimento',
        placeholder: '',
        required: true,
      },
      {
        id: generateId(),
        type: 'phone',
        label: 'Telefone',
        placeholder: 'Ex: (11) 99999-9999',
        required: true,
      },
      {
        id: generateId(),
        type: 'email',
        label: 'E-mail',
        placeholder: 'Ex: maria@email.com',
        required: true,
      },
    ];
    setFields([...fields, ...personalFields]);
  };

  const addPixFields = () => {
    const pixFields: FormField[] = [
      {
        id: generateId(),
        type: 'select',
        label: 'Tipo de Chave PIX',
        placeholder: 'Selecione o tipo',
        required: true,
        options: ['CPF', 'CNPJ', 'E-mail', 'Telefone', 'Chave Aleatória'],
      },
      {
        id: generateId(),
        type: 'text',
        label: 'Chave PIX',
        placeholder: 'Ex: 000.000.000-00 ou email@exemplo.com',
        required: true,
      },
    ];
    setFields([...fields, ...pixFields]);
  };

  const addTikTokChannelFields = () => {
    const tiktokFields: FormField[] = [
      {
        id: generateId(),
        type: 'url',
        label: 'Canal do TikTok',
        placeholder: 'Ex: https://tiktok.com/@seucanal',
        required: true,
      },
    ];
    setFields([...fields, ...tiktokFields]);
  };

  const addInstagramProfileFields = () => {
    const instagramFields: FormField[] = [
      {
        id: generateId(),
        type: 'url',
        label: 'Perfil do Instagram',
        placeholder: 'Ex: https://instagram.com/@seuperfil',
        required: true,
      },
    ];
    setFields([...fields, ...instagramFields]);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingForm ? 'Editar Formulário' : 'Novo Formulário'}
      subtitle="Monte o formulário adicionando e organizando os campos"
      size="xl"
    >
      <div className="space-y-5">
        {/* Form info */}
        <div className="space-y-3">
          {/* Row 1: Nome interno + Nome público */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                <i className="ri-lock-line text-gray-400 text-xs"></i>
                Nome interno *
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-semibold bg-gray-100 text-gray-500 rounded-full uppercase tracking-wide">Privado</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => { setFormName(e.target.value); setError(''); }}
                placeholder="Ex: Briefing Creator TikTok Q1"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">Visível apenas no painel interno</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                <i className="ri-global-line text-teal-500 text-xs"></i>
                Nome público
                <span className="ml-1 px-1.5 py-0.5 text-[9px] font-semibold bg-teal-50 text-teal-600 rounded-full uppercase tracking-wide">Público</span>
              </label>
              <input
                type="text"
                value={formPublicName}
                onChange={(e) => handlePublicNameChange(e.target.value)}
                placeholder="Ex: Cadastro de Creator"
                className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
              />
              <p className="text-[10px] text-gray-400 mt-1">Título que o creator verá no formulário. Se vazio, usa o nome interno.</p>
            </div>
          </div>

          {/* Row: Slug (URL amigável) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              <i className="ri-link text-indigo-500 text-xs"></i>
              Slug (URL amigável)
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-semibold bg-indigo-50 text-indigo-600 rounded-full uppercase tracking-wide">URL amigável</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-2 rounded-lg border border-gray-100">/f/</span>
              <input
                type="text"
                value={formSlug}
                onChange={(e) => handleSlugChange(e.target.value)}
                onBlur={() => setFormSlug(slugify(formSlug, true))}
                placeholder="Ex: cadastro-embaixadores"
                className="flex-1 px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all font-mono"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Identificador único para o link do formulário. Gerado automaticamente a partir do nome público.</p>
          </div>

          {/* Row 2: Descrição */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
              <i className="ri-file-text-line text-gray-400 text-xs"></i>
              Descrição pública
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-semibold bg-teal-50 text-teal-600 rounded-full uppercase tracking-wide">Público</span>
            </label>
            <input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Ex: Preencha seus dados para participar do programa de creators"
              className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
            />
            <p className="text-[10px] text-gray-400 mt-1">Subtítulo exibido abaixo do nome no formulário público</p>
          </div>
        </div>

        {/* Funnel/Stage auto-config */}
        <div className="bg-gradient-to-r from-teal-50/60 to-cyan-50/40 border border-teal-100 rounded-xl p-4">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-7 h-7 flex items-center justify-center rounded-lg bg-teal-100 text-teal-600">
              <i className="ri-flow-chart text-sm"></i>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800">Criação automática de card</p>
              <p className="text-[10px] text-gray-500">Escolha em qual funil e etapa o card será criado quando um novo creator preencher o formulário</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Funil</label>
              <select
                value={selectedFunnelId}
                onChange={(e) => {
                  setSelectedFunnelId(e.target.value);
                  setSelectedStageId('');
                }}
                disabled={loadingFunnels}
                className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all bg-white cursor-pointer"
              >
                <option value="">Funil padrão (automático)</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.is_default ? ' (padrão)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Etapa do funil</label>
              <select
                value={selectedStageId}
                onChange={(e) => setSelectedStageId(e.target.value)}
                disabled={!selectedFunnelId && stages.length === 0}
                className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all bg-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Primeira etapa (automático)</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              {!selectedFunnelId && (
                <p className="text-[10px] text-gray-400 mt-1">Selecione um funil para ver as etapas</p>
              )}
            </div>
          </div>

          {/* Owner / Supervisor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-3 border-t border-teal-100">
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1 flex items-center gap-1">
                <i className="ri-user-star-line text-teal-500 text-xs"></i>
                Proprietário do formulário
              </label>
              <select
                value={selectedOwnerId}
                onChange={(e) => setSelectedOwnerId(e.target.value)}
                disabled={loadingUsers}
                className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all bg-white cursor-pointer"
              >
                <option value="">Nenhum proprietário</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} {u.role === 'admin' ? '(Admin)' : u.role === 'manager' ? '(Gerente)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">Será o responsável automático no card criado</p>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-600 mb-1 flex items-center gap-1">
                <i className="ri-shield-user-line text-teal-500 text-xs"></i>
                Supervisor responsável
              </label>
              <select
                value={selectedSupervisorId}
                onChange={(e) => setSelectedSupervisorId(e.target.value)}
                disabled={loadingUsers}
                className="w-full px-3 py-2 text-sm border border-teal-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all bg-white cursor-pointer"
              >
                <option value="">Nenhum supervisor</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} {u.role === 'admin' ? '(Admin)' : u.role === 'manager' ? '(Gerente)' : ''}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">Supervisor que acompanha este processo</p>
            </div>
          </div>

          {/* Categoria do Creator */}
          <div className="mt-3 pt-3 border-t border-teal-100">
            <label className="block text-[11px] font-medium text-gray-600 mb-1 flex items-center gap-1">
              <i className="ri-medal-line text-teal-500 text-xs"></i>
              Categoria do Creator <span className="text-rose-500">*</span>
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              {['Creators', 'Embaixadores', 'Influenciadores', 'Parceiros', 'Afiliados'].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg border-2 transition-all cursor-pointer whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'border-teal-500 bg-teal-500 text-white shadow-sm'
                      : 'border-teal-100 bg-white text-gray-600 hover:border-teal-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              Será salvo na coluna <span className="font-mono">category</span> do creator ao preencher este formulário
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-fit">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'editor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ri-edit-line mr-1.5"></i>Editor
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-1.5 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'preview' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className="ri-eye-line mr-1.5"></i>Pré-visualização
          </button>
        </div>

        {activeTab === 'editor' ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            {/* Field type palette */}
            <div className="lg:col-span-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Adicionar campo</p>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-1.5">
                {fieldTypes.map((ft) => (
                  <button
                    key={ft.type}
                    onClick={() => addField(ft.type)}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-left rounded-lg border border-gray-100 hover:border-brand-200 hover:bg-brand-50/50 transition-all cursor-pointer group"
                  >
                    <div className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 group-hover:bg-brand-100 text-gray-500 group-hover:text-brand-600 transition-all">
                      <i className={`${ft.icon} text-sm`}></i>
                    </div>
                    <span className="text-xs font-medium text-gray-600 group-hover:text-gray-800">{ft.label}</span>
                  </button>
                ))}
              </div>

              {/* Pre-configured address block */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Campos prontos</p>
                
                <div className="space-y-2">
                  {/* Dados Pessoais */}
                  <button
                    onClick={addPersonalDataFields}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left rounded-lg border-2 border-dashed border-teal-200 hover:border-teal-400 bg-teal-50/50 hover:bg-teal-50 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-teal-100 group-hover:bg-teal-200 text-teal-600 transition-all">
                      <i className="ri-user-line text-base"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-teal-800 block">Dados Pessoais</span>
                      <span className="text-[10px] text-teal-500">Nome, CPF, Nascimento, Tel, E-mail</span>
                    </div>
                    <i className="ri-add-circle-line text-teal-400 group-hover:text-teal-600 text-lg transition-all"></i>
                  </button>

                  {/* PIX */}
                  <button
                    onClick={addPixFields}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left rounded-lg border-2 border-dashed border-emerald-200 hover:border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-100 group-hover:bg-emerald-200 text-emerald-600 transition-all">
                      <i className="ri-money-dollar-circle-line text-base"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-emerald-800 block">Dados PIX</span>
                      <span className="text-[10px] text-emerald-500">Tipo de Chave e Chave PIX</span>
                    </div>
                    <i className="ri-add-circle-line text-emerald-400 group-hover:text-emerald-600 text-lg transition-all"></i>
                  </button>

                  {/* Endereço Completo */}
                  <button
                    onClick={addAddressFields}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left rounded-lg border-2 border-dashed border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-100 group-hover:bg-amber-200 text-amber-600 transition-all">
                      <i className="ri-map-pin-line text-base"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-amber-800 block">Endereço Completo</span>
                      <span className="text-[10px] text-amber-500">CEP, Rua, Nº, Bairro, Cidade, UF</span>
                    </div>
                    <i className="ri-add-circle-line text-amber-400 group-hover:text-amber-600 text-lg transition-all"></i>
                  </button>

                  {/* Canal do TikTok */}
                  <button
                    onClick={addTikTokChannelFields}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left rounded-lg border-2 border-dashed border-rose-200 hover:border-rose-400 bg-rose-50/50 hover:bg-rose-50 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-rose-100 group-hover:bg-rose-200 text-rose-600 transition-all">
                      <i className="ri-tiktok-line text-base"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-rose-800 block">Canal do TikTok</span>
                      <span className="text-[10px] text-rose-500">Link do canal</span>
                    </div>
                    <i className="ri-add-circle-line text-rose-400 group-hover:text-rose-600 text-lg transition-all"></i>
                  </button>

                  {/* Perfil do Instagram */}
                  <button
                    onClick={addInstagramProfileFields}
                    className="w-full flex items-center gap-2.5 px-3 py-3 text-left rounded-lg border-2 border-dashed border-purple-200 hover:border-purple-400 bg-purple-50/50 hover:bg-purple-50 transition-all cursor-pointer group"
                  >
                    <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-purple-100 group-hover:bg-purple-200 text-purple-600 transition-all">
                      <i className="ri-instagram-line text-base"></i>
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-purple-800 block">Perfil do Instagram</span>
                      <span className="text-[10px] text-purple-500">Link do perfil</span>
                    </div>
                    <i className="ri-add-circle-line text-purple-400 group-hover:text-purple-600 text-lg transition-all"></i>
                  </button>
                </div>
              </div>
            </div>

            {/* Fields list */}
            <div className="lg:col-span-3 space-y-3">
              {fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
                    <i className="ri-drag-drop-line text-2xl text-gray-300"></i>
                  </div>
                  <p className="text-sm font-medium text-gray-500">Nenhum campo adicionado</p>
                  <p className="text-xs text-gray-400 mt-1">Clique nos tipos ao lado para adicionar campos</p>
                </div>
              ) : (
                fields.map((field, index) => (
                  <FormFieldEditor
                    key={field.id}
                    field={field}
                    index={index}
                    totalFields={fields.length}
                    onUpdate={(updated) => updateField(index, updated)}
                    onRemove={() => removeField(index)}
                    onMoveUp={() => moveField(index, 'up')}
                    onMoveDown={() => moveField(index, 'down')}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
            <FormPreview formName={formPublicName || formName} formDescription={formDescription} fields={fields} />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-100 rounded-lg">
            <i className="ri-error-warning-line text-rose-500"></i>
            <span className="text-xs text-rose-600">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {fields.length} {fields.length === 1 ? 'campo' : 'campos'}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <i className="ri-save-line"></i>
                  {editingForm ? 'Salvar Alterações' : 'Criar Formulário'}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
