import { useState, useEffect, useCallback } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import Button from '../../components/base/Button';
import FormCard from './components/FormCard';
import FormBuilderModal from './components/FormBuilderModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import WebhookManagerModal from './components/WebhookManagerModal';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useActivityLog } from '../../hooks/useActivityLog';
import type { FormField } from './components/FormFieldEditor';

interface FormTemplate {
  id: string;
  name: string;
  public_name?: string | null;
  description: string;
  fields: FormField[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  share_token?: string;
}

export default function FormulariosPage() {
  const { user, hasPermission } = useAuth();
  const { logActivity } = useActivityLog();
  const [forms, setForms] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; form: FormTemplate | null }>({ open: false, form: null });
  const [deleting, setDeleting] = useState(false);

  // ── Estado do modal de Webhook ────────────────────────────────────────────
  const [webhookModal, setWebhookModal] = useState<{ id: string; name: string } | null>(null);

  const canEdit   = hasPermission('forms', 'edit');
  const canDelete = hasPermission('forms', 'delete');

  const loadForms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setForms(data || []);
    } catch (err) {
      console.error('Erro ao carregar formulários:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadForms(); }, [loadForms]);

  const handleEdit = (form: FormTemplate) => {
    setEditingForm(form);
    setBuilderOpen(true);
  };

  const handleNewForm = () => {
    setEditingForm(null);
    setBuilderOpen(true);
  };

  const handleDuplicate = async (form: FormTemplate) => {
    try {
      const { data: newForm, error } = await supabase
        .from('form_templates')
        .insert({
          name: `${form.name} (cópia)`,
          description: form.description,
          fields: form.fields,
          is_active: false,
          created_by: user?.id || null,
        })
        .select()
        .single();
      if (error) throw error;
      await logActivity({
        action: 'create', module: 'forms',
        entityId: newForm.id, entityName: `${form.name} (cópia)`,
        details: { action: 'duplicate', sourceFormId: form.id },
      });
      loadForms();
    } catch (err) {
      console.error('Erro ao duplicar:', err);
    }
  };

  const handleToggleActive = async (form: FormTemplate) => {
    try {
      const { error } = await supabase
        .from('form_templates')
        .update({ is_active: !form.is_active, updated_at: new Date().toISOString() })
        .eq('id', form.id);
      if (error) throw error;
      await logActivity({
        action: 'update', module: 'forms',
        entityId: form.id, entityName: form.name,
        details: { action: 'toggle_status', from: form.is_active, to: !form.is_active },
      });
      loadForms();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.form) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('form_templates')
        .delete()
        .eq('id', deleteModal.form.id);
      if (error) throw error;
      await logActivity({
        action: 'delete', module: 'forms',
        entityId: deleteModal.form.id, entityName: deleteModal.form.name,
        details: { deletedData: deleteModal.form },
      });
      setDeleteModal({ open: false, form: null });
      loadForms();
    } catch (err) {
      console.error('Erro ao excluir:', err);
    } finally {
      setDeleting(false);
    }
  };

  const filteredForms = forms.filter((form) => {
    const matchesSearch =
      form.name.toLowerCase().includes(search.toLowerCase()) ||
      (form.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && form.is_active) ||
      (filterStatus === 'inactive' && !form.is_active);
    return matchesSearch && matchesStatus;
  });

  const activeCount   = forms.filter(f => f.is_active).length;
  const inactiveCount = forms.filter(f => !f.is_active).length;
  const totalFields   = forms.reduce((acc, f) => acc + (f.fields?.length || 0), 0);

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <i className="ri-file-list-3-line text-lg"></i>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{forms.length}</p>
                <p className="text-[11px] text-gray-500">Total</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <i className="ri-checkbox-circle-line text-lg"></i>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{activeCount}</p>
                <p className="text-[11px] text-gray-500">Ativos</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <i className="ri-pause-circle-line text-lg"></i>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{inactiveCount}</p>
                <p className="text-[11px] text-gray-500">Inativos</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <i className="ri-layout-grid-line text-lg"></i>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{totalFields}</p>
                <p className="text-[11px] text-gray-500">Campos totais</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
            <div className="relative flex-1 max-w-xs">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text" value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar formulários..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 transition-all"
              />
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
              {(['all', 'active', 'inactive'] as const).map((status) => (
                <button key={status} onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all cursor-pointer whitespace-nowrap ${
                    filterStatus === status ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {status === 'all' ? 'Todos' : status === 'active' ? 'Ativos' : 'Inativos'}
                </button>
              ))}
            </div>
          </div>
          {canEdit && (
            <Button onClick={handleNewForm}>
              <i className="ri-add-line"></i>Novo Formulário
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="mt-3 text-sm text-gray-400">Carregando formulários...</p>
            </div>
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <i className="ri-file-list-3-line text-3xl text-gray-300"></i>
            </div>
            {forms.length === 0 ? (
              <>
                <p className="text-sm font-medium text-gray-600 mb-1">Nenhum formulário criado</p>
                <p className="text-xs text-gray-400 mb-5">Crie seu primeiro formulário modular para enviar aos creators</p>
                <Button onClick={handleNewForm}><i className="ri-add-line"></i>Criar Primeiro Formulário</Button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-600 mb-1">Nenhum resultado encontrado</p>
                <p className="text-xs text-gray-400">Tente ajustar os filtros ou a busca</p>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredForms.map((form) => (
              <div key={form.id} className="relative group/card">
                <FormCard
                  form={form}
                  onEdit={() => handleEdit(form)}
                  onDuplicate={() => handleDuplicate(form)}
                  onToggleActive={() => handleToggleActive(form)}
                  onDelete={() => setDeleteModal({ open: true, form })}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
                {/* ── Botão Webhook sobreposto no card ── */}
                {canEdit && (
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button
                      onClick={() => setWebhookModal({ id: form.id, name: form.name })}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-lg cursor-pointer transition-colors shadow-sm whitespace-nowrap"
                      title="Configurar Webhook">
                      <i className="ri-webhook-line text-sm"></i>Webhook
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <FormBuilderModal
        isOpen={builderOpen}
        onClose={() => { setBuilderOpen(false); setEditingForm(null); }}
        onSaved={loadForms}
        editingForm={editingForm}
      />

      <DeleteConfirmModal
        isOpen={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, form: null })}
        onConfirm={handleDelete}
        formName={deleteModal.form?.name || ''}
        loading={deleting}
      />

      {/* ── Webhook Manager Modal ── */}
      {webhookModal && (
        <WebhookManagerModal
          isOpen={!!webhookModal}
          onClose={() => setWebhookModal(null)}
          formId={webhookModal.id}
          formName={webhookModal.name}
        />
      )}
    </AppLayout>
  );
}
