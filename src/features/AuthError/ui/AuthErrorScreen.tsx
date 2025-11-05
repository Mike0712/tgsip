import React from 'react';
import { useRegistrationRequest } from '@/features/RegistrationRequest/model/useRegistrationRequest';
import { useAlert } from '@/shared/lib/hooks/useAlert';

interface AuthErrorScreenProps {
  authError: string;
  onRetry: () => void;
}

export const AuthErrorScreen: React.FC<AuthErrorScreenProps> = ({ authError, onRetry }) => {
  const { showAlert } = useAlert();
  const { submitRegistrationRequest } = useRegistrationRequest(showAlert);

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
              onClick={onRetry}
              className="mt-2 px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
            >
              Повторить проверку
            </button>
            <button
              onClick={submitRegistrationRequest}
              className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Заявка на регистрацию
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

