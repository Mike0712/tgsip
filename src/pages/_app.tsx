import React from 'react';
import { AppProps } from 'next/app';
import { Provider } from 'react-redux';
import { useRouter } from 'next/router';
import store from '@/app/store';
import '@/app/globals.css';
import AuthLayout from '@/shared/ui/AuthLayout/auth-layout';
import Sidebar from '@/widgets/Sidebar/sidebar';
import LeftMenu from '@/shared/ui/LeftMenu/left-menu';
import { I18nWrapper } from '@/shared/lib/i18n/I18nWrapper';

const App = ({ Component, pageProps }: AppProps) => {
  const router = useRouter();
  
  const pagesWithoutLeftMenu = ['/miniphone', '/signin', '/login'];
  const hideLeftMenu = pagesWithoutLeftMenu.includes(router.pathname);
  const hideSidebar = pagesWithoutLeftMenu.includes(router.pathname);

  return (
    <Provider store={store}>
      <I18nWrapper>
      <AuthLayout 
        sidebar={hideSidebar ? undefined : <Sidebar />}
        leftMenu={hideLeftMenu ? undefined : <LeftMenu /> as unknown as React.ReactElement}
        content={<Component {...pageProps} />}
      />
      </I18nWrapper>
    </Provider>
  );
};

export default App;