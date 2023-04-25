/*
Author: Alexey Usov (dax@xdax.ru, https://github.com/doubleaxe)
Please don't remove this comment if you use unmodified file
*/

import type {
    CreationOptional,
    InferAttributes,
    InferCreationAttributes,
    Sequelize,
    BelongsToManyGetAssociationsMixin,
    BelongsToManyCountAssociationsMixin,
    BelongsToManyHasAssociationMixin,
    BelongsToManyHasAssociationsMixin,
    BelongsToManySetAssociationsMixin,
    BelongsToManyAddAssociationMixin,
    BelongsToManyAddAssociationsMixin,
    BelongsToManyRemoveAssociationMixin,
    BelongsToManyRemoveAssociationsMixin,
    BelongsToManyCreateAssociationMixin,
} from '@sequelize/core';
import {
    Model,
    DataTypes,
} from '@sequelize/core';

class Blueprint extends Model<InferAttributes<Blueprint>, InferCreationAttributes<Blueprint>> {
    declare blueprintId: CreationOptional<number>;
    declare data: string;
    declare hash: string;
    declare gameId: string;
    declare link: string | null;
    declare createdAt: Date;
    declare accessedAt: Date;

    declare getSessions: BelongsToManyGetAssociationsMixin<Session>;
}

class Session extends Model<InferAttributes<Session>, InferCreationAttributes<Session>> {
    declare sessionId: CreationOptional<number>;
    declare ip: string | null;
    declare session: string;
    declare createdAt: Date;
    declare accessedAt: Date;

    declare getBlueprints: BelongsToManyGetAssociationsMixin<Blueprint>;
    declare countBlueprints: BelongsToManyCountAssociationsMixin<Blueprint>;
    declare hasBlueprint: BelongsToManyHasAssociationMixin<Blueprint, number>;
    declare hasBlueprints: BelongsToManyHasAssociationsMixin<Blueprint, number>;
    declare setBlueprints: BelongsToManySetAssociationsMixin<Blueprint, number>;
    declare addBlueprint: BelongsToManyAddAssociationMixin<Blueprint, number>;
    declare addBlueprints: BelongsToManyAddAssociationsMixin<Blueprint, number>;
    declare removeBlueprint: BelongsToManyRemoveAssociationMixin<Blueprint, number>;
    declare removeBlueprints: BelongsToManyRemoveAssociationsMixin<Blueprint, number>;
    declare createBlueprint: BelongsToManyCreateAssociationMixin<Blueprint>;
}

export async function registerModels(sequelize: Sequelize) {
    Blueprint.init({
        blueprintId: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
        },
        data: {
            type: DataTypes.STRING(20480),
            allowNull: false,
        },
        hash: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        gameId: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        link: {
            type: DataTypes.STRING(1024),
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        accessedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        sequelize,
        indexes: [{
            unique: true,
            fields: ['game_id', 'hash'],
        }],
        updatedAt: false,
    });

    Session.init({
        sessionId: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
        },
        ip: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        session: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        accessedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {sequelize, updatedAt: false});

    const SessionBlueprint = Session.belongsToMany(Blueprint, {through: 'BlueprintSession', otherKey: 'blueprintId', foreignKey: 'sessionId'});

    await sequelize.sync({alter: true});

    return {
        Blueprint,
        Session,
        SessionBlueprint,
        sequelize,
    };
}
export type Models = Awaited<ReturnType<typeof registerModels>>;
