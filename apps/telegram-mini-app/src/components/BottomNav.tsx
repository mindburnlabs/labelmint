import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const navItems: NavItem[] = [
  { id: 'tasks', label: 'Tasks', icon: '📝', path: '/' },
  { id: 'earnings', label: 'Earnings', icon: '💰', path: '/earnings' },
  { id: 'stats', label: 'Stats', icon: '📊', path: '/stats' },
  { id: 'profile', label: 'Profile', icon: '👤', path: '/profile' },
];

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => navigate(item.path)}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{item.label}</span>
        </button>
      ))}

      <style jsx>{`
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          background: var(--card-bg);
          border-top: 1px solid var(--border-color);
          padding: 8px 0 max(8px, env(safe-area-inset-bottom));
          z-index: 1000;
        }

        .nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px 4px;
          background: none;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--text-color);
          opacity: 0.6;
        }

        .nav-item.active {
          opacity: 1;
        }

        .nav-item.active .nav-icon {
          transform: scale(1.1);
        }

        .nav-item:active {
          transform: scale(0.95);
        }

        .nav-icon {
          font-size: 24px;
          transition: transform 0.2s ease;
        }

        .nav-label {
          font-size: 11px;
          font-weight: 500;
        }

        @media (max-width: 380px) {
          .nav-label {
            font-size: 10px;
          }
        }

        /* Add padding for main content to avoid overlap */
        :global(main) {
          padding-bottom: 80px;
        }
      `}</style>
    </nav>
  );
};