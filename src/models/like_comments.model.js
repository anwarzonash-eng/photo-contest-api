import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import CommentsModel from "./comments.model";
import UserModel from "./auth.model.js";

const VoteCommentModel = sequelize.define('like_comments', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {        
        type: DataTypes.UUID,
        allowNull:false
    },
    comment_id: {
        type: DataTypes.UUID,
        allowNull:false
    }
},
{
  indexes: [
    {
      unique: true,
      fields: ['comment_id', 'user_id']
    }
  ]
});


UserModel.hasMany(VoteCommentModel, {
    foreignKey: 'user_id'
});
  
VoteCommentModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

CommentsModel.hasMany(VoteCommentModel, {
    foreignKey: 'comment_id'
});
  
VoteCommentModel.belongsTo(CommentsModel, {
    foreignKey: 'comment_id'
});


export default VoteCommentModel