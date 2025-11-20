import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import PersonalPageFollowEventModel from "./personal-page-follow-event.model";


const PersonalPageFollowRelationModel = sequelize.define('personal_page_follow_relations', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    personal_page_follower_id:{   // personal_page_followers table pk id
        type: DataTypes.UUID,
        allowNull: false
    },
    user_id: {                // visitor (logged in user id )
      type: DataTypes.UUID,
      allowNull: false
    },
    follow_event_id: {          // ties to event session
      type: DataTypes.UUID,
      allowNull: false
    },
    follower_id: {          // user they wanna followed
      type: DataTypes.UUID,
      allowNull: false
    },
    source_creator_id: {     // user id site whom i try to follow any one (personal site user id)
      type: DataTypes.UUID,
      allowNull: false
    },
    is_follow:{
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    }
}, {
    timestamps: true
})


PersonalPageFollowEventModel.hasMany(PersonalPageFollowRelationModel, {
    foreignKey: 'follow_event_id'
});

PersonalPageFollowRelationModel.belongsTo(PersonalPageFollowEventModel, {
    foreignKey: 'follow_event_id'
});


PersonalPageFollowRelationModel.sync({ alter: true });

export default PersonalPageFollowRelationModel;