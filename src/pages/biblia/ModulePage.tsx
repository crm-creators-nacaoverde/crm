import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppLayout from '../../components/feature/AppLayout';
import { useBiblia, BibleLesson, LessonWithStatus } from '../../hooks/useBiblia';
import LessonViewer from './components/LessonViewer';
import LessonFormModal from './components/LessonFormModal';
import { supabase } from '../../lib/supabase';
import { useActivityLog } from '../../hooks/useActivityLog';

const CONTENT_ICON: Record<string, string> = {
  video: 'ri-play-circle-line', pdf: 'ri-file-pdf-line',
  doc: 'ri-file-word-line', image: 'ri-image-line', article: 'ri-article-line',
};
const CONTENT_LABEL: Record<string, string> = {
  video: 'Vídeo', pdf: 'PDF', doc: 'Documento', image: 'Imagem', article: 'Artigo',
};

export default function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { logActivity } = useActivityLog();
  const { getLessonsWithStatus, markCompleted, loadModules, isEditor, modules } = useBiblia();

  const [lessons, setLessons] = useState<LessonWithStatus[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<LessonWithStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<BibleLesson | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);

  const module = modules.find(m => m.id === moduleId);

  const loadLessons = useCallback(async () => {
    if (!moduleId) return;
    setLoading(true);
    const data = await getLessonsWithStatus(moduleId);
    setLessons(data);
    // Selecionar a primeira disponível (não bloqueada e não concluída), ou a última concluída
    const firstAvailable = data.find(l => !l.is_locked && !l.is_completed) || data.find(l => !l.is_locked) || data[0] || null;
    setSelectedLesson(prev => prev ? (data.find(l => l.id === prev.id) || firstAvailable) : firstAvailable);
    setLoading(false);
  }, [moduleId, getLessonsWithStatus]);

  useEffect(() => { loadLessons(); }, [loadLessons]);

  const handleCompleted = async (lesson: LessonWithStatus) => {
    if (lesson.is_completed || !moduleId) return;
    await markCompleted(lesson.id, moduleId);
    await logActivity({ action: 'update', module: 'bible' as any, entityId: lesson.id, entityName: lesson.title, details: { moduleId, completed: true } });
    await loadLessons();
  };

  const handleDeleteLesson = async () => {
    if (!deletingLessonId) return;
    await supabase.from('bible_lessons').delete().eq('id', deletingLessonId);
    setDeletingLessonId(null);
    await loadLessons();
  };

  const completedCount = lessons.filter(l => l.is_completed).length;
  const totalCount     = lessons.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-5">
        <button onClick={() => navigate('/biblia')} className="hover:text-[#004aad] cursor-pointer transition-colors flex items-center gap-1">
          <i className="ri-book-open-line text-sm"></i>Bíblia Comercial
        </button>
        <i className="ri-arrow-right-s-line text-gray-400"></i>
        <span className="text-gray-900 font-medium truncate">{module?.title || 'Módulo'}</span>
      </div>

      {/* Header do módulo */}
      {module && (
        <div className="flex items-start gap-4 mb-5 p-4 bg-white border border-gray-100 rounded-2xl">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${module.color}20` }}>
            <i className={`${module.icon} text-2xl`} style={{ color: module.color }}></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-base font-bold text-gray-900">{module.title}</p>
              {!module.is_published && <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Rascunho</span>}
            </div>
            {module.description && <p className="text-xs text-gray-500 mb-2">{module.description}</p>}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-xs">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : module.color }} />
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{completedCount}/{totalCount} aulas</span>
            </div>
          </div>
          {isEditor && (
            <button onClick={() => { setEditingLesson(null); setShowLessonForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors whitespace-nowrap flex-shrink-0">
              <i className="ri-add-line"></i>Nova aula
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="flex gap-5" style={{ minHeight: 'calc(100vh - 300px)' }}>
          {/* ── Lista lateral de aulas ── */}
          <div className="w-72 flex-shrink-0 space-y-1.5">
            {lessons.map((lesson, idx) => {
              const isSelected = selectedLesson?.id === lesson.id;
              return (
                <div key={lesson.id}
                  onClick={() => !lesson.is_locked && setSelectedLesson(lesson)}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all group
                    ${lesson.is_locked ? 'opacity-50 cursor-not-allowed border-gray-100 bg-gray-50' :
                      isSelected ? 'border-[#004aad]/40 bg-[#004aad]/5 cursor-pointer' :
                      'border-gray-100 bg-white hover:border-gray-200 cursor-pointer'}`}>
                  {/* Status icon */}
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
                    ${lesson.is_completed ? 'bg-emerald-100' : lesson.is_locked ? 'bg-gray-100' : isSelected ? 'bg-[#004aad]/10' : 'bg-gray-100'}`}>
                    {lesson.is_locked
                      ? <i className="ri-lock-line text-xs text-gray-400"></i>
                      : lesson.is_completed
                        ? <i className="ri-check-line text-xs text-emerald-600"></i>
                        : <i className={`${CONTENT_ICON[lesson.content_type]} text-xs ${isSelected ? 'text-[#004aad]' : 'text-gray-500'}`}></i>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${isSelected ? 'text-[#004aad]' : 'text-gray-800'}`}>{lesson.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-gray-400">{CONTENT_LABEL[lesson.content_type]}</span>
                      {lesson.duration_minutes && <span className="text-[10px] text-gray-300">· {lesson.duration_minutes}min</span>}
                    </div>
                  </div>
                  {/* Admin actions */}
                  {isEditor && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-all" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditingLesson(lesson); setShowLessonForm(true); }}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-[#004aad] hover:bg-[#004aad]/5 rounded-md cursor-pointer transition-all">
                        <i className="ri-edit-line text-xs"></i>
                      </button>
                      <button onClick={() => setDeletingLessonId(lesson.id)}
                        className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer transition-all">
                        <i className="ri-delete-bin-line text-xs"></i>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {lessons.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-xs">
                {isEditor ? 'Nenhuma aula ainda. Clique em "Nova aula".' : 'Nenhuma aula disponível.'}
              </div>
            )}
          </div>

          {/* ── Viewer principal ── */}
          <div className="flex-1 min-w-0">
            {selectedLesson ? (
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                {/* Header da aula */}
                <div className="flex items-start justify-between mb-4 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
                        ${selectedLesson.is_completed ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {selectedLesson.is_completed ? '✓ Concluída' : CONTENT_LABEL[selectedLesson.content_type]}
                      </span>
                      {!selectedLesson.is_published && <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Rascunho</span>}
                    </div>
                    <h2 className="text-base font-bold text-gray-900">{selectedLesson.title}</h2>
                    {selectedLesson.description && <p className="text-xs text-gray-500 mt-1">{selectedLesson.description}</p>}
                  </div>
                  {selectedLesson.duration_minutes && (
                    <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                      <i className="ri-time-line"></i>{selectedLesson.duration_minutes}min
                    </span>
                  )}
                </div>

                {/* Viewer */}
                <LessonViewer
                  lesson={selectedLesson}
                  onCompleted={() => handleCompleted(selectedLesson)}
                />

                {/* Navegação */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => {
                      const idx = lessons.findIndex(l => l.id === selectedLesson.id);
                      if (idx > 0) setSelectedLesson(lessons[idx - 1]);
                    }}
                    disabled={lessons.findIndex(l => l.id === selectedLesson.id) === 0}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <i className="ri-arrow-left-line"></i>Anterior
                  </button>
                  <span className="text-xs text-gray-400">
                    {lessons.findIndex(l => l.id === selectedLesson.id) + 1} / {lessons.length}
                  </span>
                  <button
                    onClick={() => {
                      const idx = lessons.findIndex(l => l.id === selectedLesson.id);
                      const next = lessons[idx + 1];
                      if (next && !next.is_locked) setSelectedLesson(next);
                    }}
                    disabled={(() => {
                      const idx = lessons.findIndex(l => l.id === selectedLesson.id);
                      const next = lessons[idx + 1];
                      return !next || next.is_locked;
                    })()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-[#004aad] hover:bg-[#003d91] rounded-xl cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    Próxima<i className="ri-arrow-right-line"></i>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-white border border-gray-100 rounded-2xl py-20 gap-3">
                <i className="ri-play-circle-line text-4xl text-gray-300"></i>
                <p className="text-sm text-gray-500">Selecione uma aula para começar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {moduleId && (
        <LessonFormModal
          isOpen={showLessonForm}
          onClose={() => { setShowLessonForm(false); setEditingLesson(null); }}
          onSaved={loadLessons}
          moduleId={moduleId}
          editing={editingLesson}
          nextSortOrder={lessons.length}
        />
      )}

      {/* Delete aula */}
      {deletingLessonId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <p className="text-sm font-bold text-gray-900 mb-2">Excluir aula</p>
            <p className="text-xs text-gray-500 mb-4">O progresso dos usuários nesta aula também será removido.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeletingLessonId(null)} className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl cursor-pointer">Cancelar</button>
              <button onClick={handleDeleteLesson} className="flex-1 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
