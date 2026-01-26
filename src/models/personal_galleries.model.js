import {sequelize}  from "../utils/database.js";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";


const PersonalGalleriesModel = sequelize.define('personal-galleries', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull:false
    },
    user_id:{
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: UserModel,
            key: 'id'
        },
    },
    name:{
        type: DataTypes.STRING,
        allowNull: false        
    }
}, {
    timestamps: true
});



UserModel.hasMany(PersonalGalleriesModel, {
    foreignKey: 'user_id'
});

PersonalGalleriesModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});


PersonalGalleriesModel.sync({alter: true});

export default PersonalGalleriesModel;