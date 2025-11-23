import knex, { Knex } from 'knex';

// Используем глобальный объект для хранения соединения (выживает при hot reload)
declare global {
  // eslint-disable-next-line no-var
  var __db: Knex | undefined;
}

let db: Knex | null = null;

export function getDb(): Knex {
  // В development при hot reload используем глобальный объект
  if (process.env.NODE_ENV === 'development') {
    if (!global.__db) {
      global.__db = createKnexInstance();
    }
    return global.__db;
  }

  // В production используем обычный singleton
  if (!db) {
    db = createKnexInstance();
  }

  return db;
}

function createKnexInstance(): Knex {
  const config: Knex.Config = {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'miniphone_dev',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
    },
    pool: {
      min: 2,
      max: 10,
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createTimeoutMillis: 30000,
    },
  };

  return knex(config);
}

// Функция для закрытия соединений (можно вызвать при необходимости)
export async function closeDb(): Promise<void> {
  if (db) {
    await db.destroy();
    db = null;
  }
  if (global.__db) {
    await global.__db.destroy();
    global.__db = undefined;
  }
}

