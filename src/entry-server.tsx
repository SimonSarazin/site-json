import React from 'react';
import { renderToString } from 'react-dom/server';
import { HelmetProvider } from "@dr.pogodin/react-helmet";
import App from './App';

export async function render(url: string, context: any = {}) {
  try {
    // Set up any server-side context here
    const helmetContext = {};

  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <App />
    </HelmetProvider>
  );
    
    return { html, context,
          head: `
      ${helmetContext.helmet?.title?.toString() || ""}
      ${helmetContext.helmet?.meta?.toString() || ""}
      ${helmetContext.helmet?.link?.toString() || ""}
    `,
     };
  } catch (error) {
    console.error('SSR render error:', error);
    // Return a fallback HTML in case of error
    return { 
      html: '<div id="root"><div>Loading...</div></div>', 
      context: { error: error.message } 
    };
  }
}