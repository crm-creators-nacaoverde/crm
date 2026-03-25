import { useState, useEffect } from 'react';
import AppLayout from '../../components/feature/AppLayout';
import { useBiblia } from '../../hooks/useBiblia';
import { useNavigate } from 'react-router-dom';
import ModuleFormModal from './components/ModuleFormModal';
import ProgressPanel from './components/ProgressPanel';
import CertificateView from './components/CertificateView';
import { supabase } from '../../lib/supabase';

type AdminTab = 'modules' | 'progress' | 'preview';

const CONTENT_TYPE_ICON: Record<string, string> = {
  video: 'ri-play-circle-line', pdf: 'ri-file-pdf-line',
  doc: 'ri-file-word-line', image: 'ri-image-line', article: 'ri-article-line',
};

export default function BibliaPage() {
  const navigate = useNavigate();
  const { visibleModules, modules, loading, isEditor, isAdmin, loadModules, getModuleProgress, progress, markCompleted } = useBiblia();
  const [adminTab, setAdminTab] = useState<AdminTab>('modules');
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCertificate, setShowCertificate] = useState(false);
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadCounts = async () => {
      const { data } = await supabase
        .from('bible_lessons')
        .select('module_id')
        .eq('is_published', true);
      const counts: Record<string, number> = {};
      (data || []).forEach(l => { counts[l.module_id] = (counts[l.module_id] || 0) + 1; });
      setLessonCounts(counts);
    };
    loadCounts();
  }, [modules]);

  const handleDelete = async () => {
    if (!deletingId) return;
    setDeleting(true);
    await supabase.from('bible_modules').delete().eq('id', deletingId);
    setDeletingId(null);
    setDeleting(false);
    await loadModules();
  };

  // Checar se todos os módulos foram concluídos
  const allDone = (() => {
    if (isAdmin) return false;
    const pub = visibleModules.filter(m => m.is_published);
    if (pub.length === 0) return false;
    return pub.every(m => {
      const total = lessonCounts[m.id] || 0;
      const done  = progress.filter(p => p.module_id === m.id && p.completed).length;
      return total > 0 && done >= total;
    });
  })();

  const displayModules = isEditor && adminTab !== 'preview' ? modules : visibleModules;

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <i className="ri-book-open-line text-[#004aad]"></i>Bíblia Comercial
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {isEditor ? `${modules.length} módulo${modules.length !== 1 ? 's' : ''} cadastrado${modules.length !== 1 ? 's' : ''}` : 'Seu treinamento completo'}
            </p>
          </div>
          {isEditor && (
            <button onClick={() => { setEditingModule(null); setShowModuleForm(true); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors">
              <i className="ri-add-line"></i>Novo módulo
            </button>
          )}
        </div>

        {/* Banner certificado */}
        {allDone && (
          <div className="bg-gradient-to-r from-[#004aad] to-[#5de0e6] rounded-2xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <i className="ri-medal-line text-white text-2xl"></i>
              </div>
              <div>
                <p className="text-white font-bold text-base">Parabéns! Você concluiu todos os módulos</p>
                <p className="text-white/80 text-sm">Seu certificado está disponível para download</p>
              </div>
            </div>
            <button onClick={() => setShowCertificate(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#004aad] text-sm font-bold rounded-xl hover:bg-white/90 cursor-pointer transition-colors whitespace-nowrap">
              <i className="ri-download-line"></i>Baixar Certificado
            </button>
          </div>
        )}

        {/* Admin tabs */}
        {isEditor && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {([
              { id: 'modules',  label: 'Módulos',   icon: 'ri-stack-line' },
              { id: 'progress', label: 'Progresso', icon: 'ri-bar-chart-line' },
              { id: 'preview',  label: 'Visualizar',icon: 'ri-eye-line' },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setAdminTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer
                  ${adminTab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                <i className={`${t.icon} text-sm`}></i>{t.label}
              </button>
            ))}
          </div>
        )}

        {/* Painel de progresso */}
        {isEditor && adminTab === 'progress' && (
          <ProgressPanel modules={modules} />
        )}

        {/* Grid de módulos */}
        {(!isEditor || adminTab === 'modules' || adminTab === 'preview') && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : displayModules.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <i className="ri-book-open-line text-3xl text-gray-300"></i>
                </div>
                <p className="text-sm font-medium text-gray-500">Nenhum módulo disponível</p>
                {isEditor && <p className="text-xs text-gray-400 mt-1">Crie o primeiro módulo para começar</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayModules.map(m => {
                  const total = lessonCounts[m.id] || 0;
                  const prog  = getModuleProgress(m.id, total);
                  const isDone = prog.pct === 100 && total > 0;

                  return (
                    <div key={m.id}
                      onClick={() => navigate(`/biblia/${m.id}`)}
                      className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-all cursor-pointer group">
                      {/* Capa */}
                      <div className="relative h-36 overflow-hidden" style={{ backgroundColor: `${m.color}15` }}>
                        {m.cover_image_url
                          ? <img src={m.cover_image_url} alt={m.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <i className={`${m.icon} text-5xl opacity-30`} style={{ color: m.color }}></i>
                            </div>}
                        {/* Badges */}
                        <div className="absolute top-2 right-2 flex gap-1.5">
                          {!m.is_published && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-gray-900/70 text-white rounded-full">Rascunho</span>
                          )}
                          {isDone && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 bg-emerald-500/90 text-white rounded-full flex items-center gap-1">
                              <i className="ri-graduation-cap-line text-[10px]"></i>Concluído
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Conteúdo */}
                      <div className="p-4">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: `${m.color}20` }}>
                            <i className={`${m.icon} text-sm`} style={{ color: m.color }}></i>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{m.title}</p>
                            {m.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.description}</p>}
                          </div>
                        </div>

                        {/* Progresso */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-gray-500">{prog.completed} de {total} aulas</span>
                            <span className="text-[11px] font-semibold text-gray-700">{prog.pct}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${prog.pct}%`, backgroundColor: isDone ? '#10b981' : m.color }} />
                          </div>
                        </div>
                      </div>

                      {/* Ações admin */}
                      {isEditor && adminTab === 'modules' && (
                        <div className="px-4 pb-3 pt-0 flex items-center gap-1 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-all"
                          onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setEditingModule(m); setShowModuleForm(true); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-[#004aad] hover:bg-[#004aad]/5 rounded-lg cursor-pointer transition-colors">
                            <i className="ri-edit-line text-xs"></i>Editar
                          </button>
                          <button onClick={() => setDeletingId(m.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors ml-auto">
                            <i className="ri-delete-bin-line text-xs"></i>Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <ModuleFormModal
        isOpen={showModuleForm}
        onClose={() => { setShowModuleForm(false); setEditingModule(null); }}
        onSaved={loadModules}
        editing={editingModule}
      />

      {showCertificate && (
        <CertificateView modules={visibleModules} onClose={() => setShowCertificate(false)} />
      )}

      {/* Delete confirm */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-rose-50 rounded-xl flex items-center justify-center">
                <i className="ri-delete-bin-line text-rose-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Excluir módulo</p>
                <p className="text-xs text-gray-500">Todas as aulas e progressos serão apagados</p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setDeletingId(null)} className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer transition-colors">Cancelar</button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer transition-colors disabled:opacity-50">
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
