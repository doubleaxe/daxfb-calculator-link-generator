/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

import type {Request, RequestHandler} from 'express';
import crypto from 'node:crypto';
import Hashids from 'hashids';
import type {Models} from './db';
import {setTimeoutAsync} from './promise-util';

class ApiError extends Error {
    constructor(reason: string, message: string) {
        super(message);
        this.name = reason;
    }
}

async function login(req: Request, models: Models) {
    const ip = req.ip || req.socket?.remoteAddress || null;
    for(let i = 0; i < 10; i++) {
        const sessionId = crypto.randomBytes(32).toString('base64');
        const session = await models.Session.findOne({
            where: {
                session: sessionId,
            },
        });
        if(!session) {
            await models.Session.create({
                session: sessionId,
                ip,
                createdAt: new Date(),
                accessedAt: new Date(),
            });
            return {sessionId};
        }
    }
    throw new ApiError('err:session', 'cannot create session');
}

let HASH_SALT = '';
async function save(req: Request, models: Models) {
    const sessionId: string = req.body.sessionId;
    if(!sessionId || typeof(sessionId) !== 'string') {
        throw new ApiError('err.param', 'sessionId is required');
    }
    const gameId: string = req.body.gameId;
    if(!gameId || typeof(gameId) !== 'string') {
        throw new ApiError('err.param', 'gameId is required');
    }
    const blueprintData: string = req.body.data;
    if(!blueprintData || typeof(blueprintData) !== 'string') {
        throw new ApiError('err.param', 'data is required');
    }
    if(blueprintData.length > 20480) {
        throw new ApiError('err.param', 'data is too large');
    }
    //TODO - syntax check
    const blueprintHash = crypto.createHash('sha256').update(blueprintData).digest('base64');

    const transaction = await models.sequelize.startUnmanagedTransaction();
    try {
        const session = await models.Session.findOne({
            where: {
                session: sessionId,
            },
            transaction,
        });
        if(!session) {
            await transaction.rollback();
            await setTimeoutAsync(5000);
            throw new ApiError('err:session', 'session not found');
        }
        session.set({
            accessedAt: new Date(),
        });
        await session.save({transaction});

        let existingBlueprint = await models.Blueprint.findOne({
            where: {
                hash: blueprintHash,
                gameId,
            },
            transaction,
        });
        if(!existingBlueprint) {
            existingBlueprint = await models.Blueprint.create({
                hash: blueprintHash,
                data: blueprintData,
                gameId,
                createdAt: new Date(),
                accessedAt: new Date(),
            }, {transaction});
        } else {
            if(blueprintData != existingBlueprint.data) {
                throw new Error('hash collision');
            }
            existingBlueprint.set({
                accessedAt: new Date(),
            });
            await existingBlueprint.save({transaction});
        }

        const hasBlueprint = await session.hasBlueprint(existingBlueprint.blueprintId, {transaction});
        if(!hasBlueprint) {
            await session.addBlueprint(existingBlueprint.blueprintId, {transaction});
        }
        const hashids = new Hashids(HASH_SALT, 7);
        const encodedBlueprintId = hashids.encode(existingBlueprint.blueprintId);

        await transaction.commit();
        return {link: encodedBlueprintId};
    } catch(err) {
        await transaction.rollback();
        throw err;
    }
}

async function load(req: Request, models: Models) {
    const link: string = req.body.link;
    if(!link || typeof(link) !== 'string') {
        throw new ApiError('err.param', 'link is required');
    }
    const hashids = new Hashids(HASH_SALT, 7);
    const blueprintId = hashids.decode(link)[0] as number;
    if(!blueprintId) {
        throw new ApiError('err:link', 'invalid link');
    }
    const existingBlueprint = await models.Blueprint.findByPk(blueprintId);
    if(!existingBlueprint) {
        throw new ApiError('err:link', 'invalid or deleted link');
    }

    existingBlueprint.set({
        accessedAt: new Date(),
    });
    await existingBlueprint.save();
    return {
        gameId: existingBlueprint.gameId,
        data: existingBlueprint.data,
    };
}

const handlers: Record<string, (req: Request, models: Models) => Promise<unknown>> = {
    login,
    save,
    load,
};

export default function(models: Models, _salt: string) {
    HASH_SALT = _salt;
    const handle: RequestHandler = (req, res, next): void => {
        const command = req.params['command'];
        if(!command)
            return next() as undefined;
        const handler = handlers[command];
        if(!handler)
            return next() as undefined;

        handler(req, models).then((result: unknown) => {
            res.status(200).json(result);
        }).catch((err: Error) => {
            console.error(err);
            res.status(500).json({error: err.name || 'Error', message: err.message});
        });

        return undefined;
    };
    return handle;
}
