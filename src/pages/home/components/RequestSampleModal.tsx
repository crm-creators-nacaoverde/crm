import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import Modal from '../../../components/base/Modal';
import { useClientHistory } from '../../../hooks/useClientHistory';

interface RequestSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  dealId: string;
  dealTitle: string;
  onSuccess?: () => Promise<void>;
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

export default function RequestSampleModal({ 
  isOpen, 
  onClose, 
  clientId, 
  dealId, 
  dealTitle,
  onSuccess 
}: RequestSampleModalProps) {
  const [saving, setSaving] = useState(false);
  const [clientName, setClientName] = useState('');
  const { logClientEvent } = useClientHistory();
  const [carrierOptions, setCarrierOptions] = useState<string[]>(CARRIER_FALLBACK);
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string }[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);

  const [form, setForm] = useState({
    shipping_status: 'pending',
    tracking_code: '',
    carrier: '',
    shipping_date: '',
    estimated_delivery: '',
    shipping_address: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen && clientId) {
      // Carregar produtos ativos
      supabase.from('products')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
        .then(({ data }) => {
          if (data) setAvailableProducts(data);
        });

      // Carregar dados do cliente para o endereço inicial
      supabase.from('clients')
        .select('name, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep')
        .eq('id', clientId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setClientName(data.name);
            const addressParts = [
              data.endereco_rua,
              data.endereco_numero ? `nº ${data.endereco_numero}` : '',
              data.endereco_complemento,
              data.endereco_bairro,
              data.endereco_cidade && data.endereco_estado ? `${data.endereco_cidade} - ${data.endereco_estado}` : data.endereco_cidade || data.endereco_estado,
              data.endereco_cep ? `CEP: ${data.endereco_cep}` : '',
            ].filter(Boolean);
            
            setForm(prev => ({
              ...prev,
              shipping_address: addressParts.join(', ')
            }));
          }
        });

      // Carregar transportadoras
      supabase.from('carriers').select('name').eq('is_active', true).order('sort_order')
        .then(({ data }) => {
          if (data && data.length > 0) setCarrierOptions(data.map(c => c.name));
        });
    }
  }, [isOpen, clientId]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Combinar produtos selecionados com as notas manuais
      const productsText = selectedProducts.length > 0 
        ? `Produtos: ${selectedProducts.join(', ')}` 
        : '';
      
      const finalNotes = [productsText, form.notes].filter(Boolean).join('\n');

      const { error } = await supabase.from('logistics').insert({
        client_id: clientId,
        deal_id: dealId,
        client_name: clientName,
        shipping_status: form.shipping_status,
        tracking_code: form.tracking_code || null,
        carrier: form.carrier || null,
        shipping_date: form.shipping_date || null,
        estimated_delivery: form.estimated_delivery || null,
        shipping_address: form.shipping_address || null,
        notes: finalNotes || null,
        created_by: user?.id || null,
      });

      if (error) throw error;

      // Log no histórico do cliente
      await logClientEvent({
        client_id: clientId,
        type: 'logistica',
        title: 'Amostra Solicitada',
        description: `Solicitação de amostra registrada via acompanhamento: ${dealTitle}. Status: ${statusOptions.find(s => s.value === form.shipping_status)?.label}`,
        metadata: { deal_id: dealId, status: form.shipping_status }
      });

      if (onSuccess) await onSuccess();
      onClose();
    } catch (err) {
      console.error('Erro ao solicitar amostra:', err);
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5";
  const inputClass = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6] transition-all";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Solicitar Amostra"
      subtitle={`Registrar envio de produtos para ${clientName}`}
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Status do Envio</label>
            <select
              value={form.shipping_status}
              onChange={e => setForm(f => ({ ...f, shipping_status: e.target.value }))}
              className={inputClass}
            >
              {statusOptions.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Transportadora</label>
            <select
              value={form.carrier}
              onChange={e => setForm(f => ({ ...f, carrier: e.target.value }))}
              className={inputClass}
            >
              <option value="">Selecione...</option>
              {carrierOptions.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Código de Rastreio</label>
            <input
              type="text"
              value={form.tracking_code}
              onChange={e => setForm(f => ({ ...f, tracking_code: e.target.value }))}
              placeholder="Ex: AA123456789BR"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Data de Envio</label>
            <input
              type="date"
              value={form.shipping_date}
              onChange={e => setForm(f => ({ ...f, shipping_date: e.target.value }))}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Endereço de Entrega</label>
          <textarea
            value={form.shipping_address}
            onChange={e => setForm(f => ({ ...f, shipping_address: e.target.value }))}
            rows={2}
            className={inputClass}
            placeholder="Endereço completo para o envio"
          />
        </div>

        {/* Seleção de Produtos Cadastrados */}
        <div>
          <label className={labelClass}>Produtos Cadastrados</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {availableProducts.map(product => {
              const isSelected = selectedProducts.includes(product.name);
              return (
                <button
                  key={product.id}
                  onClick={() => {
                    setSelectedProducts(prev => 
                      isSelected 
                        ? prev.filter(p => p !== product.name) 
                        : [...prev, product.name]
                    );
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-[#5de0e6] text-white border-[#5de0e6] shadow-sm' 
                      : 'bg-white text-gray-600 border-gray-200 hover:border-[#5de0e6] hover:text-[#5de0e6]'
                  }`}
                >
                  {product.name}
                  {isSelected && <i className="ri-check-line ml-1.5"></i>}
                </button>
              );
            })}
            {availableProducts.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nenhum produto ativo encontrado no cadastro.</p>
            )}
          </div>
        </div>

        <div>
          <label className={labelClass}>Observações Adicionais</label>
          <textarea
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            rows={2}
            className={inputClass}
            placeholder="Observações importantes sobre o envio..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-all cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-[#004aad] hover:bg-[#003d91] rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <i className="ri-loader-4-line animate-spin"></i>
            ) : (
              <i className="ri-send-plane-fill"></i>
            )}
            Solicitar Amostra
          </button>
        </div>
      </div>
    </Modal>
  );
}
