import {sequelize}  from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';


const FoldersModel = sequelize.define('folders', {
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
    folder_name:{
        type: DataTypes.STRING,
        allowNull: false
    },
    isDefault: {
        type: DataTypes.BOOLEAN,
        defaultValue: false 
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }   
}, {
    timestamps: true,
});



FoldersModel.sync({alter:true});

export default FoldersModel;