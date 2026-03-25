import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { BibleModule } from '../../../hooks/useBiblia';

interface Props {
  modules: BibleModule[];
}

interface UserProgress {
  userId: string;
  userName: string;
  role: string;
  completedByModule: Record<string, number>;
  totalByModule: Record<string, number>;
}

export default function ProgressPanel({ modules }: Props) {
  const [view, setView] = useState<'consolidated' | 'individual'>('consolidated');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');

  const ROLE_LABEL: Record<string, string> = { admin: 'Admin', manager: 'Gerente', operator: 'Operador', viewer: 'Visualizador' };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [usersRes, progressRes, lessonsRes] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
        supabase.from('bible_progress').select('*').eq('completed', true),
        supabase.from('bible_lessons').select('id, module_id').eq('is_published', true),
      ]);

      const users = usersRes.data || [];
      const allProgress = progressRes.data || [];
      const allLessons = lessonsRes.data || [];

      // Contar aulas por módulo
      const counts: Record<string, number> = {};
      allLessons.forEach(l => { counts[l.module_id] = (counts[l.module_id] || 0) + 1; });
      setLessonCounts(counts);

      // Construir progresso por usuário
      const up: UserProgress[] = users.map(u => {
        const userProg = allProgress.filter(p => p.user_id === u.id);
        const completedByModule: Record<string, number> = {};
        userProg.forEach(p => {
          completedByModule[p.module_id] = (completedByModule[p.module_id] || 0) + 1;
        });
        return { userId: u.id, userName: u.full_name, role: u.role, completedByModule, totalByModule: counts };
      });
      setUserProgress(up);
      setLoading(false);
    };
    load();
  }, []);

  const publishedModules = modules.filter(m => m.is_published);
  const filteredModules = moduleFilter === 'all' ? publishedModules : publishedModules.filter(m => m.id === moduleFilter);

  const getModulePct = (up: UserProgress, moduleId: string) => {
    const total = lessonCounts[moduleId] || 0;
    const done  = up.completedByModule[moduleId] || 0;
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  const getAvgPct = (moduleId: string) => {
    if (userProgress.length === 0) return 0;
    const total = userProgress.reduce((s, u) => s + getModulePct(u, moduleId), 0);
    return Math.round(total / userProgress.length);
  };

  const selectedUser = userProgress.find(u => u.userId === selectedUserId);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#5de0e6] border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: 'consolidated', label: 'Visão Geral', icon: 'ri-bar-chart-grouped-line' },
          { id: 'individual',   label: 'Individual',  icon: 'ri-user-line' },
        ].map(t => (
          <button key={t.id} onClick={() => setView(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer
              ${view === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <i className={`${t.icon} text-sm`}></i>{t.label}
          </button>
        ))}
      </div>

      {/* Filtro de módulo */}
      <select value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
        className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none bg-white cursor-pointer appearance-none">
        <option value="all">Todos os módulos</option>
        {publishedModules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>

      {/* ── Visão consolidada ─────────────────────────────────────────────── */}
      {view === 'consolidated' && (
        <div className="space-y-3">
          {filteredModules.map(m => {
            const avg = getAvgPct(m.id);
            const total = lessonCounts[m.id] || 0;
            return (
              <div key={m.id} className="bg-white border border-gray-100 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${m.color}20` }}>
                    <i className={`${m.icon} text-sm`} style={{ color: m.color }}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{m.title}</p>
                    <p className="text-[11px] text-gray-400">{total} aulas publicadas</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700">{avg}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${avg}%`, backgroundColor: m.color }} />
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Média de conclusão — {userProgress.length} usuários</p>
              </div>
            );
          })}
          {filteredModules.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-sm">Nenhum módulo publicado</div>
          )}
        </div>
      )}

      {/* ── Visão individual ──────────────────────────────────────────────── */}
      {view === 'individual' && (
        <div className="space-y-4">
          {/* Selector de usuário */}
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="w-full pl-3 pr-8 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none bg-white cursor-pointer appearance-none">
            <option value="">Selecione um usuário</option>
            {userProgress.map(u => (
              <option key={u.userId} value={u.userId}>{u.userName} — {ROLE_LABEL[u.role] || u.role}</option>
            ))}
          </select>

          {selectedUser && (
            <div className="space-y-3">
              {/* Header do usuário */}
              <div className="flex items-center gap-3 p-4 bg-[#004aad]/5 border border-[#004aad]/15 rounded-xl">
                <div className="w-10 h-10 bg-gradient-to-br from-[#5de0e6] to-[#004aad] rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{selectedUser.userName.charAt(0).toUpperCase()}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedUser.userName}</p>
                  <p className="text-[11px] text-gray-500">{ROLE_LABEL[selectedUser.role]}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-lg font-bold text-[#004aad]">
                    {filteredModules.filter(m => getModulePct(selectedUser, m.id) === 100).length}/{filteredModules.length}
                  </p>
                  <p className="text-[11px] text-gray-400">módulos concluídos</p>
                </div>
              </div>

              {/* Progresso por módulo */}
              {filteredModules.map(m => {
                const pct   = getModulePct(selectedUser, m.id);
                const done  = selectedUser.completedByModule[m.id] || 0;
                const total = lessonCounts[m.id] || 0;
                return (
                  <div key={m.id} className="bg-white border border-gray-100 rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${m.color}20` }}>
                        <i className={`${m.icon} text-xs`} style={{ color: m.color }}></i>
                      </div>
                      <p className="text-sm font-medium text-gray-800 flex-1 truncate">{m.title}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{done}/{total}</span>
                        {pct === 100
                          ? <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Concluído</span>
                          : <span className="text-xs font-bold text-gray-700">{pct}%</span>}
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#10b981' : m.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!selectedUserId && (
            <div className="text-center py-10 text-gray-400 text-sm">Selecione um usuário para ver o progresso detalhado</div>
          )}
        </div>
      )}
    </div>
  );
}
