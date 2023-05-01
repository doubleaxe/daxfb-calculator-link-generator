/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

import type {Request, RequestHandler} from 'express';
import crypto from 'node:crypto';
import Hashids from 'hashids';
import jsonWebToken from 'jsonwebtoken';
import type {Models} from './db';
import {setTimeoutAsync} from './promise-util';
import type {Transaction} from '@sequelize/core';
import type {ConfigType} from './config';

class ApiError extends Error {
    constructor(reason: string, message: string) {
        super(message);
        this.name = reason;
    }
}

async function login(req: Request, models: Models, config: ConfigType) {
    const now = new Date();
    const ip = req.ip || req.socket?.remoteAddress || null;
    const [user] = await models.User.findOrCreate({
        where: {
            ip,
        },
        defaults: {
            ip,
            createdAt: now,
        },
    });
    const token = jsonWebToken.sign({}, config.secret, {
        subject: String(user.userId),
    });
    return {sessionId: token};
}

async function save(req: Request, models: Models, config: ConfigType) {
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
    let blueprintName: string | undefined = req.body.name;
    if(!blueprintName || typeof(blueprintName) !== 'string') {
        blueprintName = undefined;
    }
    if(blueprintName && (blueprintName.length > 255)) {
        blueprintName = blueprintName.substring(0, 255);
    }

    const now = new Date();

    let userId: number | undefined = undefined;
    try {
        const session = jsonWebToken.verify(sessionId, config.secret);
        if(typeof(session) === 'string')
            throw new Error('invalid token');
        const subject = session.sub;
        if(!subject || (typeof(subject) !== 'string'))
            throw new Error('invalid token');
        userId = Number(subject);
        if(!userId)
            throw new Error('invalid token');
    } catch(err) {
        await setTimeoutAsync(5000);
        throw new ApiError('err:session', 'invalid session');
    }

    //TODO - syntax check
    const blueprintHash = crypto.createHash('sha256').update(blueprintData).digest('base64');

    let transaction: Transaction | null = await models.sequelize.startUnmanagedTransaction();
    try {
        const user = await models.User.findByPk(userId);
        if(!user) {
            await transaction.rollback();
            transaction = null;
            await setTimeoutAsync(5000);
            throw new ApiError('err:session', 'user not found');
        }

        const [existingBlueprint, blueprintCreated] = await models.Blueprint.findOrCreate({
            where: {
                hash: blueprintHash,
                gameId,
            },
            defaults: {
                hash: blueprintHash,
                data: blueprintData,
                gameId,
            },
            transaction,
        });

        if(!blueprintCreated) {
            if(blueprintData != existingBlueprint.data) {
                throw new Error('hash collision');
            }
        }

        const [userBlueprint, userBlueprintCreated] = await models.UserBlueprint.findOrCreate({
            where: {
                userId,
                blueprintId: existingBlueprint.blueprintId,
            },
            defaults: {
                userId,
                blueprintId: existingBlueprint.blueprintId,
                blueprintName: blueprintName || null,
                createdAt: now,
                accessedAt: now,
            },
            transaction,
        });
        if(!userBlueprintCreated) {
            userBlueprint.set({
                accessedAt: new Date(),
            });
            if(blueprintName && (blueprintName !== userBlueprint.blueprintName)) {
                userBlueprint.set({
                    blueprintName,
                });
            }
            await userBlueprint.save({transaction});
        }
        const hashids = new Hashids(config.hashid, 7);
        const encodedBlueprintId = hashids.encode(userBlueprint.userBlueprintId);

        await transaction.commit();
        return {link: encodedBlueprintId};
    } catch(err) {
        if(transaction) {
            await transaction.rollback();
        }
        throw err;
    }
}

async function load(req: Request, models: Models, config: ConfigType) {
    const link: string = req.body.link;
    if(!link || typeof(link) !== 'string') {
        throw new ApiError('err.param', 'link is required');
    }
    const hashids = new Hashids(config.hashid, 7);
    const userBlueprintId = hashids.decode(link)[0] as number;
    if(!userBlueprintId) {
        throw new ApiError('err:link', 'invalid link');
    }
    const userBlueprint = await models.UserBlueprint.findByPk(userBlueprintId, {
        include: models.Blueprint,
    });
    const existingBlueprint = userBlueprint?.blueprint;
    if(!userBlueprint || !existingBlueprint) {
        throw new ApiError('err:link', 'invalid or deleted link');
    }

    userBlueprint.set({
        accessedAt: new Date(),
    });
    await userBlueprint.save();

    return {
        gameId: existingBlueprint.gameId,
        data: existingBlueprint.data,
        name: userBlueprint.blueprintName,
    };
}

const handlers: Record<string, (req: Request, models: Models, config: ConfigType) => Promise<unknown>> = {
    login,
    save,
    load,
};

export default function(models: Models, config: ConfigType) {
    const handle: RequestHandler = (req, res, next): void => {
        const command = req.params['command'];
        if(!command)
            return next() as undefined;
        const handler = handlers[command];
        if(!handler)
            return next() as undefined;

        handler(req, models, config).then((result: unknown) => {
            res.status(200).json(result);
        }).catch((err: Error) => {
            console.error(err);
            res.status(500).json({error: err.name || 'Error', message: err.message});
        });

        return undefined;
    };
    return handle;
}
