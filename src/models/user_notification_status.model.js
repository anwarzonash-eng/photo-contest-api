import {sequelize}  from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import  AdminNotificationTemplateModel from "./notification_template.model";


const UserNotificationStatusModel = sequelize.define('viewed_notifications', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull:false
    },
    user_id:{
        type: DataTypes.UUID,
        allowNull: false
    },
    template_id:{
        type: DataTypes.UUID,
        allowNull: false
    },
    viewed_count:{
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
    },
}, {
    timestamps: true,
    tableName: 'viewed_notifications',
    indexes: [
      {
        unique: true,
        fields: ["user_id", "template_id"], 
      },
    ],
});

/*
AdminNotificationTemplateModel.hasMany(UserNotificationStatusModel, {
  foreignKey: "template_id",
});


UserNotificationStatusModel.belongsTo(AdminNotificationTemplateModel, {
  foreignKey: "template_id",
});

*/

UserNotificationStatusModel.sync({alter: true});

export default UserNotificationStatusModel;
