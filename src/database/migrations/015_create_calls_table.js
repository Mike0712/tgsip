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
    // Only set for calls that went through asterserver's ARI/Stasis pipeline
    // (incoming calls) — outgoing calls are reported directly by the mobile
    // client (sip.js session state), which never sees an Asterisk bridge id.
    table.string('bridge_id');
    // The other party's number — caller for incoming, dialed number for
    // outgoing (direction tells you which).
    table.string('remote_number').notNullable();
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
