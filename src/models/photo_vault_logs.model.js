import {sequelize}  from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';


const PhotoVaultLogsModel = sequelize.define('photo_vault_logs', {
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
        allowNull: false
    },
    actionType:{
        type: DataTypes.STRING,
        allowNull: false
    },
    fileCount:{
        type: DataTypes.INTEGER,
        allowNull: true
    },
    size:{
        type: DataTypes.STRING,
        allowNull: true
    },
    ip_address:{
        type: DataTypes.STRING,
        allowNull: true
    },
    location:{
        type: DataTypes.STRING,
        allowNull: true
    },
    notes:{
        type: DataTypes.TEXT,
        allowNull: true
    }
}, 
{
    timestamps: true,
});



PhotoVaultLogsModel.sync({alter:true});

export default PhotoVaultLogsModel;