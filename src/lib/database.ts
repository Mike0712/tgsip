import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';

// Используем глобальный объект для хранения соединения (выживает при hot reload)
declare global {
  // eslint-disable-next-line no-var
  var __db_instance: Knex | undefined;
}

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment as keyof typeof knexConfig];

// Нормализуем конфигурацию для TypeScript
// Приводим к Knex.Config, так как knexfile.js может иметь неполную типизацию
const normalizedConfig = {
  ...config,
  connection: config.connection
    ? {
        ...config.connection,
        port: typeof config.connection.port === 'string' 
          ? parseInt(config.connection.port, 10) 
          : config.connection.port,
      }
    : undefined,
  pool: {
    ...(config.pool || {}),
    min: 2,
    max: 20, // Увеличиваем max для production
    acquireTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    reapIntervalMillis: 1000,
    createTimeoutMillis: 30000,
  },
} as Knex.Config;

// Singleton для database.ts
function getDatabaseInstance(): Knex {
  if (process.env.NODE_ENV === 'development') {
    if (!global.__db_instance) {
      global.__db_instance = knex(normalizedConfig);
    }
    return global.__db_instance;
  }

  // В production используем модульный singleton
  if (!(getDatabaseInstance as any).__instance) {
    (getDatabaseInstance as any).__instance = knex(normalizedConfig);
  }
  return (getDatabaseInstance as any).__instance;
}

export const db = getDatabaseInstance();

// Функция для закрытия соединений (можно вызвать при необходимости)
export async function closeDatabase(): Promise<void> {
  if (global.__db_instance) {
    await global.__db_instance.destroy();
    global.__db_instance = undefined;
  }
  if ((getDatabaseInstance as any).__instance) {
    await (getDatabaseInstance as any).__instance.destroy();
    (getDatabaseInstance as any).__instance = undefined;
  }
}

