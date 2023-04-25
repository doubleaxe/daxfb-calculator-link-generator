/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

import express from 'express';
import yargs from 'yargs';
import {Sequelize} from '@sequelize/core';
import cors from 'cors';
import type {Server} from 'node:http';
import {terminate, onTerminate} from './terminator';
import {registerModels} from './db';
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
        proxy: {
            type: 'string',
            default: 'loopback',
        },
        salt: {
            type: 'string',
            default: 'daxfb-calculator-link-generator',
        },
    })
    .parseSync();

(async() => {
    const sequelize = new Sequelize({
        dialect: 'sqlite',
        storage: args.db,
        define: {
            underscored: true,
        },
        disableClsTransactions: true,
    });
    await sequelize.authenticate();
    await sequelize.query('PRAGMA journal_mode=WAL;');
    onTerminate(() => sequelize.close());

    const models = await registerModels(sequelize);

    const app = express();
    app.use(express.json());
    app.use(cors({
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
    }));
    app.disable('x-powered-by');
    app.set('trust proxy', args.proxy);
    app.post('/linkapi/:command', api(models, args.salt));

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
