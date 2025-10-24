# Telegram Labeling Mini App

A mobile-first Telegram Mini App for completing labeling tasks and earning rewards.

## Features

- ✅ Telegram Web App SDK integration
- ✅ Task viewing with image classification
- ✅ Time tracking for each task
- ✅ Real-time earnings counter
- ✅ Skip button for difficult tasks
- ✅ Earnings dashboard with balance
- ✅ Mobile-first responsive design
- ✅ Dark/light theme support
- ✅ Touch-friendly UI with large targets

## Tech Stack

- **React 19** with TypeScript
- **@twa-dev/sdk** for Telegram integration
- **React Router** for navigation
- **Axios** for API communication
- **Vite** for build tooling

## Project Structure

```
src/
├── components/
│   ├── TaskView.tsx          # Main task component with classification
│   ├── EarningsDashboard.tsx # Balance and earnings display
│   └── BottomNav.tsx         # Mobile navigation
├── hooks/
│   ├── useTelegram.ts        # Telegram Web App hook
│   └── useEarnings.ts        # Earnings state management
├── services/
│   ├── telegram.ts           # Telegram SDK service
│   └── api.ts                # API communication
├── App.tsx                   # Main app with routing
└── styles/
    └── App.css               # Mobile-first styles
```

## Getting Started

### Prerequisites

- Node.js >= 20
- Access to Telegram Bot API

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_APP_NAME=Labeling Platform
```

3. Start development server:
```bash
pnpm dev
```

4. Open in Telegram:
   - Share the development URL with your bot
   - Open it in Telegram to test the Web App

## Components

### TaskView

Main component for completing labeling tasks:
- Fetches next task from backend
- Displays image with 2-4 classification buttons
- Tracks time spent on each task
- Shows earnings animation after submission
- Skip button for difficult tasks

### EarningsDashboard

Shows user's earnings:
- Current balance
- Total earnings
- Today's earnings
- Quick stats (last 7 days, tasks completed, accuracy)

### BottomNav

Mobile-friendly navigation with:
- Tasks page
- Earnings page
- Statistics page
- Profile page

## Mobile Features

### Touch Targets
- All buttons have minimum 44px touch targets
- Large, easy-to-tap classification buttons
- Proper spacing between interactive elements

### Safe Area Support
- Handles iPhone X+ safe areas
- Proper viewport configuration
- Bottom navigation respects safe area

### Theme Support
- Automatic light/dark theme detection
- Respects Telegram theme settings
- Smooth theme transitions

### Performance
- Optimized for mobile networks
- Lazy loading of images
- Efficient state management

## Telegram Integration

The app integrates with Telegram Web App SDK for:
- User authentication
- Theme detection
- Haptic feedback
- Main button control
- Back button handling
- Viewport management

## API Integration

The app communicates with backend for:
- Task fetching
- Response submission
- Earnings tracking
- User statistics

All requests include Telegram authentication data.

## Deployment

1. Build the app:
```bash
pnpm build
```

2. Deploy to your hosting service

3. Configure your Telegram bot with the deployed URL

## Testing

To test the app locally:
1. Run the development server
2. Use Telegram's Web App testing tools
3. Or use the @webappbot for testing

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on mobile devices
5. Submit a pull request

## License

MIT