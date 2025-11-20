import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from './auth.model';

const FollowersModel = sequelize.define('Followers', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull:false,
        validate: {
            notEqualFollowerId(value) {
              if (value === this.getDataValue('follower_id')) {
                throw new Error('user_id cannot be the same as follower_id');
              }
            },
          },
    },
    follower_id: {
        type: DataTypes.UUID,
        allowNull: false
    },
    is_active:{
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    }
},
    {
      indexes: [
          {
              name: 'idx_followers_follower_id',
              using: 'BTREE',
              fields: ['follower_id'],
              order: [['follower_id', 'ASC']],
              nullsLast: true
          },
          {
            name: 'idx_followers_user_id',
            using: 'BTREE',
            fields: ['user_id'],
            order: [['user_id', 'ASC']],
            nullsLast: true
        },
        {
            name: 'idx_followers_user_follower_active',
            using: 'BTREE',
            fields: ['user_id', 'follower_id', 'is_active']
        }
      ]
});

UserModel.hasMany(FollowersModel, {
  foreignKey: 'user_id'
});
FollowersModel.belongsTo(UserModel, {
  foreignKey: 'user_id'
});

UserModel.hasMany(FollowersModel, {
  foreignKey: 'follower_id'
});
FollowersModel.belongsTo(UserModel, {
  foreignKey: 'follower_id'
});



export default FollowersModel