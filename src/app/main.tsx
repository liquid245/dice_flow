import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { engine } from './game';
import { storage } from '../storage/storage';
import { initPersistence } from '../storage/persistence';

initPersistence(engine, storage);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
