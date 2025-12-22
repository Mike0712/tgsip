import React, { useState } from 'react';
import { useRegistrationRequest } from '@/features/RegistrationRequest/model/useRegistrationRequest';
import { useRegistration } from '@/features/Registration/model/useRegistration';
import { useAlert } from '@/shared/hooks/useAlert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/shared/ui/Alert/alert';

interface FriendlyRetryScreenProps {
  errorMsg: string;
  onRegistrationSuccess?: (token: string) => void;
}

const FriendlyRetryScreen: React.FC<FriendlyRetryScreenProps> = ({ errorMsg, onRegistrationSuccess }) => {
  const { showAlert } = useAlert();
  const { submitRegistrationRequest } = useRegistrationRequest(showAlert);
  const { register, isLoading: isRegistering } = useRegistration();
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmitRequest = async () => {
    setLoading(true);
    const success = await submitRegistrationRequest();
    setLoading(false);
    if (success) {
      setShowRegistrationModal(true);
    }
  };

  const handleRegister = async () => {
    if (!firstName.trim()) {
      setFirstNameError('Имя обязательно для заполнения');
      return;
    }
    setFirstNameError('');

    const result = await register(firstName.trim());
    if (result.success && result.token) {
      showAlert('Регистрация успешна', 'Добро пожаловать!', 'success');
      setShowRegistrationModal(false);
      onRegistrationSuccess?.(result.token);
    } else {
      showAlert('Ошибка регистрации', result.error || 'Не удалось зарегистрироваться', 'error');
    }
  };

  return (
    <div className="min-h-[280px] flex items-center justify-center">
      <div className="max-w-sm w-full text-center bg-white rounded-xl shadow-md px-7 py-10 flex flex-col items-center">
        <div className="text-6xl mb-3">🎉</div>
        <div className="text-lg text-green-700 font-semibold mb-2">Добро пожаловать в MiniPhone звонки!</div>
        {errorMsg !== 'Access denied' && <div className="text-gray-600 mb-6">{errorMsg}</div>}
        <button
          onClick={handleSubmitRequest}
          disabled={loading}
          className="bg-green-500 hover:bg-green-600 text-white px-7 py-3 rounded-lg text-base font-medium shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-300 disabled:opacity-50"
        >
          {loading ? 'Загрузка...' : 'Присоединиться'}
        </button>
      </div>
      {/* Модальное окно регистрации */}
      <Dialog open={showRegistrationModal} onOpenChange={setShowRegistrationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Окно входа в MiniPhone звонки!</DialogTitle>
            <DialogDescription className="mt-2">
              Ваше имя в системе, как будет отображаться в звонках.
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
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400 ${firstNameError ? 'border-red-500' : 'border-gray-300'}`}
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
              onClick={handleRegister}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isRegistering}
            >
              {isRegistering ? 'Регистрируем...' : 'Войти'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FriendlyRetryScreen;
