import { db as databaseDb } from './database';

/**
 * Получить экземпляр базы данных
 * Использует тот же singleton, что и database.ts для избежания дублирования соединений
 */
export function getDb() {
  return databaseDb;
}

// Функция для закрытия соединений (можно вызвать при необходимости)
export async function closeDb(): Promise<void> {
  const { closeDatabase } = await import('./database');
  await closeDatabase();
}

