import React from 'react';
import { LogoutIcon } from '@heroicons/react/solid';
import { useAuth } from '@/shared/hooks/useAuth';
import cls from './logout.module.css';

const Logout = () => {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.href = '/login';
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
      className={cls.logoutButton}
      onClick={handleLogout}
      disabled={isLoggingOut}
    >
      <LogoutIcon className={cls.icon} />
      {isLoggingOut ? 'Выход...' : 'Logout'}
    </button>
  );
};

export default Logout;
