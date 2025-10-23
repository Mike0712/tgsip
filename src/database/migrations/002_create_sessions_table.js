// src/database/migrations/002_create_sessions_table.js
exports.up = function(knex) {
  return knex.schema.createTable('sessions', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('token').unique().notNullable();
    table.string('device_info');
    table.string('ip_address');
    table.timestamp('expires_at').notNullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    
    // Внешний ключ
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Индексы
    table.index('user_id');
    table.index('token');
    table.index('expires_at');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('sessions');
};
