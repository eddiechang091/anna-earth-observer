import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import SkipLink from '@/components/common/SkipLink';

import { routes } from './routes';

const App: React.FC = () => {
  return (
    <Router>
      <SkipLink />
      <IntersectObserver />
      <div className="flex flex-col min-h-screen grow">
        <main id="main-content" tabIndex={-1} className="main-content flex-grow">
          <Routes>
          {routes.map((route, index) => (
            <Route
              key={index}
              path={route.path}
              element={route.element}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </Router>
  );
};

export default App;
