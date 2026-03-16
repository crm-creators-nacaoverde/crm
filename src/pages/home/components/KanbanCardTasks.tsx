
import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';

interface TaskBadgeProps {
  dealId: string;
}

interface TaskCount {
  total: number;
  completed: number;
}

export default function KanbanCardTasks({ dealId }: TaskBadgeProps) {
  const [counts, setCounts] = useState<TaskCount>({ total: 0, completed: 0 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data, error: supabaseError } = await supabase
          .from('deal_tasks')
          .select('is_completed')
          .eq('deal_id', dealId);

        if (supabaseError) {
          throw supabaseError;
        }

        if (!cancelled && data) {
          const total = data.length;
          const completed = data.filter((t: { is_completed: boolean }) => t.is_completed).length;

          setCounts({ total, completed });
          setLoaded(true);
        }
      } catch (err) {
        // Capture and log the error for debugging while keeping UI silent
        console.error('Failed to load task counts:', err);
        if (!cancelled) {
          setError('Unable to load task information.');
          setLoaded(true); // Mark as loaded to avoid endless spinner
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [dealId]);

  // If still loading, render nothing (or a loader if preferred)
  if (!loaded) return null;

  // If an error occurred, you could render a fallback UI; here we simply hide the badge
  if (error) return null;

  // If there are no tasks, nothing to display
  if (counts.total === 0) return null;

  const allDone = counts.completed === counts.total;
  const badgeClasses = allDone
    ? 'bg-emerald-50 text-emerald-600'
    : 'bg-amber-50 text-amber-600';
  const iconClass = allDone ? 'ri-checkbox-circle-fill' : 'ri-task-line';

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${badgeClasses}`}
      >
        <i className={`${iconClass} text-[10px]`}></i>
        {counts.completed}/{counts.total}
      </div>
    </div>
  );
}
