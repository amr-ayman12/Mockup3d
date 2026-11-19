import { StrictMode, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { BottomBar, TopNav } from './components/Chrome';
import ContactSheet from './components/ContactSheet';
import { I18nProvider } from './lib/i18n';
import { UiContext, type Ui } from './lib/ui';
// self-hosted Cairo (the reference's typeface): unicode-range keeps the download to the subsets used
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import './styles.css';

// every page loads on demand, so the first screen stays light
const Location = lazy(() => import('./pages/Location'));
const MasterPlan = lazy(() => import('./pages/MasterPlan'));
const Building = lazy(() => import('./pages/Building'));
const Floor = lazy(() => import('./pages/Floor'));
const Tour = lazy(() => import('./pages/Tour'));

function App() {
  const loc = useLocation();
  const [contact, setContact] = useState<{ open: boolean; subject?: string }>({ open: false });
  const [filters, setFilters] = useState(false);
  const onMaster = loc.pathname === '/master-plan';
  useEffect(() => { if (!onMaster) setFilters(false); }, [onMaster]);
  const ui = useMemo<Ui>(() => ({ filters, setFilters, contact: (subject) => setContact({ open: true, subject }) }), [filters]);

  return (
    <UiContext.Provider value={ui}>
      <main>
        <Suspense fallback={<div className="loading" />}>
          <Routes>
            <Route path="/" element={<Location />} />
            <Route path="/master-plan" element={<MasterPlan />} />
            <Route path="/master-plan/building/:id" element={<Building />} />
            <Route path="/master-plan/building/:id/floor/:floor" element={<Floor />} />
            <Route path="/master-plan/building/:id/floor/:floor/tour/:shot" element={<Tour />} />
            <Route path="*" element={<Location />} />
          </Routes>
        </Suspense>
        <TopNav />
      </main>
      <BottomBar onContact={() => setContact({ open: !contact.open })} contactOpen={contact.open}
                 onFilters={onMaster ? () => setFilters(!filters) : undefined} filtersOpen={filters} />
      <ContactSheet open={contact.open} subject={contact.subject} onClose={() => setContact({ open: false })} />
    </UiContext.Provider>
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
