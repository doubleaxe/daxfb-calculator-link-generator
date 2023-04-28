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
    NonAttribute,
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
    declare createdAt: Date;
    declare accessedAt: Date;
}

class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
    declare userId: CreationOptional<number>;
    declare ip: string | null;
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

class UserBlueprint extends Model<InferAttributes<UserBlueprint>, InferCreationAttributes<UserBlueprint>> {
    declare userBlueprintId: CreationOptional<number>;
    declare userId: number;
    declare blueprintId: number;
    declare blueprintName: string | null;
    declare createdAt: Date;
    declare accessedAt: Date;

    declare blueprint?: NonAttribute<Blueprint>;
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
        modelName: 'blueprint',
        indexes: [{
            unique: true,
            fields: ['game_id', 'hash'],
        }],
    });

    User.init({
        userId: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
        },
        ip: {
            type: DataTypes.STRING(255),
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
        modelName: 'user',
        sequelize,
    });

    UserBlueprint.init({
        userBlueprintId: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
        },
        userId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        blueprintId: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },
        blueprintName: {
            type: DataTypes.STRING(255),
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
        },
    }, {
        modelName: 'user_blueprint',
        sequelize,
    });

    User.belongsToMany(Blueprint, {through: UserBlueprint, otherKey: 'blueprintId', foreignKey: 'userId'});

    await sequelize.sync({alter: true});

    return {
        Blueprint,
        User,
        UserBlueprint,
        sequelize,
    };
}
export type Models = Awaited<ReturnType<typeof registerModels>>;
