// Our own side of the call, paired with remote_number: the number that was
// dialed for incoming calls (DID), the Caller ID we presented for outgoing
// ones. Nullable — rows created before this migration never had it, and
// outgoing calls placed without a selected Caller ID don't either.
exports.up = function (knex) {
  return knex.schema.alterTable('calls', function (table) {
    table.string('local_number');
  });
};

exports.down = function (knex) {
  return knex.schema.alterTable('calls', function (table) {
    table.dropColumn('local_number');
  });
};
