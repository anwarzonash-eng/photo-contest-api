import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import {UserModel} from "../models";

const InvitationLinksModel = sequelize.define('invitation_links', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
     },
    user_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    referral_code: {
        type: DataTypes.STRING,
        allowNull: false
    },
    link_expiry:{
        type: DataTypes.STRING,
        allowNull: false,
    }
});

UserModel.hasMany(InvitationLinksModel, {
    foreignKey: 'user_id'
  });
  
InvitationLinksModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

InvitationLinksModel.sync({alter: true})

export default InvitationLinksModel;