# 🚀 LabelMint Applications

A comprehensive suite of modern applications powering the LabelMint data labeling platform. Built with Next.js, React, and TypeScript for exceptional performance and developer experience.

## 📱 Application Overview

LabelMint consists of three interconnected applications designed to provide a seamless data labeling experience:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Client    │    │   Admin Panel   │    │  Telegram Mini  │
│                 │    │                 │    │      App        │
│ • Progressive   │    │ • Enterprise    │    │ • Mobile-first  │
│   Web App       │    │   Dashboard     │    │ • Bot Integration│
│ • Desktop &     │    │ • Analytics     │    │ • Task Labels   │
│   Mobile        │    │ • User Mgmt     │    │ • Earnings      │
│ • PWA Features  │    │ • Financials    │    │ • Gamification  │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │     Shared Backend        │
                    │   API Gateway & Services  │
                    └───────────────────────────┘
```

## 🎯 Core Features

### 🌐 Web Client (`apps/web`)
The primary application for clients and workers accessing the LabelMint platform.

**Key Features:**
- **Progressive Web App (PWA)** with offline capabilities
- **Responsive Design** optimized for all devices
- **Real-time Updates** via WebSocket connections
- **Enterprise Dashboard** for business users
- **Telegram Integration** for enhanced user experience
- **Task Management** with intuitive UI/UX
- **Payment Processing** with USDT support
- **Analytics & Reporting** for performance tracking

**Technology Stack:**
- **Next.js 15** with App Router
- **React 19** with Server Components
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **PWA Features** with Service Workers
- **IndexedDB** for offline storage
- **WebSocket** for real-time updates

**Quick Start:**
```bash
cd apps/web
pnpm install
pnpm dev
# Visit http://localhost:3000
```

### 🛠️ Admin Dashboard (`apps/admin`)
Comprehensive administrative interface for platform management and oversight.

**Key Features:**
- **Real-time Dashboard** with KPI metrics
- **User Management** with RBAC permissions
- **Project Oversight** and quality control
- **Financial Management** and analytics
- **Dispute Resolution** workflow
- **Advanced Analytics** and reporting
- **Dark Mode** support
- **Mobile-responsive** design

**Technology Stack:**
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** with custom design system
- **TanStack Query** for data fetching
- **Recharts** for data visualization
- **Zustand** for state management
- **Socket.io** for real-time updates

**Quick Start:**
```bash
cd apps/admin
pnpm install
pnpm dev
# Visit http://localhost:3001
```

### 📱 Telegram Mini App (`apps/telegram-mini-app`)
Mobile-first Telegram integration for seamless task completion.

**Key Features:**
- **Telegram Web App SDK** integration
- **Mobile-first** responsive design
- **Touch-friendly** UI with large targets
- **Real-time Earnings** tracking
- **Task Classification** with image support
- **Time Tracking** for productivity
- **Gamification** elements
- **Offline Support** for interrupted sessions

**Technology Stack:**
- **React 19** with TypeScript
- **@twa-dev/sdk** for Telegram integration
- **Vite** for fast development
- **React Router** for navigation
- **Axios** for API communication

**Quick Start:**
```bash
cd apps/telegram-mini-app
pnpm install
pnpm dev
# Test via Telegram Web App interface
```

## 🏗️ Shared Architecture

### 🔧 Technology Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **Next.js** | React Framework | 15+ |
| **React** | UI Library | 19+ |
| **TypeScript** | Type Safety | 5+ |
| **Tailwind CSS** | Styling | 3+ |
| **pnpm** | Package Manager | 8+ |
| **ESLint** | Linting | 8+ |
| **Prettier** | Code Formatting | 3+ |

### 📦 Shared Packages

All applications share common packages from the `/packages` directory:

- **@labelmint/shared** - Common utilities and types
- **@labelmint/ui** - Reusable UI components
- **@labelmint/config** - Shared configuration

### 🔄 Development Workflow

#### 1. Environment Setup
```bash
# Clone repository
git clone https://github.com/your-org/labelmint.git
cd labelmint

# Install dependencies
pnpm install

# Setup environment files
cp .env.example .env.local
```

#### 2. Development Mode
```bash
# Start all applications
pnpm run dev

# Start specific application
pnpm run dev:web
pnpm run dev:admin
pnpm run dev:telegram
```

#### 3. Building for Production
```bash
# Build all applications
pnpm run build

