import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { engine } from './game';
import { storage } from '../storage/storage';
import { initPersistence } from '../storage/persistence';
import { preloadSounds, unlockAudio } from '../services/audio';
import { config } from '../config';

document.documentElement.style.setProperty('--font-scale', String(config.ui.fontScale));

initPersistence(engine, storage);
preloadSounds();
unlockAudio();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
