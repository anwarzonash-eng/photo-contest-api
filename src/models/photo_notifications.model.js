import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";
import PhotoModel from "./photo.model.js";

const PhotoNotificationsModel = sequelize.define('photo_notifications', {
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
    photo_member_id: {
        type: DataTypes.UUID,
        allowNull:false
    },
    is_notify:{
        type: DataTypes.BOOLEAN,
        allowNull: false
    }
});

UserModel.hasMany(PhotoNotificationsModel, {
    foreignKey: 'user_id'
  });
PhotoNotificationsModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

PhotoModel.hasMany(PhotoNotificationsModel, {
    foreignKey: 'photo_id'
  });
PhotoNotificationsModel.belongsTo(PhotoModel, {
    foreignKey: 'photo_id'
});


export default PhotoNotificationsModel;