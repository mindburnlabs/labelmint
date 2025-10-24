'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Check, X, AlertCircle, Square, Maximize2 } from 'lucide-react';

interface BBoxTaskProps {
  task: {
    id: string;
    type: 'BBOX';
    dataUrl: string;
    payload: {
      imageUrl: string;
      imageWidth?: number;
      imageHeight?: number;
      instructions?: string;
    };
    classes: string[];
  };
  onAnswer: (answer: any) => void;
  onSkip: () => void;
  expiresAt: string;
}

interface BBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  class: string;
}

export default function BBoxTask({ task, onAnswer, onSkip, expiresAt }: BBoxTaskProps) {
  const [bboxes, setBboxes] = useState<BBox[]>([]);
  const [selectedClass, setSelectedClass] = useState(task.classes[0] || '');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Partial<BBox> | null>(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);

      if (diff === 0) {
        onSkip();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt, onSkip]);

  const handleImageLoad = () => {
    if (imageRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
    }
  };

  const getMousePos = (e: React.MouseEvent) => {
    if (!imageRef.current) return { x: 0, y: 0 };
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = imageSize.width / rect.width;
    const scaleY = imageSize.height / rect.height;
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedClass) return;
    const pos = getMousePos(e);
    setIsDrawing(true);
    setStartPoint(pos);
    setCurrentBox({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      class: selectedClass,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !currentBox) return;
    const pos = getMousePos(e);
    setCurrentBox({
      ...currentBox,
      width: Math.abs(pos.x - startPoint.x),
      height: Math.abs(pos.y - startPoint.y),
      x: Math.min(pos.x, startPoint.x),
      y: Math.min(pos.y, startPoint.y),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentBox) return;

    if (currentBox.width && currentBox.height && currentBox.width > 10 && currentBox.height > 10) {
      const newBox: BBox = {
        id: Date.now().toString(),
        x: currentBox.x!,
        y: currentBox.y!,
        width: currentBox.width,
        height: currentBox.height,
        class: currentBox.class!,
      };
      setBboxes([...bboxes, newBox]);
    }

    setIsDrawing(false);
    setCurrentBox(null);
  };

  const removeBbox = (id: string) => {
    setBboxes(bboxes.filter(box => box.id !== id));
  };

  const handleSubmit = () => {
    onAnswer({
      bboxes: bboxes.map(box => ({
        x: box.x / imageSize.width,
        y: box.y / imageSize.height,
        width: box.width / imageSize.width,
        height: box.height / imageSize.height,
        class: box.class,
      })),
    });
  };

  const getScaledBoxStyle = (box: Partial<BBox>) => {
    if (!imageRef.current || imageSize.width === 0) return {};
    const rect = imageRef.current.getBoundingClientRect();
    const scaleX = rect.width / imageSize.width;
    const scaleY = rect.height / imageSize.height;

    return {
      left: `${(box.x! / imageSize.width) * 100}%`,
      top: `${(box.y! / imageSize.height) * 100}%`,
      width: `${(box.width! / imageSize.width) * 100}%`,
      height: `${(box.height! / imageSize.height) * 100}%`,
    };
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-purple-500 text-white px-4 py-2 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Square className="h-4 w-4" />
          <span className="text-sm font-medium">Bounding Box Annotation</span>
        </div>
        <div className="flex items-center gap-2">
          {timeLeft <= 10 && (
            <AlertCircle className="h-4 w-4 animate-pulse" />
          )}
          <span className={`font-mono font-bold ${timeLeft <= 10 ? 'text-red-200' : ''}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Instructions */}
      {task.payload.instructions && (
        <div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 text-sm text-blue-700 dark:text-blue-300">
          {task.payload.instructions}
        </div>
      )}

      {/* Class Selector */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Selected Label:
          </span>
          <div className="flex gap-2">
            {task.classes.map(cls => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedClass === cls
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Image Area */}
      <div className="flex-1 overflow-auto p-4">
        <div
          ref={containerRef}
          className="relative inline-block"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            ref={imageRef}
            src={task.payload.imageUrl}
            alt="Annotation target"
            onLoad={handleImageLoad}
            className="max-w-full h-auto cursor-crosshair"
            draggable={false}
          />

          {/* Existing Boxes */}
          {bboxes.map(box => (
            <div
              key={box.id}
              className="absolute border-2 bg-purple-500/10"
              style={{
                ...getScaledBoxStyle(box),
                borderColor: task.classes.indexOf(box.class) % 2 === 0 ? '#8b5cf6' : '#ec4899',
              }}
            >
              <span
                className="absolute -top-6 left-0 text-xs px-2 py-0.5 rounded font-medium text-white"
                style={{
                  backgroundColor: task.classes.indexOf(box.class) % 2 === 0 ? '#8b5cf6' : '#ec4899',
                }}
              >
                {box.class}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeBbox(box.id);
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          {/* Current Drawing Box */}
          {isDrawing && currentBox && (
            <div
              className="absolute border-2 border-purple-500 bg-purple-500/10 pointer-events-none"
              style={getScaledBoxStyle(currentBox)}
            >
              <span className="absolute -top-6 left-0 text-xs px-2 py-0.5 rounded font-medium text-white bg-purple-500">
                {currentBox.class}
              </span>
            </div>
          )}
        </div>

        {/* Box Count */}
        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          {bboxes.length} box{bboxes.length !== 1 ? 'es' : ''} annotated
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white dark:bg-gray-800 border-t dark:border-gray-700 p-4 flex gap-3">
        <button
          onClick={onSkip}
          className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          <X className="h-4 w-4" />
          Skip
        </button>
        <button
          onClick={handleSubmit}
          disabled={bboxes.length === 0}
          className="flex-1 px-4 py-2.5 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          <Check className="h-4 w-4" />
          Submit {bboxes.length} Box{bboxes.length !== 1 ? 'es' : ''}
        </button>
      </div>
    </div>
  );
}