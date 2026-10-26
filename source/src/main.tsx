import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { useStore } from './store';

void useStore.getState().init();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// test hook (harmless in production): lets automated tests read state
(window as unknown as { __ironbook: typeof useStore }).__ironbook = useStore;
