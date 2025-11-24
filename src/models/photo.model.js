import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";

const PhotoModel = sequelize.define('Photo', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull:false
    },
    photo_url: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    compressedImageUrl:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    compressedImageId:{
        type:DataTypes.STRING,
        allowNull:true
    },
    description:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    feedback_type:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    metadata:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    genres_list:{
        type: DataTypes.STRING,
        allowNull: true,
    },
    isQueued:{
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    isFreezed:{
        type: DataTypes.BOOLEAN,
        allowNull: true
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
    },
    weekDay:{
        type: DataTypes.STRING,
        allowNull: true
    },
    day:{
        type: DataTypes.STRING,
        allowNull: true
    },
    isComingNext:{
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    comingNextAt:{
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue:null
    },
    boostedWeeklyPhoto:{
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'Out of Time',
    },
    boostedTime:{
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue:null
    },
    isWeeklyTopTen:{
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    createdAt: {
        type: DataTypes.STRING, 
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"), 
    },
    updatedAt: {
        type: DataTypes.STRING,  
        defaultValue:  Sequelize.literal("CURRENT_TIMESTAMP"), 
    }
}, {
    timestamps: true,
    indexes: [
      {
        name: 'idx_photos_user_id',
        using: 'BTREE',
        fields: ['user_id'],
        order: [['user_id', 'ASC']],
        nullsLast: true
      }
    ],
});

UserModel.hasMany(PhotoModel, {
    foreignKey: 'user_id'
  });
PhotoModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
  });

PhotoModel.sync({ alter: true });


export default PhotoModel