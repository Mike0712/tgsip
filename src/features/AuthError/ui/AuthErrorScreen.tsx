import React, { useState } from 'react';
import { useRegistrationRequest } from '@/features/RegistrationRequest/model/useRegistrationRequest';
import { useRegistration } from '@/features/Registration/model/useRegistration';
import { useAlert } from '@/shared/lib/hooks/useAlert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/Alert/alert';

interface AuthErrorScreenProps {
  authError: string;
  onRetry: () => void;
  onRegistrationSuccess?: (token: string) => void;
}

export const AuthErrorScreen: React.FC<AuthErrorScreenProps> = ({ authError, onRetry, onRegistrationSuccess }) => {
  const { showAlert } = useAlert();
  const { submitRegistrationRequest } = useRegistrationRequest(showAlert);
  const { register, isLoading: isRegistering } = useRegistration();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [firstNameError, setFirstNameError] = useState('');

  const handleSubmitRequest = async () => {
    const success = await submitRegistrationRequest();
    if (success) {
      setShowRegistrationModal(true);
    }
  };

  const handleRegister = async () => {
    // Валидация
    if (!firstName.trim()) {
      setFirstNameError('Имя обязательно для заполнения');
      return;
    }
    setFirstNameError('');

    const result = await register(firstName.trim());
    if (result.success && result.token) {
      showAlert('Регистрация успешна', 'Добро пожаловать!', 'success');
      setShowRegistrationModal(false);
      if (onRegistrationSuccess) {
        onRegistrationSuccess(result.token);
      }
    } else {
      showAlert('Ошибка регистрации', result.error || 'Не удалось зарегистрироваться', 'error');
    }
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
              onClick={onRetry}
              className="mt-2 px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
            >
              Повторить проверку
            </button>
            <button
              onClick={handleSubmitRequest}
              className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Заявка на регистрацию
            </button>
          </div>
        </div>
      </div>

      {/* Модальное окно регистрации */}
      <Dialog open={showRegistrationModal} onOpenChange={setShowRegistrationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Регистрация</DialogTitle>
            <DialogDescription className="mt-2">
              Пожалуйста, введите ваше имя для завершения регистрации
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-gray-700 mb-1">
                Имя <span className="text-red-500">*</span>
              </label>
              <input
                id="first_name"
                type="text"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setFirstNameError('');
                }}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  firstNameError ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Введите ваше имя"
                disabled={isRegistering}
              />
              {firstNameError && (
                <p className="mt-1 text-sm text-red-500">{firstNameError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowRegistrationModal(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              disabled={isRegistering}
            >
              Отмена
            </button>
            <button
              onClick={handleRegister}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isRegistering}
            >
              {isRegistering ? 'Регистрация...' : 'Зарегистрироваться'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

