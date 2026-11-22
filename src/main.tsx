import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { ErrorBoundary } from './app/components/ErrorBoundary';
import { logger } from './app/logger';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Application root is missing.');
createRoot(root, {
  onCaughtError: () => logger.record('render.error'),
  onUncaughtError: () => logger.record('render.error'),
  onRecoverableError: () => logger.record('render.error'),
}).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>);
