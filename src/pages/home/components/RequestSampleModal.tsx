
import { useState, useEffect } from 'react';
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useActivityLog } from '../../../hooks/useActivityLog';

interface ClientInfo {
  id: string;
  name: string;
  cpf_cnpj: string;
  endereco_rua: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_estado: string;
  endereco_cep: string;
}

interface RequestSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  dealId: string;
  dealTitle: string;
  onSuccess: () => void;
}

interface ProductItem {
  id: string;
  name: string;
  isDefault: boolean;
}

const DEFAULT_PRODUCTS: ProductItem[] = [
  { id: 'nac', name: 'NAC', isDefault: true },
  { id: '5m', name: '5M', isDefault: true },
  { id: '6m', name: '6M', isDefault: true },
];

export default function RequestSampleModal({
  isOpen,
  onClose,
  clientId,
  dealId,
  dealTitle,
  onSuccess,
}: RequestSampleModalProps) {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductItem[]>(DEFAULT_PRODUCTS);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [notes, setNotes] = useState('');
  const [successMsg, setSuccessMsg] = useState(false);

  useEffect(() => {
    if (isOpen && clientId) {
      loadClient();
      setSelectedProducts([]);
      setProducts(DEFAULT_PRODUCTS);
      setShowAddProduct(false);
      setNewProductName('');
      setNotes('');
      setSuccessMsg(false);
    }
  }, [isOpen, clientId]);

  const loadClient = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, cpf_cnpj, endereco_rua, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_estado, endereco_cep')
        .eq('id', clientId)
        .maybeSingle();
      if (error) throw error;
      setClient(data as ClientInfo | null);
    } catch (err) {
      console.error('Erro ao carregar creator:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (productId: string) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(p => p !== productId)
        : [...prev, productId]
    );
  };

  const handleAddProduct = () => {
    if (!newProductName.trim()) return;
    const newId = `custom_${Date.now()}`;
    const newProduct: ProductItem = {
      id: newId,
      name: newProductName.trim(),
      isDefault: false,
    };
    setProducts(prev => [...prev, newProduct]);
    setSelectedProducts(prev => [...prev, newId]);
    setNewProductName('');
    setShowAddProduct(false);
  };

  const removeCustomProduct = (productId: string) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    setSelectedProducts(prev => prev.filter(p => p !== productId));
  };

  const getFullAddress = () => {
    if (!client) return '';
    const parts = [
      client.endereco_rua,
      client.endereco_numero ? `n\u00BA ${client.endereco_numero}` : '',
      client.endereco_complemento,
      client.endereco_bairro,
      client.endereco_cidade && client.endereco_estado
        ? `${client.endereco_cidade} - ${client.endereco_estado}`
        : client.endereco_cidade || client.endereco_estado,
      client.endereco_cep ? `CEP: ${client.endereco_cep}` : '',
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleSubmit = async () => {
    if (selectedProducts.length === 0) return;
    if (!client) return;

    setSaving(true);
    try {
      const selectedProductNames = selectedProducts.map(id => {
        const product = products.find(p => p.id === id);
        return product?.name || id;
      });

      const fullAddress = getFullAddress();

      const payload = {
        client_id: clientId,
        deal_id: dealId,
        client_name: client.name,
        shipping_status: 'pending',
        shipping_address: fullAddress,
        notes: notes
          ? `Produtos: ${selectedProductNames.join(', ')} | ${notes}`
          : `Produtos: ${selectedProductNames.join(', ')}`,
        products: selectedProductNames.map(name => ({ name })),
        created_by: user?.id || null,
        updated_by: user?.id || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('logistics').insert(payload);
      if (error) throw error;

      await logActivity({
        action: 'create',
        module: 'logistics',
        entityName: client.name,
        details: {
          action: 'sample_request',
          products: selectedProductNames,
          deal: dealTitle,
        },
      });

      setSuccessMsg(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Erro ao solicitar amostra:', err);
    } finally {
      setSaving(false);
    }
  };

  const hasAddress = client && (client.endereco_rua || client.endereco_cidade);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Solicitar Amostra"
      subtitle={dealTitle}
      size="md"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <i className="ri-loader-4-line text-2xl text-[#5de0e6] animate-spin"></i>
        </div>
      ) : successMsg ? (
        <div className="flex flex-col items-center justify-center py-12 animate-[fadeIn_0.2s_ease-out]">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
            <i className="ri-check-double-line text-3xl text-emerald-600"></i>
          </div>
          <p className="text-base font-semibold text-gray-900">Amostra solicitada!</p>
          <p className="text-sm text-gray-500 mt-1">O pedido foi enviado para a Log\u00EDstica</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Dados do Creator */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <i className="ri-user-star-line text-sm text-[#004aad]"></i>
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Dados do Creator</span>
            </div>

            {/* Nome */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm">
                  {client?.name?.charAt(0).toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{client?.name || 'N/A'}</p>
                {client?.cpf_cnpj && (
                  <p className="text-xs text-gray-500 font-mono">{client.cpf_cnpj}</p>
                )}
              </div>
            </div>

            {/* Endereço */}
            <div className={`rounded-lg p-3 ${hasAddress ? 'bg-sky-50 border border-sky-100' : 'bg-amber-50 border border-amber-100'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <i className={`ri-map-pin-line text-xs ${hasAddress ? 'text-sky-500' : 'text-amber-500'}`}></i>
                <span className="text-[11px] font-medium text-gray-500">Endere\u00E7o de Entrega</span>
              </div>
              {hasAddress ? (
                <p className="text-sm text-gray-700">{getFullAddress()}</p>
              ) : (
                <p className="text-sm text-amber-600 font-medium">
                  <i className="ri-error-warning-line text-xs mr-1"></i>
                  Endere\u00E7o n\u00E3o cadastrado. Edite o creator para adicionar.
                </p>
              )}
            </div>

            {/* CPF */}
            {!client?.cpf_cnpj && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                <p className="text-sm text-amber-600 font-medium">
                  <i className="ri-error-warning-line text-xs mr-1"></i>
                  CPF/CNPJ n\u00E3o cadastrado.
                </p>
              </div>
            )}
          </div>

          {/* Seleção de Produtos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <i className="ri-gift-line text-sm text-[#004aad]"></i>
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Produtos</span>
              </div>
              <span className="text-[11px] text-gray-400">
                {selectedProducts.length} selecionado{selectedProducts.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {products.map(product => {
                const isSelected = selectedProducts.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => toggleProduct(product.id)}
                    className={`relative flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#004aad] bg-[#004aad]/5 text-[#004aad]'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center transition-all ${
                      isSelected ? 'border-[#004aad] bg-[#004aad]' : 'border-gray-300'
                    }`}>
                      {isSelected && <i className="ri-check-line text-white text-[10px]"></i>}
                    </div>
                    <span className="text-sm font-semibold">{product.name}</span>
                    {!product.isDefault && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomProduct(product.id);
                        }}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600 transition-all cursor-pointer"
                      >
                        <i className="ri-close-line text-[10px]"></i>
                      </button>
                    )}
                  </button>
                );
              })}

              {/* Botão Cadastrar Produto */}
              {!showAddProduct ? (
                <button
                  type="button"
                  onClick={() => setShowAddProduct(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-400 hover:border-[#5de0e6] hover:text-[#004aad] hover:bg-[#5de0e6]/5 transition-all cursor-pointer"
                >
                  <i className="ri-add-line text-sm"></i>
                  <span className="text-sm font-medium">Outro</span>
                </button>
              ) : (
                <div className="col-span-3 flex items-center gap-2 mt-1">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newProductName}
                      onChange={(e) => setNewProductName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
                      placeholder="Nome do produto..."
                      autoFocus
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6]"
                    />
                  </div>
                  <Button size="sm" onClick={handleAddProduct} disabled={!newProductName.trim()}>
                    <i className="ri-check-line text-xs"></i>
                    Adicionar
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowAddProduct(false);
                      setNewProductName('');
                    }}
                  >
                    <i className="ri-close-line text-xs"></i>
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Observa\u00E7\u00F5es (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Alguma observa\u00E7\u00E3o sobre o envio..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5de0e6]/50 focus:border-[#5de0e6] resize-none"
            />
          </div>

          {/* Ações */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1"
              disabled={saving || selectedProducts.length === 0 || !hasAddress}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin"></i>
                  Enviando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-send-plane-line text-sm"></i>
                  Solicitar Amostra
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
