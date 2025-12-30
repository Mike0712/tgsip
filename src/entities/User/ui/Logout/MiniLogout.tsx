import React from 'react';
import { LogoutIcon } from '@heroicons/react/solid';
import { useAuth } from '@/shared/hooks/useAuth';
import cls from './mini-logout.module.css';

const MiniLogout = () => {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.href = '/miniphone';
    } catch (error) {
      console.error('Logout error:', error);
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <button 
      className={cls.miniLogoutButton}
      onClick={handleLogout}
      disabled={isLoggingOut}
      title="Выход"
    >
      <LogoutIcon className={cls.icon} />
    </button>
  );
};

export default MiniLogout;
