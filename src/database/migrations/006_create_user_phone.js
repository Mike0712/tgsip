exports.up = async (knex) => {
  return await knex.schema.createTable('user_phones', (table) => {
    table.increments('id').primary();
    table.integer('phone_id').references('id').inTable('phones').notNullable();
    table.integer('user_id').references('id').inTable('users').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = async (knex) => {
  await knex.schema.dropTable('user_phones');
};