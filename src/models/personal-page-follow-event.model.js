import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';


const PersonalPageFollowEventModel = sequelize.define('personal_page_follow_events', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {      //visitor id   (logged in user id pk)
      type: DataTypes.UUID,
      allowNull: false
    },
    personal_page_follower_id:{   // personal_page_followers table pk id
        type: DataTypes.UUID,
        allowNull: false
    },
    site_owner_id:{            // personal site user id
        type: DataTypes.UUID,
        allowNull:false
    },
    email_status:{             
        type: DataTypes.STRING,
        allowNull: false,
    },
    email_type:{
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    timestamps: true
})



PersonalPageFollowEventModel.sync({ alter: true });

export default PersonalPageFollowEventModel;