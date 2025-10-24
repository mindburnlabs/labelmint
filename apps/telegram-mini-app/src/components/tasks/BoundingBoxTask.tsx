import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Transformer } from 'react-konva';
import { Button, Card, Typography, SegmentedControl, Slider } from '@telegram-apps/telegram-ui';

interface Box {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence?: number;
}

interface BoundingBoxTaskProps {
  imageUrl: string;
  categories: string[];
  timeLimit?: number;
  onSubmit: (annotations: Box[]) => void;
  onSkip: () => void;
}

export const BoundingBoxTask: React.FC<BoundingBoxTaskProps> = ({
  imageUrl,
  categories,
  timeLimit = 300,
  onSubmit,
  onSkip
}) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Load image
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.src = imageUrl;
  }, [imageUrl]);

  // Handle transformer
  useEffect(() => {
    if (selectedBox && transformerRef.current && stageRef.current) {
      const stage = stageRef.current;
      const selectedNode = stage.findOne(`#${selectedBox}`);

      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      }
    }
  }, [selectedBox]);

  const handleMouseDown = (e: any) => {
    if (e.evt.button !== 0) return; // Only left click

    const pos = e.target.getStage().getPointerPosition();
    const adjustedPos = {
      x: (pos.x - stagePos.x) / stageScale,
      y: (pos.y - stagePos.y) / stageScale
    };

    // Check if clicking on existing box
    const clickedOnBox = e.target.name() === 'box';

    if (!clickedOnBox && image) {
      setIsDrawing(true);
      setStartPoint(adjustedPos);
      setSelectedBox(null);
    }
  };

  const handleMouseMove = (e: any) => {
    if (!isDrawing) return;

    const pos = e.target.getStage().getPointerPosition();
    const adjustedPos = {
      x: (pos.x - stagePos.x) / stageScale,
      y: (pos.y - stagePos.y) / stageScale
    };

    const newBox: Box = {
      id: 'temp',
      x: Math.min(startPoint.x, adjustedPos.x),
      y: Math.min(startPoint.y, adjustedPos.y),
      width: Math.abs(adjustedPos.x - startPoint.x),
      height: Math.abs(adjustedPos.y - startPoint.y),
      label: selectedCategory
    };

    setBoxes(prev => prev.filter(b => b.id !== 'temp').concat(newBox));
  };

  const handleMouseUp = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    setBoxes(prev => {
      const tempBox = prev.find(b => b.id === 'temp');
      if (tempBox && tempBox.width > 10 && tempBox.height > 10) {
        // Valid box, add with proper ID
        return prev.filter(b => b.id !== 'temp').concat({
          ...tempBox,
          id: `box-${Date.now()}`
        });
      }
      // Too small, remove
      return prev.filter(b => b.id !== 'temp');
    });
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();

    const scale = e.evt.deltaY > 0 ? 0.95 : 1.05;
    const newScale = Math.min(Math.max(0.5, stageScale * scale), 3);

    setStageScale(newScale);
  };

  const deleteSelectedBox = () => {
    if (selectedBox) {
      setBoxes(prev => prev.filter(b => b.id !== selectedBox));
      setSelectedBox(null);
    }
  };

  const updateBoxLabel = (boxId: string, newLabel: string) => {
    setBoxes(prev => prev.map(box =>
      box.id === boxId ? { ...box, label: newLabel } : box
    ));
  };

  const handleSubmit = () => {
    onSubmit(boxes.filter(b => b.id !== 'temp'));
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!image) {
    return (
      <Card className="p-4">
        <Typography>Loading image...</Typography>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <Typography weight="2">
            Draw bounding boxes around objects
          </Typography>
          <div className={`text-lg font-bold ${timeLeft < 30 ? 'text-red-500' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Category selector */}
        <div className="mb-4">
          <Typography className="mb-2">Select category:</Typography>
          <SegmentedControl
            options={categories}
            value={selectedCategory}
            onChange={setSelectedCategory}
          />
        </div>

        {/* Controls */}
        <div className="flex gap-2 items-center">
          <Slider
            label="Zoom"
            min={0.5}
            max={3}
            step={0.1}
            value={stageScale}
            onChange={setStageScale}
            className="flex-1"
          />
          {selectedBox && (
            <Button mode="destructive" size="s" onClick={deleteSelectedBox}>
              Delete Selected
            </Button>
          )}
        </div>
      </Card>

      {/* Canvas */}
      <Card className="flex-1 p-2 overflow-hidden">
        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
          <Stage
            width={Math.min(window.innerWidth - 40, 800)}
            height={500}
            scaleX={stageScale}
            scaleY={stageScale}
            x={stagePos.x}
            y={stagePos.y}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            ref={stageRef}
            draggable={!isDrawing}
            onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
          >
            <Layer>
              {/* Background image */}
              <Rect
                x={0}
                y={0}
                width={image.width}
                height={image.height}
                fillPatternImage={image}
                listening={false}
              />

              {/* Bounding boxes */}
              {boxes.map(box => (
                <React.Fragment key={box.id}>
                  <Rect
                    id={box.id}
                    name="box"
                    x={box.x}
                    y={box.y}
                    width={box.width}
                    height={box.height}
                    stroke={selectedBox === box.id ? '#007AFF' : '#00F000'}
                    strokeWidth={2}
                    strokeScaleEnabled={false}
                    fill={box.id !== 'temp' ? 'rgba(0, 123, 255, 0.1)' : 'rgba(0, 255, 0, 0.1)'}
                    dash={box.id === 'temp' ? [5, 5] : null}
                    onClick={() => setSelectedBox(box.id)}
                    onTap={() => setSelectedBox(box.id)}
                  />

                  {/* Label */}
                  <Text
                    text={`${box.label} ${box.confidence ? `(${Math.round(box.confidence * 100)}%)` : ''}`}
                    x={box.x}
                    y={box.y - 20}
                    fontSize={14}
                    fill="white"
                    padding={4}
                    fillStyle="#007AFF"
                    listening={false}
                  />

                  {/* Resize handles for selected box */}
                  {selectedBox === box.id && box.id !== 'temp' && (
                    <>
                      <Rect x={box.x - 4} y={box.y - 4} width={8} height={8} fill="#007AFF" />
                      <Rect x={box.x + box.width - 4} y={box.y - 4} width={8} height={8} fill="#007AFF" />
                      <Rect x={box.x - 4} y={box.y + box.height - 4} width={8} height={8} fill="#007AFF" />
                      <Rect x={box.x + box.width - 4} y={box.y + box.height - 4} width={8} height={8} fill="#007AFF" />
                    </>
                  )}
                </React.Fragment>
              ))}

              {/* Transformer */}
              <Transformer
                ref={transformerRef}
                boundBoxFunc={(oldBox, newBox) => {
                  // Limit to image bounds
                  return {
                    ...newBox,
                    x: Math.max(0, Math.min(newBox.x, image.width - newBox.width)),
                    y: Math.max(0, Math.min(newBox.y, image.height - newBox.height)),
                    width: Math.min(newBox.width, image.width - newBox.x),
                    height: Math.min(newBox.height, image.height - newBox.y)
                  };
                }}
              />
            </Layer>
          </Stage>
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-4">
        <div className="flex gap-4 justify-between">
          <div className="text-sm text-gray-600">
            Boxes: {boxes.filter(b => b.id !== 'temp').length} |
            Selected: {selectedBox || 'None'}
          </div>
          <div className="flex gap-2">
            <Button mode="outline" onClick={onSkip}>
              Skip Task
            </Button>
            <Button onClick={handleSubmit}>
              Submit ({boxes.filter(b => b.id !== 'temp').length} boxes)
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};