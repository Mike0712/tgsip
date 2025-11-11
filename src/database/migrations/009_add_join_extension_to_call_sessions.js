const generateExtension = () => `010${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;

exports.up = async function up(knex) {
  await knex.schema.table('call_sessions', (table) => {
    table.string('join_extension');
  });

  const rows = await knex('call_sessions').select('id');
  const used = new Set();

  for (const row of rows) {
    let ext = generateExtension();
    while (used.has(ext)) {
      ext = generateExtension();
    }
    used.add(ext);

    await knex('call_sessions')
      .where({ id: row.id })
      .update({
        join_extension: ext,
        updated_at: knex.fn.now(),
      });
  }

  await knex.schema.alterTable('call_sessions', (table) => {
    table.string('join_extension').notNullable().alter();
    table.unique(['join_extension']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.table('call_sessions', (table) => {
    table.dropUnique(['join_extension']);
    table.dropColumn('join_extension');
  });
};
