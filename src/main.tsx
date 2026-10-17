import React from 'react';
import ReactDOM from 'react-dom/client';
import RealmsApp from './realms/RealmsApp';
import { ErrorBoundary } from './app/ErrorBoundary';
import { watchErrors } from './app/errors';
import './styles/fonts.css';
import './styles/app.css';
import './styles/world.css';
import './styles/panels.css';
import './styles/tour.css';
import './styles/guide.css';
import './styles/adventure.css';
import './styles/forge.css';

watchErrors();
const App = React.lazy(() => import('./app/App'));
const classic = new URLSearchParams(window.location.search).get('mode') === 'classic';
// Dino Realms keeps the boot loader until the island's artwork is in (RealmsApp removes it).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <React.Suspense fallback={null}>{classic ? <App /> : <RealmsApp />}</React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
