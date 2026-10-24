import React from 'react';
import ReactDOM from 'react-dom/client';
import SignInGate from './realms/SignInGate';
import { ErrorBoundary } from './app/ErrorBoundary';
import { watchErrors } from './app/errors';
import './styles/fonts.css';
import './styles/base.css';

watchErrors();
// `?mode=preview` opens the animation scene preview (dev page); anything else is the game.
const ScenePreview = React.lazy(() => import('./realms/ScenePreview'));
const mode = new URLSearchParams(window.location.search).get('mode');
// Dino Realms keeps the boot loader until the island's artwork is in (RealmsApp removes it). With accounts, the
// sign-in gate comes first (SignInGate).
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <React.Suspense fallback={null}>{mode === 'preview' ? <ScenePreview /> : <SignInGate />}</React.Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
