import { useState, useRef, useEffect } from 'react';

interface Props {
  onAudioRecorded: (blob: Blob, duration: number) => void;
  isLoading?: boolean;
}

export default function AudioRecorder({ onAudioRecorded, isLoading = false }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Tentar formatos mais universais primeiro (mp4/aac)
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/mpeg')) {
        mimeType = 'audio/mpeg';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        onAudioRecorded(blob, duration);
        setDuration(0);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      // Timer
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao acessar microfone:', error);
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-lg">
          <div className="w-2 h-2 bg-rose-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium text-rose-600">{formatTime(duration)}</span>
        </div>
      )}

      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isLoading}
        className={`w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer transition-colors flex-shrink-0 ${
          isRecording
            ? 'bg-rose-500 hover:bg-rose-600 text-white'
            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title={isRecording ? 'Parar gravação' : 'Iniciar gravação'}
      >
        <i className={`text-sm ${isRecording ? 'ri-stop-circle-fill' : 'ri-mic-line'}`}></i>
      </button>
    </div>
  );
}
