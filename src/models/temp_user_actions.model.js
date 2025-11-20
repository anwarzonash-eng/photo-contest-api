import {sequelize}  from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';


const TempUserActionsModel = sequelize.define('temporary_user_actions', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull:false

    },
    batch_id:{
        type: DataTypes.UUID,
        allowNull: false
    },
    data:{
        type: DataTypes.JSONB,
        allowNull: false
    },
    action_type:{
        type: DataTypes.ENUM('upvote_photo', 'comment'),
        allowNull: false
    },
}, {
    timestamps: true,
});

TempUserActionsModel.sync({alter: true});
export default TempUserActionsModel;