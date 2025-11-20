import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model";


const PersonalPageFollowerModel = sequelize.define('personal_page_followers', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id:{          /// visitor id
        type: DataTypes.UUID,
        allowNull:false
    },
    member_id:{
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    site_owner_id:{                   // personal site user id
        type: DataTypes.UUID,
        allowNull:false
    }
}, {
    timestamps: true
})


UserModel.hasMany(PersonalPageFollowerModel, {
    foreignKey: 'site_owner_id'
});
  
PersonalPageFollowerModel.belongsTo(UserModel, {
    foreignKey: 'site_owner_id'
});


PersonalPageFollowerModel.sync({ alter: true });

export default PersonalPageFollowerModel;