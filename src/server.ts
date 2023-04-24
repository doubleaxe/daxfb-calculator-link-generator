/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

import express from 'express';
import yargs from 'yargs';
import {AsyncDatabase} from 'promised-sqlite3';
import type {Server} from 'node:http';
import {terminate, onTerminate} from './terminator';
import database from './db';
import api from './api';

const args = yargs
    .strict()
    .options({
        port: {
            type: 'number',
            default: 8080,
        },
        host: {
            type: 'string',
            default: '0.0.0.0',
        },
        db: {
            type: 'string',
            default: ':memory:',
        },
    })
    .parseSync();

(async() => {
    const sqlite = await AsyncDatabase.open(args.db);
    onTerminate(() => sqlite.close());

    const db = database(sqlite);
    await db.prepare();

    const app = express();
    app.use(express.json());
    app.post('/api/:command', api);

    const server = await new Promise<Server>((resolve) => {
        const server0 = app.listen(args.port, args.host, function() {
            console.log(`listening ${args.host}:${args.port}`);
            resolve(server0);
        });
    });
    onTerminate(() => {
        return new Promise((resolve) => {
            server.close(resolve);
        });
    });
})()
.catch((err) => {
    const _err = err as Error;
    console.error(_err.stack ? _err.stack : _err);
    terminate('error');
});
