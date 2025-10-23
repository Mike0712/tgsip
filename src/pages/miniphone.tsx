import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { setSipAccounts, setSelectedAccount, setUserPhones } from '@/entities/WebRtc/model/slice';
import store, { RootState } from '@/app/store';
import { useAuth } from '@/hooks/useAuth'
import { apiClient } from '@/lib/api'
import { useSelector } from 'react-redux';

// Динамический импорт для предотвращения SSR ошибок
const DialerTelegram = dynamic(() => import('@/widgets/Dialer/dialer-telegram'), {
  ssr: false,
  loading: () => <div className="bg-white rounded-2xl shadow-lg p-6 text-center">Загрузка...</div>
});

const MiniPhone = () => {
  const { user, isAuthenticated, isLoading, loginWithTelegram } = useAuth()
  const [isClient, setIsClient] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [attemptedAuth, setAttemptedAuth] = useState(false);
  const sessionState = useSelector((state: RootState) => state.sip.sessionState);
  const userPhones = useSelector((state: RootState) => state.sip.userPhones);
  
  // Предотвращаем ошибку гидратации
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // Аутентификация через Telegram (однократная попытка)
  useEffect(() => {
    if (isClient && !isAuthenticated && !isLoading && !attemptedAuth) {
      const handleTelegramAuth = async () => {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
          const tg = window.Telegram.WebApp;
          const initData = tg.initData;
          
          if (initData) {
            console.log('🔐 Attempting Telegram authentication...');
            const result = await loginWithTelegram(initData);
            
            if (!result.success) {
              setAuthError(result.error || 'Ошибка аутентификации');
              console.error('❌ Authentication failed:', result.error);
            } else {
              console.log('✅ Authentication successful:', result.user);
              setAuthError(null);
            }
          } else {
            setAuthError('Данные Telegram недоступны');
          }
        } else {
          setAuthError('Telegram Web App недоступен');
        }
      };

      // помечаем, что попытка выполнена, чтобы не зациклиться на 403
      setAttemptedAuth(true);
      handleTelegramAuth();
    }
  }, [isClient, isAuthenticated, isLoading, attemptedAuth, loginWithTelegram]);

  useEffect(() => {
    // Инициализация Telegram Web App (только после успешной аутентификации)
    if (isAuthenticated && typeof window !== 'undefined' && window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      
      try {
        // Расширяем приложение на весь экран
        if (tg.expand) {
          tg.expand();
        }
        
        // Включаем кнопку закрытия (если поддерживается)
        if (tg.enableClosingConfirmation) {
          tg.enableClosingConfirmation();
        }
        
        // Настраиваем главную кнопку
        if (tg.MainButton) {
          tg.MainButton.setText('📞 Позвонить');
          tg.MainButton.show();
          tg.MainButton.disable(); // Изначально отключена
        }
        
        // Запрашиваем доступ к микрофону (если поддерживается)
        if (tg.requestWriteAccess) {
          tg.requestWriteAccess((granted) => {
            if (granted) {
              console.log('✅ Microphone access granted');
            } else {
              console.log('❌ Microphone access denied');
              if (tg.showAlert) {
                tg.showAlert('Для работы приложения необходим доступ к микрофону');
              }
            }
          });
        } else {
          console.log('⚠️ requestWriteAccess not supported in this Telegram version');
          // Попробуем запросить доступ через WebRTC API
          if (navigator.mediaDevices?.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true })
              .then(() => console.log('✅ Microphone access granted via WebRTC'))
              .catch(() => console.log('❌ Microphone access denied via WebRTC'));
          }
        }
        
        // Обработка событий (если поддерживается)
        if (tg.onEvent) {
          tg.onEvent('viewportChanged', () => {
            console.log('Viewport changed:', tg.viewportHeight);
          });
        }
        
        console.log('✅ Telegram Web App initialized');
        console.log('User:', tg.initDataUnsafe?.user);
        console.log('Platform:', tg.platform);
        console.log('Version:', tg.version);
        
      } catch (error) {
        console.error('❌ Error initializing Telegram Web App:', error);
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Загружаем SIP аккаунты и телефоны пользователя из API
    const loadUserData = async () => {
      if (!isAuthenticated) return;

      try {
        // Загружаем SIP аккаунты
        console.log('📡 Loading SIP accounts...');
        const sipResponse = await apiClient.getSipAccounts();
        
        if (sipResponse.success && sipResponse.data) {
          const accounts = (sipResponse.data as any).accounts || [];
          console.log('✅ SIP accounts loaded:', accounts);
          
          // Сохраняем все аккаунты в store
          store.dispatch(setSipAccounts(accounts));
          
          // Выбираем первый активный аккаунт
          const activeAccount = accounts.find((acc: any) => acc.is_active);
          if (activeAccount) {
            store.dispatch(setSelectedAccount(activeAccount));
            console.log('✅ Selected account:', activeAccount);
          }
        } else {
          console.error('❌ Failed to load SIP accounts:', sipResponse.error);
        }

        // Загружаем телефоны пользователя
        console.log('📱 Loading user phones...');
        const phonesResponse = await apiClient.getUserPhones();
        
        if (phonesResponse.success && phonesResponse.data) {
          const phones = phonesResponse.data.phones || [];
          console.log('✅ User phones loaded:', phones);
          
          // Сохраняем телефоны в store
          store.dispatch(setUserPhones(phones));
        } else {
          console.error('❌ Failed to load user phones:', phonesResponse.error);
        }
      } catch (error) {
        console.error('❌ Error loading user data:', error);
      }
    };

    loadUserData();
  }, [isAuthenticated]);

  // Показываем загрузку
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Проверка аутентификации...</p>
        </div>
      </div>
    );
  }

  // Показываем ошибку аутентификации
  if (authError) {
    const handleRegistrationRequest = async () => {
      try {
        if (typeof window !== 'undefined' && window.Telegram?.WebApp?.initDataUnsafe?.user) {
          const u = window.Telegram.WebApp.initDataUnsafe.user;
          const payload = { telegram_id: String(u.id), username: u.username };
          const res = await fetch('/api/auth/request-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            alert('Заявка отправлена. Мы свяжемся с вами после одобрения.');
          } else {
            const data = await res.json().catch(() => ({}));
            alert(`Не удалось отправить заявку: ${data.error || res.status}`);
          }
        } else {
          alert('Нет данных Telegram для подачи заявки');
        }
      } catch (e) {
        alert('Ошибка сети при отправке заявки');
      }
    };

    const handleRetryAuth = () => {
      // сбрасываем ошибку и разрешаем повторную попытку авторизации
      setAuthError(null);
      setAttemptedAuth(false);
    };
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 p-4 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">
              Доступ запрещен
            </h1>
            <p className="text-gray-600 mb-6">
              {authError}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-700">
                Для доступа к приложению необходимо быть зарегистрированным пользователем Telegram.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleRetryAuth}
                className="mt-2 px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
              >
                Повторить проверку
              </button>
              <button
                onClick={handleRegistrationRequest}
                className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Заявка на регистрацию
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Показываем основное приложение только для аутентифицированных пользователей
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Ожидание аутентификации...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            📞 MiniPhone
          </h1>
          <p className="text-sm text-gray-600">
            SIP телефония в Telegram
          </p>
          
          {user && (
            <div className="mt-3 p-3 bg-white rounded-lg shadow-sm">
              <p className="text-sm font-medium text-gray-700">
                👤 {user.first_name} {user.last_name || ''}
              </p>
              {user.username && (
                <p className="text-xs text-gray-500">
                  @{user.username}
                </p>
              )}
              <p className="text-xs text-green-600 mt-1">
                ✅ Аутентифицирован
              </p>
            </div>
          )}
        </div>
        
        <DialerTelegram />
        
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Powered by SIP.js & Telegram Web Apps
          </p>
        </div>
      </div>
    </div>
  );
}

export default MiniPhone;