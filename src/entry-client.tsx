import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App';

// Get initial state from server-side rendering
const initialState = (window as any).__APP_INITIAL_STATE__ || {};

// Hydrate the app with the same props that were used during SSR
hydrateRoot(
  document.getElementById('root')!,
  <App 
    siteConfig={initialState.siteConfig}
    initialPath={initialState.url}
    initialMe={initialState.initialMe}
    initialOrganization={initialState.initialOrganization}
  />
);