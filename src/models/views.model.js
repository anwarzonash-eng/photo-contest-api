import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";
import PhotoModel from "./photo.model.js";

const PhotoViewsModel = sequelize.define('Views', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: UserModel,
            key: 'id'
        }
    },
    photo_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: PhotoModel,
            key: 'id'
        },
        onDelete: 'CASCADE'
    },
    boostedStatus:{
        type: DataTypes.STRING,
        allowNull: true
    },
    boostedView: {
        type: DataTypes.BOOLEAN,
        allowNull: true
    }
},
    {
        tableName: 'Views',
        indexes: [
            {
                name: 'idx_views_photo_id',
                fields: ['photo_id'],
                using: 'BTREE',
                order: 'ASC',
                operator: 'NULLS LAST',
                concurrently: false,
                tablespace: 'pg_default',
            },
            {
                name: 'idx_views_user_id',
                fields: ['user_id'],
                using: 'BTREE',
                order: 'ASC',
                operator: 'NULLS LAST',
                concurrently: false, 
                tablespace: 'pg_default',
            },
            {
                name: 'idx_unique_userId_photoId',
                unique: true,
                fields: ['user_id', 'photo_id']
            }
        ]
    });

PhotoViewsModel.sync({alter:true});
export default PhotoViewsModel;