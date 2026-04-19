import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import SpecialistTopbar from '@/components/feature/SpecialistTopbar';
import SpecialistMobileBottomNav from '@/components/feature/SpecialistMobileBottomNav';
import ToastContainer from '@/components/base/ToastContainer';

export default function SpecialistLayout() {
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

  const handleToggleDark = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (next) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
      return next;
    });
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <SpecialistTopbar darkMode={darkMode} onToggleDark={handleToggleDark} />
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <SpecialistMobileBottomNav />
      <ToastContainer />
    </div>
  );
}
