import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useTelegram } from './hooks/useTelegram';
import { TaskView } from './components/TaskView';
import { EarningsDashboard } from './components/EarningsDashboard';
import { BottomNav } from './components/BottomNav';
import './App.css';

// Pages
const TasksPage: React.FC = () => {
  const handleTaskComplete = () => {
    // Task completed - could trigger analytics or celebration
    console.log('Task completed!');
  };

  return (
    <main>
      <div className="page-header">
        <h1>Labeling Tasks</h1>
        <p>Complete tasks to earn rewards</p>
      </div>
      <TaskView onTaskComplete={handleTaskComplete} />
    </main>
  );
};

const EarningsPage: React.FC = () => {
  return (
    <main>
      <div className="page-header">
        <h1>Earnings</h1>
        <p>Track your earnings and withdrawals</p>
      </div>
      <EarningsDashboard showDetails={true} />
      <div className="withdraw-section">
        <button className="withdraw-btn">
          Withdraw Funds
        </button>
      </div>
    </main>
  );
};

const StatsPage: React.FC = () => {
  return (
    <main>
      <div className="page-header">
        <h1>Statistics</h1>
        <p>Your performance metrics</p>
      </div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">1,248</div>
          <div className="stat-label">Tasks Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">94.5%</div>
          <div className="stat-label">Accuracy Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">15s</div>
          <div className="stat-label">Avg. Time/Task</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">7</div>
          <div className="stat-label">Day Streak 🔥</div>
        </div>
      </div>
    </main>
  );
};

const ProfilePage: React.FC = () => {
  return (
    <main>
      <div className="page-header">
        <h1>Profile</h1>
        <p>Your account settings</p>
      </div>
      <div className="profile-card">
        <div className="profile-avatar">👤</div>
        <h2>Worker Profile</h2>
        <p>Level 12 Labeler</p>
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">Gold</span>
            <span className="profile-stat-label">Status</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-value">4.9</span>
            <span className="profile-stat-label">Rating</span>
          </div>
        </div>
      </div>
    </main>
  );
};

function App() {
  const { user, isLoading, isAuthenticated, webApp } = useTelegram();

  useEffect(() => {
    // Set Telegram theme colors
    document.documentElement.style.setProperty('--primary-color', '#2481cc');

    // Set header color
    if (webApp) {
      webApp.webApp.setHeaderColor('#2481cc');
      webApp.webApp.setBackgroundColor('#ffffff');
    }
  }, [webApp]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="auth-error">
        <div className="error-icon">⚠️</div>
        <h2>Authentication Required</h2>
        <p>Please open this app from Telegram to continue.</p>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<TasksPage />} />
          <Route path="/earnings" element={<EarningsPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;