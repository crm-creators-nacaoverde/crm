import { useEffect, useRef, useState } from 'react';
import { extractVideoId } from '../../../hooks/useBiblia';

interface Props {
  videoUrl: string;
  provider: 'youtube' | 'vimeo';
  onCompleted: () => void;
  alreadyCompleted?: boolean;
}

// ─── Declarações globais para as SDKs ────────────────────────────────────────
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    Vimeo: any;
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

// ─── YouTube Player ───────────────────────────────────────────────────────────
function YouTubePlayer({ videoId, onCompleted, alreadyCompleted }: {
  videoId: string; onCompleted: () => void; alreadyCompleted?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const completedRef = useRef(alreadyCompleted || false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    completedRef.current = alreadyCompleted || false;
  }, [alreadyCompleted]);

  useEffect(() => {
    let mounted = true;

    const initPlayer = () => {
      if (!containerRef.current || !mounted) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (e: any) => {
            // Estado 1 = playing
            if (e.data === 1) {
              intervalRef.current = setInterval(() => {
                if (!playerRef.current || completedRef.current) return;
                const duration = playerRef.current.getDuration?.() || 0;
                const current  = playerRef.current.getCurrentTime?.() || 0;
                if (duration > 0 && current >= duration - 3) {
                  completedRef.current = true;
                  onCompleted();
                  if (intervalRef.current) clearInterval(intervalRef.current);
                }
              }, 1000);
            } else {
              if (intervalRef.current) clearInterval(intervalRef.current);
            }
          },
        },
      });
    };

    const load = async () => {
      if (!window.YT?.Player) {
        // Primeira carga: setar callback antes do script
        window.onYouTubeIframeAPIReady = initPlayer;
        try { await loadScript('https://www.youtube.com/iframe_api'); } catch { /* silent */ }
      } else {
        initPlayer();
      }
    };

    load();

    return () => {
      mounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy?.();
    };
  }, [videoId]);

  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full rounded-xl overflow-hidden" />
    </div>
  );
}

// ─── Vimeo Player ─────────────────────────────────────────────────────────────
function VimeoPlayer({ videoId, onCompleted, alreadyCompleted }: {
  videoId: string; onCompleted: () => void; alreadyCompleted?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(alreadyCompleted || false);

  useEffect(() => {
    completedRef.current = alreadyCompleted || false;
  }, [alreadyCompleted]);

  useEffect(() => {
    let player: any = null;
    let mounted = true;

    const init = async () => {
      try {
        await loadScript('https://player.vimeo.com/api/player.js');
        if (!containerRef.current || !mounted) return;
        player = new window.Vimeo.Player(containerRef.current, {
          id: videoId,
          responsive: true,
          dnt: true,
        });

        player.getDuration().then((duration: number) => {
          player.on('timeupdate', (data: { seconds: number }) => {
            if (completedRef.current) return;
            if (duration > 0 && data.seconds >= duration - 3) {
              completedRef.current = true;
              onCompleted();
            }
          });
        });
      } catch { /* silent */ }
    };

    init();

    return () => {
      mounted = false;
      player?.destroy?.();
    };
  }, [videoId]);

  return (
    <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
      <div ref={containerRef} className="absolute inset-0 w-full h-full rounded-xl overflow-hidden" />
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function VideoPlayer({ videoUrl, provider, onCompleted, alreadyCompleted }: Props) {
  const [error, setError] = useState(false);
  const videoId = extractVideoId(videoUrl, provider);

  if (!videoId) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-100 rounded-xl text-gray-500 text-sm">
        <i className="ri-error-warning-line text-2xl mr-2"></i>URL de vídeo inválida
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 bg-gray-100 rounded-xl gap-3">
        <i className="ri-video-off-line text-3xl text-gray-400"></i>
        <p className="text-sm text-gray-500">Não foi possível carregar o vídeo</p>
        <a href={videoUrl} target="_blank" rel="noopener noreferrer"
          className="text-xs text-[#004aad] hover:underline">Abrir no {provider === 'youtube' ? 'YouTube' : 'Vimeo'}</a>
      </div>
    );
  }

  return (
    <div className="relative">
      {provider === 'youtube'
        ? <YouTubePlayer videoId={videoId} onCompleted={onCompleted} alreadyCompleted={alreadyCompleted} />
        : <VimeoPlayer   videoId={videoId} onCompleted={onCompleted} alreadyCompleted={alreadyCompleted} />
      }
      {alreadyCompleted && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-emerald-500/90 text-white text-xs font-semibold px-2.5 py-1 rounded-full pointer-events-none">
          <i className="ri-check-line text-xs"></i>Concluído
        </div>
      )}
    </div>
  );
}
