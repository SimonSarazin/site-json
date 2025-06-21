import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { SiteConfig } from './types/site';

export function render(config: SiteConfig, url: string, initialMe: any = null, initialOrganization: any = null) {
  const html = renderToString(
    <App 
      siteConfig={config} 
      initialPath={url}
      initialMe={initialMe}
      initialOrganization={initialOrganization}
    />
  );

  return { html };
}