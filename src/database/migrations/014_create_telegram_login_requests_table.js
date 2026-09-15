exports.up = function(knex) {
  return knex.schema.createTable('telegram_login_requests', function(table) {
    table.increments('id').primary();
    table.string('token').notNullable().unique();
    table.string('status').notNullable().defaultTo('pending'); // pending | confirmed | not_found | expired
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('SET NULL');
    table.text('jwt_token');
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);

    table.index(['token', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('telegram_login_requests');
};
