import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from './auth.model';

const WelcomeUserModel = sequelize.define('welcome_user', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull:false,
        validate: {
            notEqualWelcomeUserId(value) {
              if (value === this.getDataValue('welcomed_user_id')) {
                throw new Error('user_id cannot be the same as welcomed_user_id');
              }
            },
          },
    },
    welcomed_user_id: {
        type: DataTypes.UUID,
        allowNull: false
    }
});

UserModel.hasMany(WelcomeUserModel, {
  foreignKey: 'user_id'
});
WelcomeUserModel.belongsTo(UserModel, {
  foreignKey: 'user_id'
});

UserModel.hasMany(WelcomeUserModel, {
  foreignKey: 'welcomed_user_id'
});
WelcomeUserModel.belongsTo(UserModel, {
  foreignKey: 'welcomed_user_id'
});



export default WelcomeUserModel