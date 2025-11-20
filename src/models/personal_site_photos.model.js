import { sequelize } from "../utils/database.js";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";


const PersonalPhotoModel = sequelize.define('personal_photos', {
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
        allowNull: true
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
    source:{
        type:DataTypes.STRING,
        allowNull:false
    },
    isUploaded:{
        type: DataTypes.BOOLEAN,
        allowNull: false
    },
    eventId:{
        type:DataTypes.UUID,
        allowNull:true
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    isActive:{
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    sort_order:{
        type: DataTypes.INTEGER,  
        allowNull: true
    },
    is_cover_photo:{
        type: DataTypes.BOOLEAN,  
        allowNull: true,
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
    timestamps: true
});

UserModel.hasMany(PersonalPhotoModel, {
    foreignKey: 'user_id'
});

PersonalPhotoModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

PersonalPhotoModel.sync({ alter: true });


export default PersonalPhotoModel;