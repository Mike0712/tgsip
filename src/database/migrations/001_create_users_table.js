// src/database/migrations/001_create_users_table.js
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.increments('id').primary();
    table.string('telegram_id').unique().notNullable();
    table.string('username').unique();
    table.string('first_name').notNullable();
    table.string('last_name');
    table.string('language_code', 10);
    table.boolean('is_premium').defaultTo(false);
    table.string('photo_url');
    table.timestamp('last_seen').defaultTo(knex.fn.now());
    table.timestamps(true, true);
    
    // Индексы для быстрого поиска
    table.index('telegram_id');
    table.index('username');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('users');
};
