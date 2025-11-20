import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";
import PhotoModel from "./photo.model.js";

const VoteModel = sequelize.define('Votes', {
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
        allowNull:false
    },
    status:{
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    is_vote:{
        type: DataTypes.BOOLEAN,
        allowNull: true
    }
}, {
        indexes: [{
            name: 'idx_votes_photo_id',
            using: 'BTREE',
            fields: ['photo_id'],
            order: [['photo_id', 'ASC']],
            nullsLast: true
        },
        {
            name: 'idx_votes_userId_isVote',
            fields: ['user_id', 'is_vote']
        },
        {
            name: 'idx_votes_user_photo_isvote',  // composite index 
            using: 'BTREE',
            fields: ['user_id', 'photo_id', 'is_vote'] 
        }
    ]
});

UserModel.hasMany(VoteModel, {
    foreignKey: 'user_id'
  });
VoteModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

PhotoModel.hasMany(VoteModel, {
    foreignKey: 'photo_id'
  });
VoteModel.belongsTo(PhotoModel, {
    foreignKey: 'photo_id'
});


export default VoteModel