# Build specific application
pnpm run build:web
pnpm run build:admin
pnpm run build:telegram
```

#### 4. Testing
```bash
# Run all tests
pnpm run test

# Run E2E tests
pnpm run test:e2e

# Type checking
pnpm run type-check
```

## 🔐 Authentication & Security

### JWT-Based Authentication
- **Access Tokens** with configurable expiration
- **Refresh Tokens** for extended sessions
- **Role-Based Access Control (RBAC)**
- **Secure Storage** with httpOnly cookies

### Security Features
- **Content Security Policy (CSP)**
- **XSS Protection** with input sanitization
- **CSRF Protection** with token validation
- **Rate Limiting** for API endpoints
- **HTTPS Enforcement** in production

### Permission System
```typescript
// User roles and permissions
type UserRole = 'client' | 'worker' | 'admin' | 'superadmin';

type Permission =
  | 'read:dashboard'
  | 'write:tasks'
  | 'read:analytics'
  | 'manage:users'
  | 'manage:payments';
```

## 🎨 Design System

### UI Components
- **Consistent Design** across all applications
- **Accessible Components** with WCAG 2.1 compliance
- **Dark/Light Themes** with system detection
- **Responsive Breakpoints** for all devices
- **Animation System** with smooth transitions

### Brand Guidelines
- **Color Palette** with semantic meaning
- **Typography Scale** for readability
- **Icon System** with consistent style
- **Spacing System** for visual hierarchy
- **Component Library** for reusability

## 📊 Performance Optimization

### Core Web Vitals
- **First Contentful Paint** < 2 seconds
- **Largest Contentful Paint** < 2.5 seconds
- **Time to Interactive** < 5 seconds
- **Cumulative Layout Shift** < 0.1

### Optimization Techniques
- **Code Splitting** at route and component level
- **Lazy Loading** for images and routes
- **Service Workers** for offline caching
- **Bundle Analysis** for size optimization
- **Image Optimization** with WebP format
- **Font Optimization** with strategic loading

## 🌍 Internationalization

### Multi-language Support
- **i18n Framework** with React Intl
- **Dynamic Language Loading** for performance
- **RTL Support** for Arabic/Hebrew
- **Number/Date Formatting** per locale
- **Currency Formatting** with TON support

### Supported Languages
- 🇺🇸 English (default)
- 🇷🇺 Russian
- 🇨🇳 Chinese
- 🇪🇸 Spanish
- 🇩🇪 German
- 🇫🇷 French

## 🔧 Configuration

### Environment Variables
Each application requires specific environment variables:

```bash
# Shared Variables
NEXT_PUBLIC_API_URL=http://localhost:3101
NEXT_PUBLIC_WS_URL=ws://localhost:3101
NODE_ENV=development

# Web App Specific
NEXT_PUBLIC_APP_NAME=LabelMint
NEXT_PUBLIC_APP_VERSION=1.0.0

# Admin Dashboard Specific
NEXTAUTH_SECRET=your-auth-secret
NEXTAUTH_URL=http://localhost:3001

# Telegram Mini App Specific
VITE_API_URL=http://localhost:3101
VITE_BOT_USERNAME=@labelmint_bot
```

### Service Configuration
```typescript
// apps/shared/config/services.ts
export const services = {
  apiGateway: process.env.NEXT_PUBLIC_API_URL,
  webSocket: process.env.NEXT_PUBLIC_WS_URL,
  auth: process.env.NEXTAUTH_URL,
  storage: process.env.NEXT_PUBLIC_STORAGE_URL,
};
```

## 🚀 Deployment

### Development Environment
```bash
# Local development with Docker
docker-compose -f docker-compose.dev.yml up
```

### Production Deployment
```bash
# Build and deploy all applications
pnpm run build
pnpm run deploy

