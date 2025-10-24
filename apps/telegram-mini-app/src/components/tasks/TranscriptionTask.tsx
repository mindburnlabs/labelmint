import React, { useState, useEffect, useRef } from 'react';
import Tesseract from 'tesseract.js';
import { Button, Card, Typography, Textarea, Progress } from '@telegram-apps/telegram-ui';
import { Mic, MicOff, Volume2 } from '@telegram-apps/telegram-ui/icons/functional';

interface TranscriptionTaskProps {
  mediaUrl: string;
  mediaType: 'image' | 'audio';
  instructions?: string;
  expectedLanguage?: string;
  timeLimit?: number;
  onSubmit: (transcription: string, confidence?: number) => void;
  onSkip: () => void;
}

export const TranscriptionTask: React.FC<TranscriptionTaskProps> = ({
  mediaUrl,
  mediaType,
  instructions,
  expectedLanguage = 'eng',
  timeLimit = 300,
  onSubmit,
  onSkip
}) => {
  const [transcription, setTranscription] = useState('');
  const [ocrResult, setOcrResult] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [timeLeft, setTimeLeft] = useState(timeLimit);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          onSkip();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onSkip]);

  // Load media
  useEffect(() => {
    if (mediaType === 'image') {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
          }
        }
      };
      img.src = mediaUrl;
    } else if (mediaType === 'audio') {
      // For audio, we'll use the URL directly
      setAudioUrl(mediaUrl);
    }
  }, [mediaUrl, mediaUrl]);

  const performOCR = async () => {
    if (!imageRef.current) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(
        canvasRef.current!,
        expectedLanguage,
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          }
        }
      );

      setOcrResult(result.data.text);
      setConfidence(result.data.confidence);
    } catch (error) {
      console.error('OCR Error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = () => {
    const finalText = transcription.trim() || ocrResult.trim();
    if (finalText) {
      onSubmit(finalText, confidence || undefined);
    }
  };

  const copyOcrResult = () => {
    setTranscription(ocrResult);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <Typography weight="2">
            Transcribe the {mediaType === 'image' ? 'text from image' : 'audio content'}
          </Typography>
          <div className={`text-lg font-bold ${timeLeft < 30 ? 'text-red-500' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {instructions && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <Typography variant="caption" color="secondary">
              {instructions}
            </Typography>
          </div>
        )}
      </Card>

      {/* Media Display */}
      <Card className="flex-1 p-4 overflow-auto">
        {mediaType === 'image' ? (
          <div className="space-y-4">
            <div className="relative">
              <img
                ref={imageRef}
                src={mediaUrl}
                alt="To transcribe"
                className="w-full max-w-full h-auto rounded-lg"
                style={{ maxHeight: '400px', objectFit: 'contain' }}
              />
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* OCR Controls */}
            <div className="flex gap-2">
              <Button
                onClick={performOCR}
                disabled={isProcessing}
                mode="outline"
                className="flex-1"
              >
                {isProcessing ? 'Processing...' : 'Auto-detect Text (OCR)'}
              </Button>
            </div>

            {isProcessing && (
              <div className="space-y-2">
                <Progress value={progress} />
                <Typography variant="caption" className="text-center">
                  Recognizing text... {progress}%
                </Typography>
              </div>
            )}

            {ocrResult && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Typography weight="3">Detected Text</Typography>
                  <div className="flex gap-2">
                    <Typography variant="caption" color="secondary">
                      Confidence: {Math.round(confidence)}%
                    </Typography>
                    <Button size="s" mode="outline" onClick={copyOcrResult}>
                      Use This
                    </Button>
                  </div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <Typography variant="caption">
                    {ocrResult}
                  </Typography>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Audio Player */}
            {audioUrl && (
              <audio
                ref={audioRef}
                controls
                src={audioUrl}
                className="w-full"
              />
            )}

            {/* Recording Controls */}
            {!audioUrl && (
              <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
                  {isRecording ? <MicOff className="text-white" /> : <Mic className="text-white" />}
                </div>

                {isRecording ? (
                  <div className="text-center">
                    <Typography weight="3" className="text-red-500">
                      Recording... {formatTime(recordingTime)}
                    </Typography>
                    <Button
                      onClick={stopRecording}
                      mode="destructive"
                      className="mt-2"
                    >
                      Stop Recording
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Typography>
                      Click to record audio transcription
                    </Typography>
                    <Button onClick={startRecording} mode="outline" className="mt-2">
                      Start Recording
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Transcription Input */}
        <div className="mt-6 space-y-2">
          <Typography weight="3">Your Transcription</Typography>
          <Textarea
            value={transcription}
            onChange={e => setTranscription(e.target.value)}
            placeholder="Type or paste the transcription here..."
            className="min-h-[150px]"
          />
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-4">
        <div className="flex gap-2 justify-between">
          <Typography variant="caption" color="secondary">
            {mediaType === 'image' ? (
              <>
                💡 Tip: Use OCR to auto-detect text, then correct any errors
              </>
            ) : (
              <>
                💡 Tip: You can record your own audio or use the provided audio file
              </>
            )}
          </Typography>
          <div className="flex gap-2">
            <Button mode="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!transcription.trim() && !ocrResult.trim()}
            >
              Submit
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};