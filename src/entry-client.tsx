import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App';

// Hydrate the app with the same props that were used during SSR
hydrateRoot(
  document.getElementById('root')!,
  <App />
);