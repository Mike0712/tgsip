// src/database/migrations/003_create_sip_accounts_table.js
exports.up = function(knex) {
  return knex.schema.createTable('sip_accounts', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('sip_username').notNullable();
    table.string('sip_password').notNullable();
    table.integer('server_id').unsigned().notNullable();
    table.boolean('is_active').defaultTo(true);
    table.json('settings'); // Дополнительные настройки SIP
    table.timestamps(true, true);
    
    // Внешний ключ
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('server_id').references('id').inTable('servers').onDelete('CASCADE');
    // Индексы
    table.index('user_id');
    table.index('sip_username');
    table.unique(['user_id', 'sip_username']); // Один пользователь может иметь несколько SIP аккаунтов
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('sip_accounts');
};
