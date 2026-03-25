import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import Input from '../../../components/base/Input';

interface LogisticsFormData {
  id?: string;
  client_id: string;
  deal_id: string | null;
  client_name: string;
  shipping_status: string;
  tracking_code: string;
  carrier: string;
  shipping_date: string;
  estimated_delivery: string;
  delivered_date: string;
  shipping_address: string;
  notes: string;
}

interface ClientOption {
  id: string;
  name: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
  endereco_complemento: string;
}

interface DealOption {
  id: string;
  title: string;
  client_id: string;
}

interface LogisticsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: LogisticsFormData) => Promise<void>;
  editingItem?: LogisticsFormData | null;
}

const statusOptions = [
  { value: 'pending', label: 'Pendente' },
  { value: 'preparing', label: 'Preparando' },
  { value: 'shipped', label: 'Enviado' },
  { value: 'in_transit', label: 'Em Trânsito' },
  { value: 'delivered', label: 'Entregue' },
  { value: 'returned', label: 'Devolvido' },
];

const CARRIER_FALLBACK = [
  'Correios', 'Jadlog', 'Loggi', 'Total Express',
  'Azul Cargo', 'Latam Cargo', 'Transportadora Própria', 'Motoboy', 'Outro',
];

export default function LogisticsFormModal({ isOpen, onClose, onSave, editingItem }: LogisticsFormModalProps) {
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<DealOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [form, setForm] = useState<LogisticsFormData>({
    client_id: '',
    deal_id: null,
    client_name: '',
    shipping_status: 'pending',
    tracking_code: '',
    carrier: '',
    shipping_date: '',
    estimated_delivery: '',
    delivered_date: '',
    shipping_address: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [carrierOptions, setCarrierOptions] = useState<string[]>(CARRIER_FALLBACK);

  useEffect(() => {
    supabase.from('carriers').select('name, tracking_url').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        if (data && data.length > 0) setCarrierOptions(data.map(c => c.name));
      });
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadClients();
      loadDeals();
      if (editingItem) {
        setForm({
          ...editingItem,
          tracking_code: editingItem.tracking_code || '',
          carrier: editingItem.carrier || '',
          shipping_date: editingItem.shipping_date ? editingItem.shipping_date.split('T')[0] : '',
          estimated_delivery: editingItem.estimated_delivery ? editingItem.estimated_delivery.split('T')[0] : '',
          delivered_date: editingItem.delivered_date ? editingItem.delivered_date.split('T')[0] : '',
          shipping_address: editingItem.shipping_address || '',
          notes: editingItem.notes || '',
        });
        setClientSearch(editingItem.client_name);
      } else {
        setForm({
          client_id: '',
          deal_id: null,
          client_name: '',
          shipping_status: 'pending',
          tracking_code: '',
          carrier: '',
          shipping_date: '',
          estimated_delivery: '',
          delivered_date: '',
          shipping_address: '',
          notes: '',
        });
        setClientSearch('');
      }
    }
  }, [isOpen, editingItem]);

  useEffect(() => {
    if (form.client_id) {
      setFilteredDeals(deals.filter(d => d.client_id === form.client_id));
    } else {
      setFilteredDeals([]);
    }
  }, [form.client_id, deals]);

  const loadClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, endereco_rua, endereco_numero, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep, endereco_complemento')
        .order('name');
      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Erro ao carregar creators:', err);
    }
  };

  const loadDeals = async () => {
    try {
      const { data, error } = await supabase
        .from('deals')
        .select('id, title, client_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDeals(data || []);
    } catch (err) {
      console.error('Erro ao carregar deals:', err);
    }
  };

  const selectClient = (client: ClientOption) => {
    const addressParts = [
      client.endereco_rua,
      client.endereco_numero,
      client.endereco_complemento,
      client.endereco_bairro,
      client.endereco_cidade,
      client.endereco_estado,
      client.endereco_cep,
    ].filter(Boolean);

    setForm(prev => ({
      ...prev,
      client_id: client.id,
      client_name: client.name,
      shipping_address: addressParts.join(', '),
    }));
    setClientSearch(client.name);
    setShowClientDropdown(false);
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!form.client_id) newErrors.client_id = 'Selecione um creator';
    if (!form.shipping_status) newErrors.shipping_status = 'Selecione um status';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      console.error('Erro ao salvar:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingItem?.id ? 'Editar Envio' : 'Novo Envio'}
      subtitle={editingItem?.id ? 'Atualize as informações do envio' : 'Registre um novo envio para um creator'}
      size="lg"
    >
      <div className="space-y-5">
        {/* Creator Selection */}
        <div className="relative">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Creator <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setShowClientDropdown(true);
                if (!e.target.value) {
                  setForm(prev => ({ ...prev, client_id: '', client_name: '', shipping_address: '' }));
                }
              }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Buscar creator..."
              className={`w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6] ${
                errors.client_id ? 'border-rose-500' : 'border-gray-300'
              }`}
              disabled={!!editingItem?.id}
            />
          </div>
          {errors.client_id && <p className="mt-1 text-xs text-rose-600">{errors.client_id}</p>}
          {showClientDropdown && !editingItem?.id && clientSearch && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">Nenhum creator encontrado</div>
              ) : (
                filteredClients.map(c => (
                  <button
                    key={c.id}
                    onClick={() => selectClient(c)}
                    className="w-full px-4 py-2.5 text-left hover:bg-gray-50 flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-8 h-8 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-lg flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      {c.endereco_cidade && (
                        <p className="text-xs text-gray-400">{c.endereco_cidade} - {c.endereco_estado}</p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Deal Selection */}
        {form.client_id && filteredDeals.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Card Vinculado (opcional)</label>
            <select
              value={form.deal_id || ''}
              onChange={(e) => setForm(prev => ({ ...prev, deal_id: e.target.value || null }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6] cursor-pointer"
            >
              <option value="">Nenhum</option>
              {filteredDeals.map(d => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Status <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.shipping_status}
              onChange={(e) => setForm(prev => ({ ...prev, shipping_status: e.target.value }))}
              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6] cursor-pointer ${
                errors.shipping_status ? 'border-rose-500' : 'border-gray-300'
              }`}
            >
              {statusOptions.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Carrier */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Transportadora</label>
            <select
              value={form.carrier}
              onChange={(e) => setForm(prev => ({ ...prev, carrier: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6] cursor-pointer"
            >
              <option value="">Selecionar...</option>
              {carrierOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Tracking Code */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Código de Rastreio</label>
          <Input
            value={form.tracking_code}
            onChange={(e) => setForm(prev => ({ ...prev, tracking_code: e.target.value.toUpperCase() }))}
            placeholder="Ex: BR123456789BR"
            className="font-mono"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Shipping Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Data de Envio</label>
            <Input
              type="date"
              value={form.shipping_date}
              onChange={(e) => setForm(prev => ({ ...prev, shipping_date: e.target.value }))}
            />
          </div>

          {/* Estimated Delivery */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Previsão de Entrega</label>
            <Input
              type="date"
              value={form.estimated_delivery}
              onChange={(e) => setForm(prev => ({ ...prev, estimated_delivery: e.target.value }))}
            />
          </div>

          {/* Delivered Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Data de Entrega</label>
            <Input
              type="date"
              value={form.delivered_date}
              onChange={(e) => setForm(prev => ({ ...prev, delivered_date: e.target.value }))}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Endereço de Entrega</label>
          <textarea
            value={form.shipping_address}
            onChange={(e) => setForm(prev => ({ ...prev, shipping_address: e.target.value }))}
            placeholder="Endereço completo de entrega..."
            rows={2}
            maxLength={500}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6] resize-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Observações</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Observações sobre o envio..."
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6] resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} className="flex-1" disabled={saving}>
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <i className="ri-loader-4-line animate-spin"></i>
                Salvando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <i className={editingItem?.id ? 'ri-save-line' : 'ri-add-line'}></i>
                {editingItem?.id ? 'Salvar Alterações' : 'Criar Envio'}
              </span>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
