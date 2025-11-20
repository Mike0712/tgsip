// src/pages/admin.tsx
import React, { useState } from 'react';
import { useAuth } from '@/shared/lib/hooks/useAuth';

const Admin = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [newUser, setNewUser] = useState({
    telegram_id: '',
    username: '',
    first_name: '',
    last_name: ''
  });
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Получить список пользователей
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  // Добавить нового пользователя
  const addUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(newUser)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('✅ Пользователь успешно добавлен!');
        setNewUser({ telegram_id: '', username: '', first_name: '', last_name: '' });
        fetchUsers(); // Обновляем список
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  // Загружаем пользователей при монтировании
  React.useEffect(() => {
    if (isAuthenticated) {
      fetchUsers();
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">🔒 Доступ запрещен</h1>
          <p className="text-gray-600">Необходима аутентификация</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">👥 Управление пользователями</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Привет, {user?.first_name}!
              </span>
              <button
                onClick={logout}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Выйти
              </button>
            </div>
          </div>

          {/* Форма добавления пользователя */}
          <form onSubmit={addUser} className="mb-8">
            <h2 className="text-lg font-semibold mb-4">➕ Добавить пользователя</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telegram ID *
                </label>
                <input
                  type="text"
                  required
                  value={newUser.telegram_id}
                  onChange={(e) => setNewUser({ ...newUser, telegram_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="123456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Имя *
                </label>
                <input
                  type="text"
                  required
                  value={newUser.first_name}
                  onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Иван"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Фамилия
                </label>
                <input
                  type="text"
                  value={newUser.last_name}
                  onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Иванов"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Добавление...' : 'Добавить пользователя'}
            </button>
          </form>

          {message && (
            <div className={`p-4 rounded-lg mb-6 ${
              message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {message}
            </div>
          )}

          {/* Список пользователей */}
          <div>
            <h2 className="text-lg font-semibold mb-4">📋 Список пользователей ({users.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-4 py-2 text-left">ID</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Telegram ID</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Username</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Имя</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Последний вход</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">Создан</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="border border-gray-300 px-4 py-2">{user.id}</td>
                      <td className="border border-gray-300 px-4 py-2">{user.telegram_id}</td>
                      <td className="border border-gray-300 px-4 py-2">@{user.username || '-'}</td>
                      <td className="border border-gray-300 px-4 py-2">
                        {user.first_name} {user.last_name || ''}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {user.last_seen ? new Date(user.last_seen).toLocaleString() : '-'}
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        {new Date(user.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;
