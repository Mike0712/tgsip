exports.up = function(knex) {
  return knex.schema.createTable('push_tokens', function(table) {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable();
    table.string('fcm_token').notNullable();
    table.string('platform').notNullable().defaultTo('android');
    table.timestamps(true, true);

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('push_tokens');
};
