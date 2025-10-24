import React, { useState, useEffect } from 'react';
import { Button, Card, Typography, Radio, Textarea } from '@telegram-apps/telegram-ui';
import { Check, X, Alert } from '@telegram-apps/telegram-ui/icons/functional';

interface RLHFTaskProps {
  responses: {
    id: 'A' | 'B';
    text: string;
    model?: string;
  }[];
  comparisonType: 'better' | 'ranking' | 'editing';
  instructions?: string;
  evaluationCriteria?: string[];
  timeLimit?: number;
  onSubmit: (result: RLHFResult) => void;
  onSkip: () => void;
}

interface RLHFResult {
  preferredResponse: 'A' | 'B' | 'tie' | 'both_bad';
  reasoning: string;
  scoreA?: number;
  scoreB?: number;
  edits?: {
    improvedText: string;
    improvements: string[];
  };
}

export const RLHFTask: React.FC<RLHFTaskProps> = ({
  responses,
  comparisonType,
  instructions,
  evaluationCriteria = ['helpful', 'accurate', 'safe', 'coherent'],
  timeLimit = 180,
  onSubmit,
  onSkip
}) => {
  const [selectedResponse, setSelectedResponse] = useState<'A' | 'B' | 'tie' | 'both_bad'>('tie');
  const [reasoning, setReasoning] = useState('');
  const [scoreA, setScoreA] = useState(5);
  const [scoreB, setScoreB] = useState(5);
  const [showComparison, setShowComparison] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [viewMode, setViewMode] = useState<'side-by-side' | 'stack'>('side-by-side');

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

  const handleResponseSelect = (response: 'A' | 'B' | 'tie' | 'both_bad') => {
    setSelectedResponse(response);
    if (response !== 'both_bad') {
      setShowComparison(true);
    }
  };

  const handleSubmit = () => {
    const result: RLHFResult = {
      preferredResponse: selectedResponse,
      reasoning: reasoning.trim()
    };

    if (comparisonType === 'ranking') {
      result.scoreA = scoreA;
      result.scoreB = scoreB;
    }

    onSubmit(result);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const ResponseCard = ({ response, isSelected }: { response: any; isSelected: boolean }) => (
    <Card
      className={`p-4 transition-all ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-gray-50'}`}
    >
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold
            ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700'}`}>
            {response.id}
          </div>
          {response.model && (
            <Typography variant="caption" color="secondary">
              Model: {response.model}
            </Typography>
          )}
        </div>
        {isSelected && <Check className="text-blue-500" />}
      </div>

      <div className="mb-3">
        <Typography variant="caption" color="secondary" className="mb-1">
          Response {response.id}:
        </Typography>
        <div className="p-3 bg-white rounded border">
          <Typography>{response.text}</Typography>
        </div>
      </div>

      {comparisonType === 'ranking' && (
        <div>
          <Typography variant="caption" color="secondary" className="mb-1">
            Score: {response.id === 'A' ? scoreA : scoreB}/10
          </Typography>
          <input
            type="range"
            min="1"
            max="10"
            value={response.id === 'A' ? scoreA : scoreB}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (response.id === 'A') setScoreA(value);
              else setScoreB(value);
            }}
            className="w-full"
          />
        </div>
      )}
    </Card>
  );

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <Typography weight="2">
            Compare AI responses and choose the better one
          </Typography>
          <div className={`text-lg font-bold ${timeLeft < 30 ? 'text-red-500' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        </div>

        {instructions && (
          <div className="p-3 bg-blue-50 rounded-lg mb-4">
            <Typography variant="caption">{instructions}</Typography>
          </div>
        )}

        {evaluationCriteria && (
          <div>
            <Typography variant="caption" className="mb-2">Evaluation Criteria:</Typography>
            <div className="flex flex-wrap gap-1">
              {evaluationCriteria.map(criteria => (
                <span
                  key={criteria}
                  className="px-2 py-1 bg-gray-100 rounded text-xs capitalize"
                >
                  {criteria}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* View Mode Toggle */}
      <div className="flex justify-end">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('side-by-side')}
            className={`px-3 py-1 rounded ${viewMode === 'side-by-side' ? 'bg-white shadow-sm' : ''}`}
          >
            Side by Side
          </button>
          <button
            onClick={() => setViewMode('stack')}
            className={`px-3 py-1 rounded ${viewMode === 'stack' ? 'bg-white shadow-sm' : ''}`}
          >
            Stack
          </button>
        </div>
      </div>

      {/* Responses */}
      <Card className="flex-1 p-4 overflow-auto">
        <div className={viewMode === 'side-by-side' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
          {responses.map(response => (
            <div
              key={response.id}
              onClick={() => handleResponseSelect(response.id)}
              className="cursor-pointer"
            >
              <ResponseCard
                response={response}
                isSelected={selectedResponse === response.id}
              />
            </div>
          ))}
        </div>

        {/* Comparison Options */}
        <div className="mt-6 space-y-3">
          <Typography weight="3" className="mb-3">Or choose:</Typography>

          <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
            <Radio
              checked={selectedResponse === 'tie'}
              onChange={() => handleResponseSelect('tie')}
            />
            <div>
              <Typography weight="3">Tie</Typography>
              <Typography variant="caption" color="secondary">
                Both responses are equally good
              </Typography>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100">
            <Radio
              checked={selectedResponse === 'both_bad'}
              onChange={() => handleResponseSelect('both_bad')}
            />
            <div>
              <Typography weight="3" className="text-red-600">Both are bad</Typography>
              <Typography variant="caption" color="secondary">
                Neither response meets the criteria
              </Typography>
            </div>
          </label>
        </div>

        {/* Reasoning */}
        <div className="mt-6">
          <Typography weight="3" className="mb-2">Reasoning for your choice:</Typography>
          <Textarea
            value={reasoning}
            onChange={e => setReasoning(e.target.value)}
            placeholder="Explain why you chose this response. What makes it better or worse?"
            className="min-h-[100px]"
          />
        </div>
      </Card>

      {/* Actions */}
      <Card className="p-4">
        <div className="flex gap-2 justify-between items-center">
          <Typography variant="caption" color="secondary">
            {comparisonType === 'ranking' && (
              <>Scores: A={scoreA}/10, B={scoreB}/10</>
            )}
          </Typography>
          <div className="flex gap-2">
            <Button mode="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedResponse || !reasoning.trim()}
            >
              Submit Evaluation
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};