exports.up = async function up(knex) {
    await knex.transaction(async (trx) => {
      await trx.schema.createTable('servers', (t) => {
        t.increments('id').primary();
        t.string('url').notNullable();
        t.string('ip').notNullable();
        t.string('port').notNullable();
        t.timestamps(true, true);
        t.unique(['url']);
      });
  
      await trx.schema.createTable('phones', (t) => {
        t.increments('id').primary();
        t
          .integer('server_id')
          .unsigned()
          .notNullable()
          .references('id')
          .inTable('servers')
          .onDelete('CASCADE');
        t.string('number').notNullable();
        t.boolean('active').notNullable().defaultTo(true);
        t.timestamps(true, true);
        t.unique(['server_id', 'number']);
        t.index(['server_id', 'active']);
      });
    });
  };
  
  exports.down = async function down(knex) {
    await knex.transaction(async (trx) => {
      await trx.schema.dropTableIfExists('phones');
      await trx.schema.dropTableIfExists('servers');
    });
  };