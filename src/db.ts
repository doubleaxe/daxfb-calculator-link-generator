/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

import type {AsyncDatabase} from 'promised-sqlite3';

function database(db: AsyncDatabase) {
    async function prepare() {

    }

    return {
        prepare,
    };
}

export type Database = ReturnType<typeof database>;
export default database;
