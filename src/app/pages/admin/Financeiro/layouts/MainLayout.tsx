import { Outlet } from 'react-router';
import { Navigation } from '../components/Navigation';

export function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <Outlet />
    </div>
  );
}
