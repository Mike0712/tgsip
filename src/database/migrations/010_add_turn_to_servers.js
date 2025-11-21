exports.up = async (knex) => {
    return await knex.schema.alterTable('servers', (table) => {
        table.string('turn_server').nullable();
    });
};

exports.down = async (knex) => {
    return await knex.schema.alterTable('servers', (table) => {
        table.dropColumn('turn_server');
    });
};

