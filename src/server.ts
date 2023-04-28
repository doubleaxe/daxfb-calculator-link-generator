/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

import express from 'express';
import yargs from 'yargs';
import {Sequelize, type Options as SequelizeOptions} from '@sequelize/core';
import cors from 'cors';
import type {Server} from 'node:http';
import {terminate, onTerminate} from './terminator';
import {registerModels} from './db';
import api from './api';
import {loadConfig} from './config';

const args = yargs
    .strict()
    .options({
        port: {
            type: 'number',
        },
        host: {
            type: 'string',
        },
        config: {
            type: 'string',
        },
        db: {
            type: 'string',
        },
        proxy: {
            type: 'string',
        },
        secret: {
            type: 'string',
        },
    })
    .parseSync();

(async() => {
    const config = loadConfig(args.config, args);

    let sequelize: Sequelize;
    const sequelizeOptions: SequelizeOptions = {
        define: {
            underscored: true,
            updatedAt: false,
        },
        disableClsTransactions: true,
    };
    if(config.db === 'sqlite::memory:') {
        //strange! 'sqlite::memory:' url gives 'no such table: users'
        //like in memory table is dropped in between
        sequelize = new Sequelize({
            dialect: 'sqlite',
            storage: ':memory:',
            ...sequelizeOptions,
        });
    } else {
        sequelize = new Sequelize(config.db, sequelizeOptions);
    }

    await sequelize.authenticate();
    if(sequelize.getDialect() == 'sqlite') {
        await sequelize.query('PRAGMA journal_mode=WAL;');
    }
    onTerminate(() => sequelize.close());

    const models = await registerModels(sequelize);

    const app = express();
    app.use(express.json());
    app.use(cors({
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type'],
    }));
    app.disable('x-powered-by');
    app.set('trust proxy', config.proxy);
    app.post('/linkapi/:command', api(models, config));

    const server = await new Promise<Server>((resolve) => {
        const server0 = app.listen(config.port, config.host, function() {
            console.log(`listening ${config.host}:${config.port}`);
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
