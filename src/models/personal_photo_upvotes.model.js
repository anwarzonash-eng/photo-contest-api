import { sequelize } from "../utils/database.js";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";
import PersonalPhotoModel from "./personal_site_photos.model.js";


const PersonalPhotoUpvoteModel = sequelize.define('personal_photo_upvotes', {
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
    is_vote:{
        type: DataTypes.BOOLEAN,
        allowNull: true
    }
}, {
        indexes: [{
            name: 'idx_votes_personal_photo_id',
            using: 'BTREE',
            fields: ['photo_id'],
            order: [['photo_id', 'ASC']],
            nullsLast: true
        },
        {
            name: 'idx_personal_votes_userId_isVote',
            fields: ['user_id', 'is_vote']
        }
    ]
});


UserModel.hasMany(PersonalPhotoUpvoteModel, {
    foreignKey: 'user_id'
  });
PersonalPhotoUpvoteModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

PersonalPhotoModel.hasMany(PersonalPhotoUpvoteModel, {
    foreignKey: 'photo_id'
  });
PersonalPhotoUpvoteModel.belongsTo(PersonalPhotoModel, {
    foreignKey: 'photo_id'
});


export default PersonalPhotoUpvoteModel;