import React from 'react';
import { LogoutIcon } from '@heroicons/react/solid';
import { useAuth } from '@/shared/lib/hooks/useAuth';
import cls from './logout.module.css';

const Logout = () => {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      // Перезагружаем страницу для полного сброса состояния
      window.location.href = '/miniphone';
    } catch (error) {
      console.error('Logout error:', error);
      // Даже если запрос не удался, удаляем токен локально и перезагружаем
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
