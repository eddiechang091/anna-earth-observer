import ObservatoryDashboard from './pages/ObservatoryDashboard';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: 'Earth Anomaly Observatory',
    path: '/',
    element: <ObservatoryDashboard />,
    public: true,
  },
];
