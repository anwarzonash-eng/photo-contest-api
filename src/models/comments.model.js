import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import {UserModel, PhotoModel} from "../models";

const CommentsModel = sequelize.define('Comments', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
     },
    user_id: {
        type: DataTypes.UUID,
        allowNull:false
    },
    photo_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    top_comment_id:{
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: '00000000-0000-0000-0000-000000000000'
    },
    sub_comment_id: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: '00000000-0000-0000-0000-000000000000'
    }, 
    comment_text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    status:{
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    }
},
{
    indexes: [
        {
            name: 'idx_comments_photoId_topComment',
            using: 'BTREE',
            fields: ['photo_id', 'top_comment_id', 'isDeleted']
        },
        {
            name: 'idx_comments_userId',
            using: 'BTREE',
            fields: ['user_id']
        }
    ]
});

UserModel.hasMany(CommentsModel, {
    foreignKey: 'user_id'
  });
CommentsModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

PhotoModel.hasMany(CommentsModel, {
    foreignKey: 'photo_id'
  });
CommentsModel.belongsTo(PhotoModel, {
    foreignKey: 'photo_id'
});


export default CommentsModel