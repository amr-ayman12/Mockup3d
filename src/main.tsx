import { StrictMode, Suspense, lazy, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import ContactSheet from './components/ContactSheet';
import ShotViewer from './components/ShotViewer';
import TopBar from './components/TopBar';
import UnitCard from './components/UnitCard';
import { I18nProvider } from './lib/i18n';
import Home from './pages/Home';
// self-hosted Cairo: unicode-range keeps the download to the Arabic/Latin subsets actually used
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import './styles.css';

// deep-zoom pages load OpenSeadragon on demand, so the landing page stays tiny
const MasterPlan = lazy(() => import('./pages/MasterPlan'));
const Building = lazy(() => import('./pages/Building'));
const Floor = lazy(() => import('./pages/Floor'));

function App() {
  const [contact, setContact] = useState<{ open: boolean; subject?: string }>({ open: false });
  return (
    <>
      <TopBar onContact={() => setContact({ open: true })} />
      <main>
        <Suspense fallback={<div className="loading" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/master-plan" element={<MasterPlan />} />
            <Route path="/master-plan/building/:id" element={<Building />} />
            <Route path="/master-plan/building/:id/floor/:floor" element={<Floor />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      <UnitCard onContact={(subject) => setContact({ open: true, subject })} />
      <ShotViewer onContact={(subject) => setContact({ open: true, subject })} />
      <ContactSheet open={contact.open} subject={contact.subject} onClose={() => setContact({ open: false })} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </I18nProvider>
  </StrictMode>,
);
