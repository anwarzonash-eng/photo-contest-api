import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";

const HuntScoreModel = sequelize.define('HuntScore', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull:false
    },

    scores:{
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
    }
}, {
    tableName: 'hunt_scores',
    indexes: [
      {
        fields: ['user_id']
      }
    ]
});

UserModel.hasOne(HuntScoreModel, {
    foreignKey: 'user_id'
  });
HuntScoreModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
  });

HuntScoreModel.sync({alter:true});



export default HuntScoreModel;