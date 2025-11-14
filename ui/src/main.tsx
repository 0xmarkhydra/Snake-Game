import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { GAME_INFO } from './configs/game';
import { registerServiceWorker } from './utils/serviceWorker';

// Set document title
document.title = GAME_INFO.name;

// 🚀 PWA: Register service worker for offline support and caching
if (import.meta.env.PROD) {
  registerServiceWorker();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
