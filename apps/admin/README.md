# LabelMint Admin Dashboard

A comprehensive admin dashboard for the LabelMint data labeling marketplace platform.

## Features

- **Real-time Dashboard**: KPI metrics, charts, and system health monitoring
- **User Management**: Manage clients, workers, and admin roles with RBAC
- **Project Oversight**: Track projects, quality metrics, and completion rates
- **Financial Management**: Revenue analytics, transaction monitoring, and withdrawal approvals
- **Dispute Resolution**: Handle disputes between clients and workers
- **Analytics & Reporting**: Business intelligence and custom reports
- **Real-time Updates**: WebSocket integration for live data
- **Dark Mode**: Built-in dark/light theme support

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Data Fetching**: TanStack Query (React Query)
- **Charts**: Recharts
- **State Management**: Zustand
- **Forms**: React Hook Form
- **Notifications**: Sonner (toast notifications)
- **Authentication**: JWT with refresh tokens
- **Real-time**: Socket.io

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the admin directory
3. Install dependencies:

```bash
npm install
```

4. Copy the environment file:

```bash
cp .env.local.example .env.local
```

5. Configure your environment variables in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3001
NODE_ENV=development
```

6. Start the development server:

```bash
npm run dev
```

7. Open [http://localhost:3001](http://localhost:3001) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (dashboard)/       # Dashboard layout
│   │   ├── dashboard/     # Main dashboard
│   │   ├── users/         # User management
│   │   ├── projects/      # Project oversight
│   │   ├── finance/       # Financial controls
│   │   ├── disputes/      # Dispute resolution
│   │   ├── analytics/     # Reports & insights
│   │   └── settings/      # Admin settings
│   ├── auth/              # Authentication pages
│   └── api/               # API routes
├── components/            # Reusable components
│   ├── ui/               # Base UI components
│   ├── charts/           # Chart components
│   ├── forms/            # Form components
│   └── layout/           # Layout components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configs
├── store/                # State management
├── types/                # TypeScript definitions
└── styles/               # Global styles
```

## Authentication

The admin dashboard uses JWT-based authentication with refresh tokens. Admins must have appropriate permissions to access different sections:

- `read:dashboard` - View dashboard metrics
- `read:users` - View user list
- `write:users` - Manage users (suspend/activate)
- `read:projects` - View projects
- `read:finance` - View financial data
- `write:finance` - Approve withdrawals
- `read:disputes` - View disputes
- `write:disputes` - Resolve disputes
- `read:analytics` - View analytics
- `read:settings` - View settings
- `write:settings` - Modify settings

## API Integration

The dashboard integrates with the LabelMint backend API. Make sure the backend is running and accessible via the `NEXT_PUBLIC_API_URL` environment variable.

## Features in Detail

### Dashboard Overview
- Real-time KPI widgets
- Revenue and transaction charts
- System health monitoring
- Recent activity feed
- User activity analytics

### User Management
- Search, filter, and paginate users
- View user details and statistics
- Suspend/activate user accounts
- Bulk operations
- Role-based access control

### Project Oversight
- Project status tracking
- Quality metrics dashboard
- Budget monitoring
- Performance analytics
- Resource allocation

### Financial Management
- Revenue analytics and reporting
- Transaction monitoring
- Withdrawal request queue
- Payout approvals
- Financial reconciliation

### Dispute Resolution
- Dispute ticket management
- Evidence collection
- Resolution workflow
- Communication tools
- Analytics on dispute patterns

### Analytics & Reporting
- Custom report builder
- Data export capabilities
- Business intelligence
- Predictive analytics
- Executive summaries

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details