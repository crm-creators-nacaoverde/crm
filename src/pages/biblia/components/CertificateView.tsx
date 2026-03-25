import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { BibleModule } from '../../../hooks/useBiblia';

interface Props {
  modules: BibleModule[];
  onClose: () => void;
}

export default function CertificateView({ modules, onClose }: Props) {
  const { profile } = useAuth();
  const [companyName, setCompanyName] = useState('CRM Creator Milionário');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const today = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });

  useEffect(() => {
    supabase.from('company_settings').select('name, logo_url, logo_base64').limit(1).single()
      .then(({ data }) => {
        if (data) {
          if (data.name) setCompanyName(data.name);
          if (data.logo_base64) setLogoUrl(data.logo_base64);
          else if (data.logo_url) setLogoUrl(data.logo_url);
        }
      });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(#certificate-wrapper) { display: none !important; }
          #certificate-wrapper { position: fixed; inset: 0; z-index: 9999; background: white; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 0; }
        }
      `}</style>

      <div id="certificate-wrapper" className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
        {/* Botões de ação */}
        <div className="no-print absolute top-4 right-4 flex items-center gap-2 z-10">
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-[#004aad] text-white text-sm font-semibold rounded-xl hover:bg-[#003d91] cursor-pointer transition-colors shadow-lg">
            <i className="ri-download-line"></i>Baixar PDF
          </button>
          <button onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-100 cursor-pointer transition-colors shadow-lg">
            <i className="ri-close-line"></i>Fechar
          </button>
        </div>

        {/* Certificado */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ width: '820px', minHeight: '580px' }}>
          {/* Borda decorativa */}
          <div className="h-3 w-full" style={{ background: 'linear-gradient(90deg, #004aad, #5de0e6)' }}></div>

          <div className="px-16 py-12 flex flex-col items-center text-center gap-6">
            {/* Logo + nome da empresa */}
            <div className="flex items-center gap-3">
              {logoUrl
                ? <img src={logoUrl} alt="Logo" className="h-14 object-contain" />
                : <div className="w-14 h-14 bg-[#004aad]/10 rounded-2xl flex items-center justify-center">
                    <i className="ri-book-open-line text-2xl text-[#004aad]"></i>
                  </div>}
              <div className="text-left">
                <p className="text-lg font-bold text-gray-900">{companyName}</p>
                <p className="text-xs text-gray-500">Bíblia Comercial</p>
              </div>
            </div>

            {/* Título */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-[0.2em] mb-2">Certificado de Conclusão</p>
              <div className="w-16 h-0.5 mx-auto" style={{ backgroundColor: '#5de0e6' }}></div>
            </div>

            {/* Nome do usuário */}
            <div>
              <p className="text-sm text-gray-500 mb-2">Certificamos que</p>
              <p className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
                {profile?.full_name}
              </p>
            </div>

            {/* Texto */}
            <p className="text-gray-600 text-sm max-w-xl leading-relaxed">
              concluiu com êxito todos os módulos da <strong>Bíblia Comercial</strong>,
              demonstrando dedicação e comprometimento com o desenvolvimento profissional.
            </p>

            {/* Módulos concluídos */}
            <div className="w-full bg-gray-50 rounded-xl p-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-3">Módulos concluídos</p>
              <div className="flex flex-wrap justify-center gap-2">
                {modules.filter(m => m.is_published).map(m => (
                  <span key={m.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700">
                    <i className={`${m.icon} text-xs`} style={{ color: m.color }}></i>
                    {m.title}
                  </span>
                ))}
              </div>
            </div>

            {/* Data e assinatura */}
            <div className="flex items-end justify-between w-full pt-4 border-t border-gray-100">
              <div className="text-left">
                <p className="text-xs text-gray-400">Data de conclusão</p>
                <p className="text-sm font-semibold text-gray-700">{today}</p>
              </div>
              <div className="text-center">
                <div className="w-32 h-px bg-gray-300 mb-1"></div>
                <p className="text-xs text-gray-500">{companyName}</p>
              </div>
            </div>
          </div>

          {/* Borda inferior */}
          <div className="h-3 w-full" style={{ background: 'linear-gradient(90deg, #5de0e6, #004aad)' }}></div>
        </div>
      </div>
    </>
  );
}
