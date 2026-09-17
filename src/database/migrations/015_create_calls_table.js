exports.up = function (knex) {
  return knex.schema.createTable('calls', function (table) {
    table.increments('id').primary();
    table
      .integer('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.enu('direction', ['incoming', 'outgoing']).notNullable();
    table.string('bridge_id').notNullable();
    table.string('from_number').notNullable();
    table.string('sip_user');
    table
      .enu('status', ['ringing', 'answered', 'missed', 'failed'])
      .notNullable()
      .defaultTo('ringing');
    table.timestamp('started_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('answered_at');
    table.timestamp('ended_at');
    table.integer('duration_seconds');
    table.json('metadata');
    table.timestamps(true, true);

    table.index(['user_id', 'started_at']);
    table.index('bridge_id');
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists('calls');
};