// Типы для базы данных
export interface User {
  id: number;
  telegram_id: string;
  username?: string;
  first_name: string;
  last_name?: string;
  language_code?: string;
  is_premium: boolean;
  photo_url?: string;
  last_seen: Date;
  agreement_accepted: boolean;
  agreement_accepted_at?: Date;
  deleted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  device_info?: string;
  ip_address?: string;
  expires_at: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SipAccount {
  id: number;
  user_id: number;
  sip_username: string;
  sip_password: string;
  sip_server: string;
  sip_port: number;
  is_active: boolean;
  settings?: any;
  created_at: Date;
  updated_at: Date;
}

export interface RegistrationRequest {
  id: number;
  telegram_id: string;
  username?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

export interface UserPhone {
  id: number;
  phone_id: number;
  user_id: number;
  created_at: Date;
  updated_at: Date;
  // Данные из связанной таблицы phones
  phone_number?: string;
  server_id?: number;
  active?: boolean;
  server_url?: string;
  server_ip?: string;
  server_port?: string;
}

// Функции для работы с пользователями
export const userService = {
  async findById(id: number, includeDeleted = false): Promise<User | null> {
    const query = db('users').where('id', id);
    if (!includeDeleted) {
      query.whereNull('deleted_at');
    }
    return await query.first();
  },

  async findByTelegramId(telegramId: string, includeDeleted = false): Promise<User | null> {
    const query = db('users').where('telegram_id', telegramId);
    if (!includeDeleted) {
      query.whereNull('deleted_at');
    }
    return await query.first();
  },

  async findByUsername(username: string, includeDeleted = false): Promise<User | null> {
    const query = db('users').where('username', username);
    if (!includeDeleted) {
      query.whereNull('deleted_at');
    }
    return await query.first();
  },

  async create(userData: Partial<User>): Promise<User> {
    const [user] = await db('users').insert({
      ...userData,
      agreement_accepted: userData.agreement_accepted ?? false,
    }).returning('*');
    return user;
  },

  async update(id: number, userData: Partial<User>): Promise<User> {
    const [user] = await db('users')
      .where('id', id)
      .whereNull('deleted_at')
      .update(userData)
      .returning('*');
    return user;
  },

  async updateLastSeen(id: number): Promise<void> {
    await db('users')
      .where('id', id)
      .whereNull('deleted_at')
      .update({ last_seen: new Date() });
  },

  async acceptAgreement(id: number): Promise<User> {
    const [user] = await db('users')
      .where('id', id)
      .whereNull('deleted_at')
      .update({
        agreement_accepted: true,
        agreement_accepted_at: new Date(),
      })
      .returning('*');
    return user;
  },

  async findAll(includeDeleted = false): Promise<User[]> {
    const query = db('users');
    if (!includeDeleted) {
      query.whereNull('deleted_at');
    }
    return await query.orderBy('created_at', 'desc');
  },

  async search(query: string, limit = 10, includeDeleted = false): Promise<User[]> {
    const trimmed = query.trim();

    if (!trimmed) {
      return [];
    }

    const sanitized = trimmed.replace(/[%_]/g, '\\$&');
    const safeLimit = Math.min(Math.max(limit ?? 10, 1), 25);

    const dbQuery = db('users')
      .where((builder) => {
        builder
          .whereRaw('telegram_id ILIKE ?', [`%${sanitized}%`])
          .orWhereRaw('username ILIKE ?', [`%${sanitized}%`])
          .orWhereRaw('first_name ILIKE ?', [`%${sanitized}%`])
          .orWhereRaw('last_name ILIKE ?', [`%${sanitized}%`]);
      });

    if (!includeDeleted) {
      dbQuery.whereNull('deleted_at');
    }

    return await dbQuery
      .orderBy('last_seen', 'desc')
      .limit(safeLimit);
  },

  /**
   * Soft delete пользователя - устанавливает deleted_at
   */
  async softDelete(id: number): Promise<User> {
    const [user] = await db('users')
      .where('id', id)
      .whereNull('deleted_at')
      .update({
        deleted_at: new Date(),
      })
      .returning('*');
    return user;
  },

  /**
   * Восстановление удаленного пользователя
   */
  async restore(id: number): Promise<User> {
    const [user] = await db('users')
      .where('id', id)
      .whereNotNull('deleted_at')
      .update({
        deleted_at: null,
      })
      .returning('*');
    return user;
  },

  /**
   * Полное удаление пользователя из базы (hard delete)
   * Использовать с осторожностью!
   */
  async hardDelete(id: number): Promise<boolean> {
    const deleted = await db('users')
      .where('id', id)
      .del();
    return deleted > 0;
  }
};

// Функции для работы с сессиями
export const sessionService = {
  async create(userId: number, token: string, expiresAt: Date, deviceInfo?: string, ipAddress?: string): Promise<Session> {
    // Если сессия с таким токеном уже существует, удаляем её (token уникален)
    await db('sessions').where('token', token).del();
    
    try {
      const result = await db('sessions').insert({
        user_id: userId,
        token,
        expires_at: expiresAt,
        device_info: deviceInfo,
        ip_address: ipAddress,
        is_active: true
      }).returning('*');
      
      if (!result || result.length === 0) {
        throw new Error('Failed to create session: no data returned from database');
      }
      
      const [session] = result;
      if (!session) {
        throw new Error('Failed to create session: session object is undefined');
      }
      
      return session;
    } catch (error: any) {
      // Логируем детали ошибки
      console.error('❌ Session creation error:', {
        userId,
        tokenLength: token.length,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetail: error.detail
      });
      throw error;
    }
  },

  async findByToken(token: string): Promise<Session | null> {
    return await db('sessions')
      .where('token', token)
      .where('is_active', true)
      .where('expires_at', '>', new Date())
      .first();
  },

  async deactivate(token: string): Promise<void> {
    await db('sessions').where('token', token).update({ is_active: false });
  },

  async cleanupExpired(): Promise<void> {
    await db('sessions').where('expires_at', '<', new Date()).update({ is_active: false });
  }
};

// Функции для работы с SIP аккаунтами
export const sipAccountService = {
  async findByUserId(userId: number): Promise<SipAccount[]> {
    return await db('sip_accounts').where('user_id', userId).where('is_active', true);
  },

  async findBySipUsername(sipUsername: string): Promise<SipAccount | null> {
    return await db('sip_accounts').where('sip_username', sipUsername).where('is_active', true).first();
  },

  async create(userId: number, sipData: Partial<SipAccount>): Promise<SipAccount> {
    const [account] = await db('sip_accounts').insert({
      user_id: userId,
      ...sipData
    }).returning('*');
    return account;
  },

  async update(id: number, sipData: Partial<SipAccount>): Promise<SipAccount> {
    const [account] = await db('sip_accounts').where('id', id).update(sipData).returning('*');
    return account;
  },

  async deactivate(id: number): Promise<void> {
    await db('sip_accounts').where('id', id).update({ is_active: false });
  }
};

// Функции для работы с заявками на регистрацию
export const registrationRequestService = {
  async create(telegramId: string, username?: string): Promise<RegistrationRequest> {
    // Не даем создать второй pending для того же telegram_id
    const existing = await db('registration_requests')
      .where({ telegram_id: telegramId, status: 'pending' })
      .first();
    if (existing) return existing;

    const [request] = await db('registration_requests')
      .insert({ telegram_id: telegramId, username, status: 'pending' })
      .returning('*');
    return request;
  },

  async findPendingByTelegramId(telegramId: string): Promise<RegistrationRequest | null> {
    return await db('registration_requests')
      .where({ telegram_id: telegramId, status: 'pending' })
      .first();
  },
};

// Функции для работы с телефонами пользователей
export const userPhoneService = {
  async findByUserId(userId: number): Promise<UserPhone[]> {
    return await db('user_phones')
      .select(
        'user_phones.id',
        'user_phones.phone_id',
        'user_phones.user_id',
        'user_phones.created_at',
        'user_phones.updated_at',
        'phones.number as phone_number',
        'phones.server_id',
        'phones.active',
        'servers.url as server_url',
        'servers.ip as server_ip',
        'servers.port as server_port'
      )
      .leftJoin('phones', 'user_phones.phone_id', 'phones.id')
      .leftJoin('servers', 'phones.server_id', 'servers.id')
      .where('user_phones.user_id', userId)
      .orderBy('user_phones.created_at', 'desc');
  },

  async create(userId: number, phoneId: number): Promise<UserPhone> {
    const [userPhone] = await db('user_phones')
      .insert({ user_id: userId, phone_id: phoneId })
      .returning('*');
    return userPhone;
  },

  async delete(id: number, userId: number): Promise<boolean> {
    const deleted = await db('user_phones')
      .where({ id, user_id: userId })
      .del();
    return deleted > 0;
  }
};

// Функции для работы с телефонией
export const telephonyService = {
  async findUserByDID(did: string): Promise<{ user_id: number; sip_username: string } | null> {
    const result = await db('user_phones')
      .select('users.id as user_id', 'sip_accounts.sip_username')
      .join('users', 'user_phones.user_id', 'users.id')
      .join('sip_accounts', function() {
        this.on('sip_accounts.user_id', '=', 'users.id')
          .andOn('sip_accounts.is_active', '=', db.raw('?', [true]));
      })
      .join('phones', 'user_phones.phone_id', 'phones.id')
      .where('phones.number', did)
      .first();
    
    return result || null;
  }
};
