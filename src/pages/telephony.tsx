import React, { useEffect, useState } from 'react';
import Dialer from '@/widgets/Dialer/dialer'
import { 
  setServers, 
  setPhones, 
  setUserSipConfigs, 
  setSelectedServer, 
  setCurrentCredentials 
} from '@/entities/WebRtc/model/slice';
import store from '@/app/store';
import { useSearchParams } from 'next/navigation'
import { apiClient } from '@/lib/api';

const Telephony = () => {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSipData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Загружаем данные из API
        const [serversResponse, phonesResponse, userSipConfigsResponse] = await Promise.all([
          apiClient.getServers(),
          apiClient.getPhones(),
          apiClient.getUserSipConfigs()
        ]);

        if (!serversResponse.success || !phonesResponse.success || !userSipConfigsResponse.success) {
          throw new Error('Failed to load SIP data');
        }

        const servers = serversResponse.data || [];
        const phones = phonesResponse.data || [];
        const userSipConfigs = userSipConfigsResponse.data || [];

        store.dispatch(setServers(servers));
        store.dispatch(setPhones(phones));
        store.dispatch(setUserSipConfigs(userSipConfigs));

        // Выбираем сервер на основе URL параметра или используем первый доступный
        const sipParam = searchParams?.get('sip');
        let selectedServer = null;
        let credentials = null;

        if (sipParam === 'first' && servers.length > 0) {
          selectedServer = servers[0];
        } else if (sipParam === 'second' && servers.length > 1) {
          selectedServer = servers[1];
        } else if (userSipConfigs.length > 0) {
          // Используем первую пользовательскую SIP конфигурацию
          const config = userSipConfigs[0];
          selectedServer = servers.find(s => s.id === config.server_id) || null;
          credentials = {
            username: config.phone_number || '11',
            password: config.secret
          };
        }

        if (selectedServer) {
          store.dispatch(setSelectedServer(selectedServer));
          if (credentials) {
            store.dispatch(setCurrentCredentials(credentials));
          }
        }

      } catch (err) {
        console.error('Failed to load SIP data:', err);
        setError('Failed to load SIP configuration');
      } finally {
        setLoading(false);
      }
    };

    loadSipData();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading SIP configuration...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Telephony</h1>
      <Dialer />
    </div>
  );
}

export default Telephony;