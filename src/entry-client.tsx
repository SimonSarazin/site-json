import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App';

// Hydrate the app on the client
hydrateRoot(document.getElementById('root')!, <App />);