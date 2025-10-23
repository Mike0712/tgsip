import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment as keyof typeof knexConfig];

export const db = knex(config as Knex.Config);

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
  async findByTelegramId(telegramId: string): Promise<User | null> {
    return await db('users').where('telegram_id', telegramId).first();
  },

  async findByUsername(username: string): Promise<User | null> {
    return await db('users').where('username', username).first();
  },

  async create(userData: Partial<User>): Promise<User> {
    const [user] = await db('users').insert(userData).returning('*');
    return user;
  },

  async update(id: number, userData: Partial<User>): Promise<User> {
    const [user] = await db('users').where('id', id).update(userData).returning('*');
    return user;
  },

  async updateLastSeen(id: number): Promise<void> {
    await db('users').where('id', id).update({ last_seen: new Date() });
  },

  async findAll(): Promise<User[]> {
    return await db('users').orderBy('created_at', 'desc');
  }
};

// Функции для работы с сессиями
export const sessionService = {
  async create(userId: number, token: string, expiresAt: Date, deviceInfo?: string, ipAddress?: string): Promise<Session> {
    const [session] = await db('sessions').insert({
      user_id: userId,
      token,
      expires_at: expiresAt,
      device_info: deviceInfo,
      ip_address: ipAddress
    }).returning('*');
    return session;
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
