import React from 'react';
import { useEarnings } from '../hooks/useEarnings';

interface EarningsDashboardProps {
  showDetails?: boolean;
}

export const EarningsDashboard: React.FC<EarningsDashboardProps> = ({ showDetails = true }) => {
  const { earnings, isLoading } = useEarnings();

  if (isLoading) {
    return (
      <div className="earnings-dashboard loading">
        <div className="balance-skeleton"></div>
        {showDetails && (
          <div className="details-grid">
            <div className="detail-skeleton"></div>
            <div className="detail-skeleton"></div>
          </div>
        )}
        <style jsx>{`
          .earnings-dashboard {
            padding: 20px;
            background: var(--card-bg);
            border-radius: 16px;
            border: 1px solid var(--border-color);
          }
          .balance-skeleton {
            height: 60px;
            background: linear-gradient(90deg, var(--border-color) 25%, var(--bg-color) 50%, var(--border-color) 75%);
            background-size: 200% 100%;
            border-radius: 12px;
            animation: loading 1.5s infinite;
            margin-bottom: 20px;
          }
          .details-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
          }
          .detail-skeleton {
            height: 80px;
            background: linear-gradient(90deg, var(--border-color) 25%, var(--bg-color) 50%, var(--border-color) 75%);
            background-size: 200% 100%;
            border-radius: 12px;
            animation: loading 1.5s infinite;
          }
          @keyframes loading {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="earnings-dashboard">
      {/* Main Balance Display */}
      <div className="balance-card">
        <div className="balance-header">
          <span className="balance-label">Current Balance</span>
          <span className="balance-icon">💰</span>
        </div>
        <div className="balance-amount">
          ${earnings.balance.toFixed(2)}
        </div>
        <div className="balance-subtitle">
          Available for withdrawal
        </div>
      </div>

      {/* Additional Details */}
      {showDetails && (
        <div className="details-grid">
          <div className="detail-card">
            <div className="detail-icon">📈</div>
            <div className="detail-content">
              <div className="detail-value">
                ${earnings.totalEarned.toFixed(2)}
              </div>
              <div className="detail-label">Total Earned</div>
            </div>
          </div>

          <div className="detail-card">
            <div className="detail-icon">🌟</div>
            <div className="detail-content">
              <div className="detail-value">
                ${earnings.todayEarned.toFixed(2)}
              </div>
              <div className="detail-label">Today's Earnings</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-item">
          <span className="stat-label">Last 7 days</span>
          <span className="stat-value">+$142.50</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Tasks Completed</span>
          <span className="stat-value">1,248</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Accuracy</span>
          <span className="stat-value">94.5%</span>
        </div>
      </div>

      <style jsx>{`
        .earnings-dashboard {
          padding: 20px;
          background: var(--card-bg);
          border-radius: 16px;
          border: 1px solid var(--border-color);
        }

        .balance-card {
          text-align: center;
          margin-bottom: 24px;
          padding: 24px;
          background: linear-gradient(135deg, var(--primary-color, #0088cc), #0066aa);
          border-radius: 16px;
          color: white;
        }

        .balance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .balance-label {
          font-size: 14px;
          opacity: 0.9;
          font-weight: 500;
        }

        .balance-icon {
          font-size: 24px;
        }

        .balance-amount {
          font-size: 36px;
          font-weight: bold;
          margin-bottom: 8px;
          line-height: 1;
        }

        .balance-subtitle {
          font-size: 14px;
          opacity: 0.8;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }

        .detail-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 12px;
        }

        .detail-icon {
          font-size: 32px;
        }

        .detail-content {
          flex: 1;
        }

        .detail-value {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-color);
          margin-bottom: 4px;
        }

        .detail-label {
          font-size: 14px;
          color: var(--text-color);
          opacity: 0.7;
        }

        .quick-stats {
          display: flex;
          justify-content: space-between;
          padding: 16px 0;
          border-top: 1px solid var(--border-color);
        }

        .stat-item {
          text-align: center;
          flex: 1;
        }

        .stat-label {
          display: block;
          font-size: 12px;
          color: var(--text-color);
          opacity: 0.7;
          margin-bottom: 4px;
        }

        .stat-value {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-color);
        }

        @media (max-width: 480px) {
          .earnings-dashboard {
            padding: 16px;
          }

          .balance-card {
            padding: 20px;
          }

          .balance-amount {
            font-size: 32px;
          }

          .details-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .detail-card {
            padding: 16px;
          }

          .quick-stats {
            flex-direction: column;
            gap: 12px;
          }

          .stat-item {
            display: flex;
            justify-content: space-between;
            text-align: left;
          }

          .stat-label {
            margin-bottom: 0;
          }
        }
      `}</style>
    </div>
  );
};