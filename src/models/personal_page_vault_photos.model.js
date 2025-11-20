import {sequelize}  from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';


const PersonalPageVaultPhotosModel = sequelize.define('personal_photos_vault', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull:false
    },
    user_id: {             
        type: DataTypes.UUID,
        allowNull:false
    },
    folder_id:{
        type: DataTypes.UUID,
        allowNull: true
    },
    batch_id:{
        type: DataTypes.UUID,
        allowNull: false
    },
    photo_url: {
        type: DataTypes.STRING,
        allowNull: false    
    },
    backBlazeImageUrl:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    compressedImageUrl:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    compressedImageId:{
        type:DataTypes.STRING,
        allowNull:true
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }   
}, 
{
    tableName: 'personal_photos_vault',
    timestamps: true,
});



PersonalPageVaultPhotosModel.sync({alter:true});

export default PersonalPageVaultPhotosModel;