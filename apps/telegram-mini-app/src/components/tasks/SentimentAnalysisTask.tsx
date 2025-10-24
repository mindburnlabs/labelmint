import React, { useState, useEffect, useMemo } from 'react';
import { Button, Card, Typography, SegmentedControl, Slider, Textarea, Chip } from '@telegram-apps/telegram-ui';
import { EmojiSad, EmojiHappy, Info } from '@telegram-apps/telegram-ui/icons/functional';
import DOMPurify from 'dompurify';

interface SentimentAnalysisTaskProps {
  text: string;
  sentimentOptions?: ('positive' | 'negative' | 'neutral')[];
  includeEmotions?: boolean;
  extractKeyPhrases?: boolean;
  timeLimit?: number;
  onSubmit: (analysis: SentimentResult) => void;
  onSkip: () => void;
}

interface SentimentResult {
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  emotion?: string;
  keyPhrases?: string[];
  reasoning?: string;
}

const EMOTIONS = [
  'joy', 'anger', 'fear', 'sadness', 'surprise', 'disgust',
  'trust', 'anticipation', 'love', 'optimism', 'pessimism'
];

export const SentimentAnalysisTask: React.FC<SentimentAnalysisTaskProps> = ({
  text,
  sentimentOptions = ['positive', 'negative', 'neutral'],
  includeEmotions = false,
  extractKeyPhrases = false,
  timeLimit = 120,
  onSubmit,
  onSkip
}) => {
  const [sentiment, setSentiment] = useState<'positive' | 'negative' | 'neutral'>('neutral');
  const [confidence, setConfidence] = useState(75);
  const [emotion, setEmotion] = useState<string>('');
  const [keyPhrases, setKeyPhrases] = useState<string[]>([]);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  
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

  const addKeyPhrase = () => {
    if (currentPhrase.trim() && !keyPhrases.includes(currentPhrase.trim())) {
      setKeyPhrases(prev => [...prev, currentPhrase.trim()]);
      setCurrentPhrase('');
    }
  };

  const removeKeyPhrase = (phrase: string) => {
    setKeyPhrases(prev => prev.filter(p => p !== phrase));
  };

  const getSentimentIcon = (s: string) => {
    switch (s) {
      case 'positive': return <EmojiHappy className="text-green-500" />;
      case 'negative': return <EmojiSad className="text-red-500" />;
      default: return <Info className="text-gray-500" />;
    }
  };

  const getSentimentColor = (s: string) => {
    switch (s) {
      case 'positive': return '#10B981';
      case 'negative': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const highlightTextForSentiment = useMemo(() => {
    // Simple highlighting logic - in production, you'd use more sophisticated NLP
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love', 'best', 'happy'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disgusting', 'angry'];

    let words = text.split(' ');
    words = words.map(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      if (sentiment === 'positive' && positiveWords.some(pw => cleanWord.includes(pw))) {
        return { word, highlight: 'positive' };
      }
      if (sentiment === 'negative' && negativeWords.some(nw => cleanWord.includes(nw))) {
        return { word, highlight: 'negative' };
      }
      return { word, highlight: null };
    });
    return words;
  }, [sentiment, text]);

  
  const handleSubmit = () => {
    const result: SentimentResult = {
      sentiment,
      confidence: confidence / 100
    };

    if (includeEmotions && emotion) {
      result.emotion = emotion;
    }

    if (extractKeyPhrases && keyPhrases.length > 0) {
      result.keyPhrases = keyPhrases;
    }

    if (reasoning.trim()) {
      result.reasoning = reasoning.trim();
    }

    onSubmit(result);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <Typography weight="2">
            Analyze the sentiment of this text
          </Typography>
          <div className={`text-lg font-bold ${timeLeft < 30 ? 'text-red-500' : ''}`}>
            {formatTime(timeLeft)}
          </div>
        </div>
      </Card>

      {/* Text to Analyze */}
      <Card className="p-4">
        <Typography weight="3" className="mb-3">Text to analyze:</Typography>
        <div className="p-3 bg-gray-50 rounded-lg text-sm leading-relaxed">
          {highlightTextForSentiment.map((item, index) => (
            <span
              key={index}
              style={{
                backgroundColor: item.highlight === 'positive' ? '#86EFAC' :
                               item.highlight === 'negative' ? '#FCA5A5' :
                               'transparent',
                padding: item.highlight ? '2px' : '0',
                borderRadius: '2px'
              }}
            >
              {item.word}{' '}
            </span>
          ))}
        </div>
      </Card>

      {/* Sentiment Selection */}
      <Card className="p-4">
        <Typography weight="3" className="mb-3">Overall Sentiment:</Typography>
        <SegmentedControl
          options={sentimentOptions}
          value={sentiment}
          onChange={(value) => setSentiment(value as any)}
        />
        <div className="flex items-center gap-2 mt-3">
          {getSentimentIcon(sentiment)}
          <Typography
            style={{ color: getSentimentColor(sentiment) }}
            weight="2"
          >
            {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
          </Typography>
        </div>
      </Card>

      {/* Confidence Slider */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-2">
          <Typography weight="3">Confidence Level:</Typography>
          <Typography weight="2">{confidence}%</Typography>
        </div>
        <Slider
          min={50}
          max={100}
          step={5}
          value={confidence}
          onChange={setConfidence}
        />
        <Typography variant="caption" color="secondary">
          How confident are you in your sentiment analysis?
        </Typography>
      </Card>

      {/* Emotion Selection (Optional) */}
      {includeEmotions && (
        <Card className="p-4">
          <Typography weight="3" className="mb-3">Dominant Emotion (Optional):</Typography>
          <div className="grid grid-cols-3 gap-2">
            {EMOTIONS.map(em => (
              <Chip
                key={em}
                mode={emotion === em ? 'elevated' : 'outline'}
                onClick={() => setEmotion(em === emotion ? '' : em)}
                className="text-center capitalize"
              >
                {em}
              </Chip>
            ))}
          </div>
        </Card>
      )}

      {/* Key Phrases (Optional) */}
      {extractKeyPhrases && (
        <Card className="p-4">
          <Typography weight="3" className="mb-3">Key Phrases that indicate sentiment:</Typography>

          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={currentPhrase}
              onChange={e => setCurrentPhrase(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && addKeyPhrase()}
              placeholder="Enter a key phrase and press Enter"
              className="flex-1 px-3 py-2 border rounded-lg"
            />
            <Button onClick={addKeyPhrase} mode="outline">
              Add
            </Button>
          </div>

          {keyPhrases.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {keyPhrases.map(phrase => (
                <Chip
                  key={phrase}
                  mode="elevated"
                  onClose={() => removeKeyPhrase(phrase)}
                >
                  {phrase}
                </Chip>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Reasoning (Optional) */}
      <Card className="p-4">
        <Typography weight="3" className="mb-3">Reasoning (Optional):</Typography>
        <Textarea
          value={reasoning}
          onChange={e => setReasoning(e.target.value)}
          placeholder="Explain why you chose this sentiment..."
          className="min-h-[80px]"
        />
      </Card>

      {/* Actions */}
      <Card className="p-4">
        <div className="flex gap-2 justify-between">
          <Typography variant="caption" color="secondary">
            💡 Tip: Look for emotional words, tone, and context
          </Typography>
          <div className="flex gap-2">
            <Button mode="outline" onClick={onSkip}>
              Skip
            </Button>
            <Button onClick={handleSubmit}>
              Submit Analysis
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};