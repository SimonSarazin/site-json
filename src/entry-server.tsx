import React from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';

export async function render(url: string, context: any = {}) {
  try {
    // Set up any server-side context here
    const html = renderToString(<App />);
    
    return { html, context };
  } catch (error) {
    console.error('SSR render error:', error);
    // Return a fallback HTML in case of error
    return { 
      html: '<div id="root"><div>Loading...</div></div>', 
      context: { error: error.message } 
    };
  }
}