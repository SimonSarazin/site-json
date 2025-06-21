import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { SiteConfig } from './types/site';

export function render(config: SiteConfig, url: string) {
  // Create a mock router context for SSR
  const mockRouterContext = {
    currentPath: url,
    navigate: () => {},
    goBack: () => {},
    goForward: () => {}
  };

  // Create providers with SSR-safe defaults
  const html = renderToString(
    <App />
  );

  return { html };
}