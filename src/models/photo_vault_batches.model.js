import {sequelize}  from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';


const PhotoVaultBatchModel = sequelize.define('photo_vault_batch', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
    },
    user_id: {             
        type: DataTypes.UUID,
        allowNull: false
    },
    batch_id:{
        type: DataTypes.UUID,
        allowNull: false,
        unique: true
    },
    photosCount:{
        type: DataTypes.INTEGER,
        allowNull: false
    },
    folder_id:{
        type: DataTypes.UUID,
        allowNull: true
    },
    is_confirmed:{
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    is_logged:{
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    }
}, 
{
    timestamps: true,
});



PhotoVaultBatchModel.sync({alter:true});

export default PhotoVaultBatchModel;