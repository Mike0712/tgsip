exports.up = function(knex) {
  return knex.schema.createTable('registration_requests', function(table) {
    table.increments('id').primary();
    table.string('telegram_id').notNullable();
    table.string('username');
    table.string('status').notNullable().defaultTo('pending'); // pending | approved | rejected
    table.timestamps(true, true);

    table.unique(['telegram_id', 'status']); // один активный pending на telegram_id
    table.index('telegram_id');
    table.index('status');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('registration_requests');
};


