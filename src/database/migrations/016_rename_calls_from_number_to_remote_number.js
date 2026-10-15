// 015_create_calls_table.js was edited in place after it had already run
// against the live DB (renaming from_number -> remote_number, dropping
// bridge_id's NOT NULL) — Knex tracks applied migrations by filename, so
// that edit never actually reached the database. This migration applies
// the same change for real via ALTER TABLE.
exports.up = function (knex) {
  return knex.schema.alterTable('calls', function (table) {
    table.renameColumn('from_number', 'remote_number');
    table.string('bridge_id').nullable().alter();
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('calls', function (table) {
    table.renameColumn('remote_number', 'from_number');
    table.string('bridge_id').notNullable().alter();
  });
};
