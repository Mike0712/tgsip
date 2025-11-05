exports.up = async (knex) => {
  return await knex.schema.alterTable('servers', (table) => {
    table.integer('web_port').nullable();
  });
};

exports.down = async (knex) => {
  return await knex.schema.alterTable('servers', (table) => {
    table.dropColumn('web_port');
  });
};

