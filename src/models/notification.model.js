import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';

const NotificationModel = sequelize.define('notifications', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    notification_type: {
        type: DataTypes.STRING,
        allowNull:false
    },
    receiver_id:{
        type: DataTypes.UUID,
        allowNull:false
    },
    sender_id:{
        type: DataTypes.UUID,
        allowNull:true,
        defaultValue: '00000000-0000-0000-0000-000000000000'
    },
    photo_id:{
        type: DataTypes.UUID,
        allowNull:true,
    },
    comment_id:{
        type: DataTypes.UUID,
        allowNull:true,
    },
    is_seen:{
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    text:{
        type: DataTypes.STRING,
        allowNull:true,
        defaultValue:'regular'
    }
},
{
    indexes: [
        {
            name: 'idx_receiver_id',
            using: 'BTREE',
            fields: ['receiver_id'],
            order: [['receiver_id', 'ASC']],
            nullsLast: true
        },
        {
            name: 'idx_notifications_sender_receiver_photo_type', 
            using: 'BTREE',
            fields: ['sender_id', 'receiver_id', 'photo_id', 'notification_type'] 
        }
    ],
    tableName: 'notifications'
});

NotificationModel.sync({alter:true});


export default NotificationModel;