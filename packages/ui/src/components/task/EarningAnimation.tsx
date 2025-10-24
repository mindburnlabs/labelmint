import React from 'react';
import { Card } from '../Card';
import { cn } from '../../lib/utils';
import { ComponentProps } from '../../types/common';

interface EarningAnimationProps extends ComponentProps {
  amount: number;
  onComplete?: () => void;
  duration?: number;
  showConfetti?: boolean;
  className?: string;
}

export function EarningAnimation({
  amount,
  onComplete,
  duration = 1500,
  showConfetti = true,
  className,
  ...props
}: EarningAnimationProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <div className={cn('flex items-center justify-center h-full', className)} {...props}>
      <Card className="p-8 text-center relative overflow-hidden">
        {/* Success Icon */}
        <div className="mx-auto w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4 animate-fade-in">
          <svg
            className="w-8 h-8 text-success"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Amount Display */}
        <div className="text-4xl font-bold text-success mb-2 animate-fade-in">
          +${amount.toFixed(2)}
        </div>

        {/* Success Message */}
        <div className="text-lg text-muted-foreground mb-4 animate-fade-in">
          Task completed!
        </div>

        {/* Additional Details */}
        <div className="text-sm text-muted-foreground animate-fade-in">
          Added to your balance
        </div>

        {/* Confetti Effect (Optional) */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg">
            <div className="confetti-container">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="confetti-piece"
                  style={{
                    '--delay': `${Math.random() * 1}s`,
                    '--duration': `${1 + Math.random() * 2}s`,
                    '--left': `${Math.random() * 100}%`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          </div>
        )}

        <style jsx>{`
          .confetti-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }

          .confetti-piece {
            position: absolute;
            top: -10px;
            width: 10px;
            height: 10px;
            background: linear-gradient(
              135deg,
              #10b981,
              #3b82f6,
              #f59e0b,
              #ef4444,
              #8b5cf6
            );
            animation: confetti-fall var(--duration) ease-out var(--delay);
            left: var(--left);
          }

          @keyframes confetti-fall {
            0% {
              transform: translateY(0) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(400px) rotate(720deg);
              opacity: 0;
            }
          }

          @keyframes fade-in {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .animate-fade-in {
            animation: fade-in 0.5s ease-out;
          }
        `}</style>
      </Card>
    </div>
  );
}