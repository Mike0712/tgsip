exports.up = function(knex) {
  return knex.schema.table('users', function(table) {
    // Поле для принятия соглашения
    table.boolean('agreement_accepted').defaultTo(false).notNullable();
    table.timestamp('agreement_accepted_at');
    
    // Поле для soft delete
    table.timestamp('deleted_at').nullable();
    
    // Индекс для быстрого поиска активных пользователей
    table.index('deleted_at');
  });
};

exports.down = function(knex) {
  return knex.schema.table('users', function(table) {
    table.dropColumn('agreement_accepted');
    table.dropColumn('agreement_accepted_at');
    table.dropColumn('deleted_at');
  });
};

