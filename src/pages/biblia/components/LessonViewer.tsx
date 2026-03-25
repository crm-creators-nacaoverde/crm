import { useEffect, useRef, useState } from 'react';
import VideoPlayer from './VideoPlayer';
import { BibleLesson } from '../../../hooks/useBiblia';

interface Props {
  lesson: BibleLesson & { is_completed: boolean };
  onCompleted: () => void;
}

// ─── Viewer de PDF inline ─────────────────────────────────────────────────────
function PdfViewer({ url, onCompleted, isCompleted }: { url: string; onCompleted: () => void; isCompleted: boolean }) {
  return (
    <div className="space-y-3">
      <div className="w-full rounded-xl overflow-hidden border border-gray-200" style={{ height: '70vh' }}>
        <iframe src={url} className="w-full h-full" title="PDF" />
      </div>
      {!isCompleted && (
        <div className="flex justify-center">
          <button onClick={onCompleted}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#004aad] text-white text-sm font-semibold rounded-xl hover:bg-[#003d91] cursor-pointer transition-colors">
            <i className="ri-checkbox-circle-line"></i>Marcar como concluído
          </button>
        </div>
      )}
      {isCompleted && (
        <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm font-medium">
          <i className="ri-check-line"></i>Aula concluída
        </div>
      )}
    </div>
  );
}

// ─── Viewer de Documento (download) ──────────────────────────────────────────
function DocViewer({ url, fileName, onCompleted, isCompleted }: {
  url: string; fileName: string | null; onCompleted: () => void; isCompleted: boolean;
}) {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = url; a.download = fileName || 'documento'; a.target = '_blank';
    a.click();
    setDownloaded(true);
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-5">
      <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center">
        <i className="ri-file-word-line text-4xl text-blue-600"></i>
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-gray-800">{fileName || 'Documento'}</p>
        <p className="text-sm text-gray-500 mt-1">Faça o download para visualizar este arquivo</p>
      </div>
      <button onClick={handleDownload}
        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 cursor-pointer transition-colors">
        <i className="ri-download-line"></i>Baixar documento
      </button>
      {(downloaded || isCompleted) && !isCompleted && (
        <button onClick={onCompleted}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#004aad] text-white text-sm font-semibold rounded-xl hover:bg-[#003d91] cursor-pointer transition-colors">
          <i className="ri-checkbox-circle-line"></i>Marcar como concluído
        </button>
      )}
      {isCompleted && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
          <i className="ri-check-line"></i>Aula concluída
        </div>
      )}
    </div>
  );
}

// ─── Viewer de Imagem ─────────────────────────────────────────────────────────
function ImageViewer({ url, onCompleted, isCompleted }: {
  url: string; onCompleted: () => void; isCompleted: boolean;
}) {
  useEffect(() => {
    // Marca ao abrir
    if (!isCompleted) {
      const t = setTimeout(() => onCompleted(), 1500);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center" style={{ minHeight: '40vh' }}>
        <img src={url} alt="Conteúdo da aula" className="max-w-full max-h-[70vh] object-contain" />
      </div>
      {isCompleted && (
        <div className="flex items-center justify-center gap-2 text-emerald-600 text-sm font-medium">
          <i className="ri-check-line"></i>Aula concluída
        </div>
      )}
    </div>
  );
}

// ─── Viewer de Artigo com IntersectionObserver ────────────────────────────────
function ArticleViewer({ body, onCompleted, isCompleted }: {
  body: string; onCompleted: () => void; isCompleted: boolean;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(isCompleted);

  useEffect(() => {
    completedRef.current = isCompleted;
  }, [isCompleted]);

  useEffect(() => {
    if (!endRef.current || completedRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !completedRef.current) {
          completedRef.current = true;
          onCompleted();
        }
      },
      { threshold: 1.0 }
    );
    obs.observe(endRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="prose prose-sm max-w-none">
      <div
        className="text-gray-700 leading-relaxed space-y-4"
        dangerouslySetInnerHTML={{ __html: body }}
      />
      <div ref={endRef} className="h-4" />
      {isCompleted && (
        <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium mt-4 pt-4 border-t border-gray-100">
          <i className="ri-check-line"></i>Artigo lido — aula concluída
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function LessonViewer({ lesson, onCompleted }: Props) {
  const isCompleted = lesson.is_completed;

  if (lesson.content_type === 'video') {
    const provider = lesson.video_provider;
    if (!lesson.video_url || !provider) {
      return (
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl text-gray-400 text-sm">
          <i className="ri-video-off-line text-2xl mr-2"></i>Nenhum vídeo configurado
        </div>
      );
    }
    return (
      <VideoPlayer
        videoUrl={lesson.video_url}
        provider={provider}
        onCompleted={onCompleted}
        alreadyCompleted={isCompleted}
      />
    );
  }

  if (lesson.content_type === 'pdf' && lesson.file_url) {
    return <PdfViewer url={lesson.file_url} onCompleted={onCompleted} isCompleted={isCompleted} />;
  }

  if (lesson.content_type === 'doc' && lesson.file_url) {
    return <DocViewer url={lesson.file_url} fileName={lesson.file_name} onCompleted={onCompleted} isCompleted={isCompleted} />;
  }

  if (lesson.content_type === 'image' && lesson.file_url) {
    return <ImageViewer url={lesson.file_url} onCompleted={onCompleted} isCompleted={isCompleted} />;
  }

  if (lesson.content_type === 'article' && lesson.article_body) {
    return <ArticleViewer body={lesson.article_body} onCompleted={onCompleted} isCompleted={isCompleted} />;
  }

  return (
    <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl text-gray-400 text-sm">
      <i className="ri-file-unknow-line text-2xl mr-2"></i>Conteúdo não disponível
    </div>
  );
}