# Deploy specific application
pnpm run deploy:web
pnpm run deploy:admin
pnpm run deploy:telegram
```

### Hosting Options
- **Vercel** (Recommended for Next.js apps)
- **AWS Amplify** for React applications
- **Netlify** for static sites
- **DigitalOcean** for full-stack applications
- **Custom VPS** with Docker Compose

## 📱 Progressive Web App Features

### PWA Capabilities (Web App)
- **Installable** on home screen
- **Offline Support** with service workers
- **Push Notifications** for real-time updates
- **Background Sync** for data persistence
- **App Badging** for notifications
- **Device Integration** (camera, geolocation)

### Installation
```javascript
// PWA Install Prompt
if ('serviceWorker' in navigator && 'PushManager' in window) {
  // Register service worker
  navigator.serviceWorker.register('/sw.js');

  // Show install prompt
  window.addEventListener('beforeinstallprompt', (e) => {
    // Show custom install UI
  });
}
```

## 📊 Analytics & Monitoring

### Application Monitoring
- **Error Tracking** with Sentry
- **Performance Monitoring** with Web Vitals
- **User Analytics** with privacy-focused tracking
- **A/B Testing** integration
- **Heat Maps** for user behavior

### API Analytics
- **Request Monitoring** with response times
- **Error Rate Tracking** by endpoint
- **User Journey Analytics**
- **Conversion Funnels** for key actions
- **Performance Metrics** by geography

## 🧪 Testing Strategy

### Unit Testing
- **Jest** for component testing
- **React Testing Library** for user interactions
- **Coverage Reports** with Istanbul
- **Mock Services** for isolation

### Integration Testing
- **Cypress** for E2E testing
- **Playwright** for cross-browser testing
- **API Testing** with supertest
- **Database Testing** with test containers

### Performance Testing
- **Lighthouse CI** for performance budgets
- **Bundle Analysis** with webpack-bundle-analyzer
- **Load Testing** with artillery
- **Mobile Testing** with device emulation

## 🔄 CI/CD Integration

### GitHub Actions
```yaml
# .github/workflows/apps.yml
name: Build and Test Apps
on:
  push:
    paths: ['apps/**']
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm run test
      - run: pnpm run build
```

### Deployment Pipeline
1. **Code Commit** triggers CI/CD
2. **Automated Tests** run on all changes
3. **Build Process** creates optimized bundles
4. **Security Scans** check for vulnerabilities
5. **Deployment** to staging environment
6. **E2E Tests** validate deployment
7. **Production Deployment** with rollback capability

## 🛠️ Development Tools

### Code Quality
- **ESLint** with TypeScript rules
- **Prettier** for code formatting
- **Husky** for git hooks
- **lint-staged** for pre-commit checks
- **TypeScript** strict mode

### Developer Experience
- **Hot Module Replacement** for fast development
- **Storybook** for component development
- **React DevTools** for debugging
- **Redux DevTools** for state inspection
- **Bundle Analyzer** for optimization

### Debugging Tools
- **VS Code** with integrated debugging
- **Chrome DevTools** for performance profiling
- **React Query DevTools** for API debugging
- **Postman** for API testing
- **Database Tools** for data inspection

## 📚 Documentation Structure

```
apps/
├── README.md                 # This file
├── web/
│   ├── README.md            # Web app specific docs
│   ├── PWA_README.md        # PWA implementation guide
│   └── docs/                # Additional web app docs
├── admin/
│   ├── README.md            # Admin dashboard guide
│   └── docs/                # Admin-specific documentation
├── telegram-mini-app/
│   ├── README.md            # Telegram app guide
│   └── docs/                # Telegram-specific docs
└── shared/
    ├── README.md            # Shared components guide
    └── docs/                # Shared functionality docs
```

## 🤝 Contributing

### Development Guidelines
1. **Follow TypeScript** strict mode conventions
2. **Use semantic HTML** for accessibility
3. **Write tests** for new features
4. **Document components** with JSDoc
5. **Follow git commit** message conventions

### Pull Request Process
1. **Fork** the repository
2. **Create feature branch** from `develop`
3. **Make changes** with tests
4. **Update documentation** as needed
5. **Submit PR** with detailed description
6. **Code review** by maintainers
7. **Merge** after approval

## 🆘 Support & Troubleshooting

### Common Issues
- **Environment Variables** not loading
- **Port conflicts** with other services
- **CORS issues** with API calls
- **Build failures** due to missing dependencies

### Getting Help
- **Documentation**: Check relevant README files
- **Issues**: Create GitHub issue with details
- **Discussions**: Use GitHub Discussions for questions
- **Discord**: Join community for real-time help

### Performance Issues
- **Bundle Size**: Check webpack-bundle-analyzer
- **Runtime Performance**: Use React DevTools Profiler
- **Network Issues**: Check Chrome DevTools Network tab
- **Memory Leaks**: Use Chrome DevTools Memory tab

## 📄 License

All applications are licensed under the MIT License. See [LICENSE](../../LICENSE) file for details.

---

**🚀 Built with ❤️ by the LabelMint Team**

For enterprise-grade data labeling solutions with exceptional user experience.