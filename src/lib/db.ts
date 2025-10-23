import knex, { Knex } from 'knex';

let db: Knex | null = null;

export function getDb(): Knex {
  if (!db) {
    const config = {
      client: 'postgresql',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'miniphone_dev',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
      },
    };

    db = knex(config);
  }

  return db;
}

