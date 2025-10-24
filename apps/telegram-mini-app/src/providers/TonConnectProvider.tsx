import React, { useState, useEffect } from 'react';
import { TonConnectUIProvider } from '@tonconnect/ui-react';
import { useTWA } from '@twa-dev/sdk/react';

interface TonConnectProviderProps {
  children: React.ReactNode;
}

export const TonConnectProvider: React.FC<TonConnectProviderProps> = ({ children }) => {
  const [manifestUrl, setManifestUrl] = useState('');
  const WebApp = useTWA();

  useEffect(() => {
    // Generate the manifest URL based on the current environment
    const isProduction = process.env.NODE_ENV === 'production';
    const baseUrl = isProduction
      ? 'https://your-domain.com' // Replace with your production domain
      : 'http://localhost:5173'; // Development server

    const manifestUrl = `${baseUrl}/tonconnect-manifest.json`;

    // Create manifest file if it doesn't exist
    createManifestFile(manifestUrl);

    setManifestUrl(manifestUrl);
  }, []);

  const createManifestFile = async (url: string) => {
    // In a real app, this would be a static file
    // For now, we'll just ensure the URL is set correctly
    console.log('TON Connect manifest URL:', url);
  };

  if (!manifestUrl) {
    return <div>Loading TON Connect...</div>;
  }

  return (
    <TonConnectUIProvider
      manifestUrl={manifestUrl}
      actionsConfiguration={{
        notifications: ['error', 'success'],
        modals: ['before', 'success', 'error'],
        revertTransactionsErrorTimeout: 5000,
      }}
      uiPreferences={{
        theme: WebApp.colorScheme === 'dark' ? 'DARK' : 'LIGHT',
        colorsSet: {
          CONNECT_BUTTON: {
            BACKGROUND: WebApp.themeParams.button_color || '#007AFF',
            FOREGROUND: WebApp.themeParams.button_text_color || '#FFFFFF',
          },
        },
      }}
      walletsListConfiguration={{
        includeWallets: [
          { name: 'telegram-wallet', appName: 'tonkeeper' },
          { name: 'tonkeeper', appName: 'tonkeeper' },
          { name: 'mytonwallet', appName: 'mytonwallet' },
          { name: 'openmask', appName: 'openmask' },
        ],
      }}
      enableAndroidBackHandler={true}
      enable iosBackHandler={true}
    >
      {children}
    </TonConnectUIProvider>
  );
};