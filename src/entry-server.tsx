import React from 'react';
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import { SiteConfig } from './types/site';

export function render(config: SiteConfig, url: string) {
  const helmetContext = {};

  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <App initialConfig={config} initialPath={url} />
    </HelmetProvider>
  );

  return { 
    html,
    helmet: helmetContext.helmet
  };
}