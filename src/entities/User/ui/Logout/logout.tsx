import React from 'react';
import { LogoutIcon } from '@heroicons/react/solid';
import cls from './logout.module.css';

const Logout = () => (
  <button className={cls.logoutButton}>
    <LogoutIcon className={cls.icon} />
    Logout
  </button>
);

export default Logout;
