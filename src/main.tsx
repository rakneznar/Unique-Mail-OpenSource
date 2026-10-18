import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AppErrorBoundary from './components/AppErrorBoundary.tsx';
import DetachedComposeWindow from './components/DetachedComposeWindow.tsx';
import { I18nProvider } from './i18n/index.tsx';
import './index.css';

const isDetachedCompose = new URLSearchParams(window.location.search).get('uniqueMailDetachedCompose') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <I18nProvider>
        {isDetachedCompose ? <DetachedComposeWindow /> : <App />}
      </I18nProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
