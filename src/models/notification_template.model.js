import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';


const AdminNotificationTemplateModel = sequelize.define('notification_templates', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    sender_id: {
        type: DataTypes.UUID,
        allowNull:false
    },
    photo_url: {
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
    message:{
        type: DataTypes.TEXT,
        allowNull: false
    },
    btnLabel:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    btnUrl:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    postedType:{
        type: DataTypes.ENUM("immediate", "scheduled"),
        allowNull: false
    },
    postedAt:{
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"), 
    },
    expirationType:{
        type: DataTypes.ENUM("never", "scheduled"),
        allowNull: false
    },
    expiredAt:{
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"), 
    },
    shownNoOfTimes:{
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1
    },
    target_conditions:{
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: true
    },
}, {
    timestamps: true,
     indexes: [
      { name: "idx_postedAt", fields: ["postedAt"] },
      { name: "idx_expiredAt", fields: ["expiredAt"] },
    ],
});

AdminNotificationTemplateModel.sync({alter: true});

export default AdminNotificationTemplateModel;