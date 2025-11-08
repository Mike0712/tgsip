exports.up = function (knex) {
  return knex.schema
    .createTable('call_sessions', function (table) {
      table.increments('id').primary();
      table.string('bridge_id').notNullable();
      table.string('link_hash').notNullable();
      table
        .enu('status', ['pending', 'active', 'completed', 'failed', 'terminated'])
        .notNullable()
        .defaultTo('pending');
      table
        .integer('server_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('servers')
        .onDelete('CASCADE');
      table
        .integer('creator_user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
      table.json('metadata');
      table.timestamps(true, true);

      table.unique('bridge_id');
      table.unique('link_hash');
      table.index(['server_id', 'status']);
    })
    .createTable('call_session_participants', function (table) {
      table.increments('id').primary();
      table
        .integer('session_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('call_sessions')
        .onDelete('CASCADE');
      table
        .integer('user_id')
        .unsigned()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
      table.string('endpoint').notNullable();
      table.enu('role', ['initiator', 'participant']).defaultTo('participant');
      table.enu('status', ['pending', 'dialing', 'joined', 'failed', 'left']).defaultTo('pending');
      table.timestamp('joined_at');
      table.timestamp('left_at');
      table.json('metadata');
      table.timestamps(true, true);

      table.index(['session_id', 'status']);
      table.index(['user_id']);
    });
};

exports.down = function (knex) {
  return knex.schema
    .dropTableIfExists('call_session_participants')
    .dropTableIfExists('call_sessions');
};


