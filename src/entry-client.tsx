import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './App';
import "./index.css";
import './App.css';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { RouterProvider } from './contexts/RouterContext';

// Hydrate the app on the client
hydrateRoot(document.getElementById('root')!, <HelmetProvider><RouterProvider><App /></RouterProvider></HelmetProvider>);