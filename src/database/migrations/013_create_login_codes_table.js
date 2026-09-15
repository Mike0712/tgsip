exports.up = function(knex) {
  return knex.schema.createTable('login_codes', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('code').notNullable();
    table.string('status').notNullable().defaultTo('pending'); // pending | used
    table.timestamp('expires_at').notNullable();
    table.timestamps(true, true);

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['user_id', 'code', 'status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('login_codes');
};
