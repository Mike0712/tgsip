import React, { ReactElement } from 'react';
import cls from './auth-layout.module.css';

interface AuthLayoutProps {
  sidebar: ReactElement;
  leftMenu: ReactElement;
  content: ReactElement;
}

const AuthLayout = ({ content, sidebar, leftMenu }: AuthLayoutProps) => (
  <div className={cls.AuthLayout}>
    {sidebar}
    <div className={cls.mainContent}>
      {leftMenu}
      <main className={cls.content}>
        {content}
      </main>
    </div>
  </div>
);

export default AuthLayout;
