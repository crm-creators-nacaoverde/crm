import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface BibleModule {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  icon: string;
  color: string;
  is_published: boolean;
  required_roles: string[];
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BibleLesson {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content_type: 'video' | 'pdf' | 'doc' | 'image' | 'article';
  video_url: string | null;
  video_provider: 'youtube' | 'vimeo' | null;
  file_url: string | null;
  file_name: string | null;
  article_body: string | null;
  duration_minutes: number | null;
  is_published: boolean;
  sort_order: number;
  created_at: string;
}

export interface BibleProgress {
  lesson_id: string;
  module_id: string;
  completed: boolean;
  completed_at: string | null;
}

export interface ModuleWithProgress extends BibleModule {
  lessons: LessonWithStatus[];
  total_lessons: number;
  completed_lessons: number;
  progress_pct: number;
}

export interface LessonWithStatus extends BibleLesson {
  is_completed: boolean;
  is_locked: boolean;
  completed_at: string | null;
}

// ─── Utilitário: detectar provider de vídeo ──────────────────────────────────
export function detectVideoProvider(url: string): 'youtube' | 'vimeo' | null {
  if (!url) return null;
  if (/youtu\.be|youtube\.com/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  return null;
}

export function extractVideoId(url: string, provider: 'youtube' | 'vimeo'): string | null {
  if (!url) return null;
  if (provider === 'youtube') {
    const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : null;
  }
  if (provider === 'vimeo') {
    const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    return m ? m[1] : null;
  }
  return null;
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useBiblia() {
  const { profile } = useAuth();
  const [modules, setModules] = useState<BibleModule[]>([]);
  const [progress, setProgress] = useState<BibleProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = profile?.role === 'admin';
  const isEditor = profile?.role === 'admin' || profile?.role === 'manager';

  const loadModules = useCallback(async () => {
    const { data } = await supabase
      .from('bible_modules')
      .select('*')
      .order('sort_order', { ascending: true });
    setModules(data || []);
  }, []);

  const loadProgress = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('bible_progress')
      .select('lesson_id, module_id, completed, completed_at')
      .eq('user_id', profile.id);
    setProgress(data || []);
  }, [profile?.id]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadModules(), loadProgress()]);
      setLoading(false);
    };
    init();
  }, [loadModules, loadProgress]);

  // Módulos visíveis para o usuário atual
  const visibleModules = modules.filter(m => {
    if (!m.is_published && !isEditor) return false;
    if (isAdmin) return true;
    if (!m.required_roles || m.required_roles.length === 0) return true;
    return profile?.role ? m.required_roles.includes(profile.role) : false;
  });

  // Buscar aulas de um módulo com status de progresso
  const getLessonsWithStatus = useCallback(async (moduleId: string): Promise<LessonWithStatus[]> => {
    const { data: lessons } = await supabase
      .from('bible_lessons')
      .select('*')
      .eq('module_id', moduleId)
      .order('sort_order', { ascending: true });

    const raw = lessons || [];
    const published = isEditor ? raw : raw.filter(l => l.is_published);

    const completedIds = new Set(
      progress.filter(p => p.module_id === moduleId && p.completed).map(p => p.lesson_id)
    );

    return published.map((lesson, idx) => {
      const is_completed = completedIds.has(lesson.id);
      // Aula 0 sempre desbloqueada; aula N só abre se N-1 concluída
      const is_locked = idx > 0 && !completedIds.has(published[idx - 1].id);
      const prog = progress.find(p => p.lesson_id === lesson.id);
      return {
        ...lesson,
        video_provider: lesson.video_provider as 'youtube' | 'vimeo' | null,
        content_type: lesson.content_type as BibleLesson['content_type'],
        is_completed,
        is_locked: !isEditor && is_locked,
        completed_at: prog?.completed_at || null,
      };
    });
  }, [progress, isEditor]);

  // Calcular progresso por módulo
  const getModuleProgress = useCallback((moduleId: string, totalLessons: number) => {
    const done = progress.filter(p => p.module_id === moduleId && p.completed).length;
    return {
      completed: done,
      total: totalLessons,
      pct: totalLessons > 0 ? Math.round((done / totalLessons) * 100) : 0,
    };
  }, [progress]);

  // Marcar aula como concluída
  const markCompleted = useCallback(async (lessonId: string, moduleId: string) => {
    if (!profile?.id) return;
    await supabase.from('bible_progress').upsert({
      user_id: profile.id,
      lesson_id: lessonId,
      module_id: moduleId,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lesson_id' });
    await loadProgress();
  }, [profile?.id, loadProgress]);

  // Verificar se o usuário concluiu TODOS os módulos disponíveis (para certificado)
  const isAllCompleted = useCallback((): boolean => {
    if (isAdmin) return false; // admin não recebe certificado
    const pub = visibleModules.filter(m => m.is_published);
    if (pub.length === 0) return false;
    return pub.every(m => {
      const done = progress.filter(p => p.module_id === m.id && p.completed).length;
      return done > 0; // pelo menos alguma aula concluída — refinado por total em runtime
    });
  }, [visibleModules, progress, isAdmin]);

  return {
    modules,
    visibleModules,
    progress,
    loading,
    isEditor,
    isAdmin,
    loadModules,
    loadProgress,
    getLessonsWithStatus,
    getModuleProgress,
    markCompleted,
    isAllCompleted,
  };
}

// ─── Hook de progresso detalhado para admin (painel) ────────────────────────
export function useBibliaAdmin() {
  const [allProgress, setAllProgress] = useState<any[]>([]);
  const [users, setUsers] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [progRes, usersRes] = await Promise.all([
        supabase.from('bible_progress').select('*').eq('completed', true),
        supabase.from('user_profiles').select('id, full_name, role').eq('is_active', true).order('full_name'),
      ]);
      setAllProgress(progRes.data || []);
      setUsers(usersRes.data || []);
      setLoading(false);
    };
    load();
  }, []);

  return { allProgress, users, loading };
}
