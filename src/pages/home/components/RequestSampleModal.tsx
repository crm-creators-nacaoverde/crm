import { useState, useEffect, useRef } from 'react';
import { useWaConfig } from '../../../hooks/useWhatsApp';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConnectModal({ isOpen, onClose }: Props) {
  const { config, loading, saveConfig, fetchQrCode, checkConnection } = useWaConfig();
  const [form, setForm] = useState({ api_url: '', api_key: '', instance_name: '', webhook_secret: '' });
  const [qr, setQr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [loadingQr, setLoadingQr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isOpen && config) {
      setForm({
        api_url:        config.api_url        || '',
        api_key:        config.api_key        || '',
        instance_name:  config.instance_name  || 'teste',
        webhook_secret: config.webhook_secret || '',
      });
      setQr(config.qr_code || null);
      setConnected(config.is_connected);
    }
  }, [isOpen, config]);

  // Polling de status ao exibir QR
  useEffect(() => {
    if (qr && !connected) {
      pollRef.current = setInterval(async () => {
        const ok = await checkConnection();
        if (ok) { setConnected(true); setQr(null); clearInterval(pollRef.current!); }
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [qr, connected]);

  const handleSave = async () => {
    setSaving(true);
    await saveConfig(form);
    setSaving(false);
  };

  const handleGetQr = async () => {
    await handleSave();
    setLoadingQr(true);
    const code = await fetchQrCode();
    setQr(code);
    setLoadingQr(false);
  };

  const handleCheckNow = async () => {
    setChecking(true);
    const ok = await checkConnection();
    setConnected(ok);
    setChecking(false);
  };

  // ✅ URL do webhook vem do banco (config.webhook_url)
  // Fallback para o N8N caso o banco ainda não tenha sido atualizado
  const webhookUrl = config?.webhook_url || 'https://n8n.metodoia.com.br/webhook/wa-receber';

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-300/40 focus:border-emerald-400 bg-white font-mono transition-all';

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 rounded-xl flex items-center justify-center">
              <i className="ri-whatsapp-line text-emerald-600 text-lg"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Conectar WhatsApp</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`}></div>
                <p className="text-[11px] text-gray-400">{connected ? 'Conectado' : 'Desconectado'}</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-gray-100 cursor-pointer">
            <i className="ri-close-line text-gray-500"></i>
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Config da Evolution API */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Configuração da VPS</p>
            <div>
              <label className="block text-xs text-gray-500 mb-1">URL da Evolution API</label>
              <input
                type="url"
                value={form.api_url}
                onChange={e => setForm(f => ({ ...f, api_url: e.target.value }))}
                placeholder="https://evo.seudominio.com.br/"
                className={inp}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">API Key da instância</label>
              <input
                type="password"
                value={form.api_key}
                onChange={e => setForm(f => ({ ...f, api_key: e.target.value }))}
                placeholder="sua-api-key"
                className={inp}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome da instância</label>
              <input
                type="text"
                value={form.instance_name}
                onChange={e => setForm(f => ({ ...f, instance_name: e.target.value }))}
                placeholder="teste"
                className={inp}
              />
            </div>
          </div>

          {/* URL do Webhook — lida do banco */}
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2">
              <i className="ri-links-line text-emerald-600 text-sm"></i>
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                URL do Webhook — copie para a VPS
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white rounded-lg border border-emerald-200 px-3 py-2">
              <p className="text-xs font-mono text-gray-700 flex-1 break-all">{webhookUrl}</p>
              <button
                onClick={handleCopy}
                title="Copiar URL"
                className={`w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                  copied ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <i className={`${copied ? 'ri-check-line' : 'ri-file-copy-line'} text-sm`}></i>
              </button>
            </div>
            <p className="text-[10px] text-emerald-600">
              Configure este URL como webhook no painel da Evolution API
            </p>
          </div>

          {/* QR Code */}
          {qr && !connected && (
            <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-600">Escaneie o QR Code com seu WhatsApp</p>
              <img
                src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                alt="QR Code"
                className="w-48 h-48 rounded-xl border border-gray-200"
              />
              <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <i className="ri-loader-4-line animate-spin text-xs"></i>
                Aguardando conexão...
              </p>
            </div>
          )}

          {/* Conectado */}
          {connected && (
            <div className="flex items-center gap-2 p-3.5 bg-emerald-50 rounded-xl border border-emerald-100">
              <i className="ri-checkbox-circle-line text-emerald-600 text-lg"></i>
              <div>
                <p className="text-sm font-semibold text-emerald-800">WhatsApp conectado!</p>
                {config?.phone_number && (
                  <p className="text-[11px] text-emerald-600">{config.phone_number}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap gap-2 px-5 pb-5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {saving
              ? <i className="ri-loader-4-line animate-spin text-sm"></i>
              : <i className="ri-save-line text-sm"></i>}
            Salvar config
          </button>
          <button
            onClick={handleCheckNow}
            disabled={checking}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors whitespace-nowrap"
          >
            {checking
              ? <i className="ri-loader-4-line animate-spin text-sm"></i>
              : <i className="ri-signal-wifi-line text-sm"></i>}
            Verificar status
          </button>
          <button
            onClick={handleGetQr}
            disabled={loadingQr}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl cursor-pointer transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loadingQr
              ? <><i className="ri-loader-4-line animate-spin"></i>Gerando QR...</>
              : <><i className="ri-qr-code-line"></i>Gerar QR Code</>}
          </button>
        </div>
      </div>
    </div>
  );
}
