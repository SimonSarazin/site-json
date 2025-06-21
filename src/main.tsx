import { StrictMode } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root')!;

// Check if the app was server-rendered
if (container.hasChildNodes()) {
  // Hydrate the server-rendered content
  hydrateRoot(container, 
    <StrictMode>
      <App />
    </StrictMode>
  );
} else {
  // Client-side only rendering
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}