import React from 'react';
import { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { useRouter } from 'next/router';
import store from '@/app/store';
import '@/app/globals.css';
import AuthLayout from '@/shared/ui/AuthLayout/auth-layout';
import Sidebar from '@/widgets/Sidebar/sidebar';
import LeftMenu from '@/shared/ui/LeftMenu/left-menu';

const App = ({ Component, pageProps }: AppProps) => {
  const router = useRouter();
  
  // Страницы без левого меню
  const pagesWithoutLeftMenu = ['/miniphone'];
  const hideLeftMenu = pagesWithoutLeftMenu.includes(router.pathname);

  return (
    <Provider store={store}>
      <AuthLayout 
        sidebar={<Sidebar />}
        leftMenu={hideLeftMenu ? null : <LeftMenu />}
        content={<Component {...pageProps} />}
      />
    </Provider>
  );
};

export default App;