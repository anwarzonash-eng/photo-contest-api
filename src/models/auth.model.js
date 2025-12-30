import {sequelize}  from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import bcrypt from 'bcrypt'
import {Env} from "../config";

const UserModel = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull:false

    },
    member_id:{
        type: DataTypes.STRING,
        allowNull: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false

    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        //unique: true
    },
    facebookUserId:{
        type: DataTypes.STRING,
        allowNull: true 
    },
    password: {
        type: DataTypes.STRING     
    },
    photo_url: {
        type: DataTypes.TEXT,
        defaultValue: '' 
    },
    compressedProfilePic:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    compressedProfileId:{
        type:DataTypes.STRING,
        allowNull:true
    },
    user_type: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    photograper_type: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    photo_desire_ratio: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    genres_list: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    camera_brand: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    photo_assistance:{
        type: DataTypes.STRING,
        allowNull: true,
    },
    facebook_link: {
        type: DataTypes.STRING,
        defaultValue:''
    },
    twitter_link: {
        type: DataTypes.STRING,     
        defaultValue:''
    },
    instagram_link: {
        type: DataTypes.STRING,    
        defaultValue:''
    },
    website: {
        type: DataTypes.STRING,     
        defaultValue:''
    },
    state: {
        type: DataTypes.STRING,     
        defaultValue:''
    },
    country: {
        type: DataTypes.STRING,     
        defaultValue:''
    },
    source: {
        type: DataTypes.STRING,
        defaultValue:''
    },
    isSubscribed:{
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    isBlocked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    token:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    token_expiry:{
        type: DataTypes.BIGINT,
        allowNull: true
    },
    reminder: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    reminderDate:{
        type: DataTypes.DATE,
        allowNull: true
    },
    queued_count:{
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    winner_count:{
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    heard_us:{
        type: DataTypes.TEXT,
        allowNull: true 
    },
    activity_viewed:{
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue:null
    }, 
    lastVisitTime:{
        type: DataTypes.STRING,
        //type: DataTypes.DATEONLY,
        allowNull: true,
        defaultValue:null
    },
    about_me:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    strengths:{
        type: DataTypes.STRING,
        allowNull: true
    },
    meet_for:{
        type: DataTypes.STRING,
        allowNull: true
    },
    cover_photo_url: {
        type: DataTypes.TEXT,
        allowNull:true
    },
    compressedCoverPhoto:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    compressedCoverPhotoId:{
        type:DataTypes.STRING,
        allowNull:true
    },
    isPaid:{
        type:DataTypes.BOOLEAN,
        allowNull:false,
        defaultValue:false
    },
    membershipPlan:{
        type:DataTypes.STRING,
        allowNull:true
    },
    subscriptionId:{
        type:DataTypes.STRING,
        allowNull:true
    },
    subscriptionStatus: {
        type:DataTypes.STRING,
        allowNull:true
    }, 
    payment_frequency:{
        type:DataTypes.STRING,
        allowNull:true
    },
    subscriptionReason:{
        type:DataTypes.TEXT,
        allowNull:true
    },
    subscription_start_date: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null
    },
    inviterId:{
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: '00000000-0000-0000-0000-000000000000'
    },
    referral_code: {
        type: DataTypes.STRING,
        allowNull: true
    },
    trial_type:{
        type: DataTypes.STRING,
        allowNull: true
    },
    total_hunt_scores:{
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: true
    },
    hunt_score_ranking:{
        type: DataTypes.STRING,
        allowNull: true
    },
    isAdmin: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: false
    },
    notifications:{
        type: DataTypes.JSONB,
        allowNull: true
    },
    profileCode:{
        type: DataTypes.STRING,
        allowNull: true
    },
    sessionId:{
        type: DataTypes.STRING,
        allowNull: true
    },
    account_status:{
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'Active'
    },
    isPhotoInProcess:{
        type: DataTypes.BOOLEAN,
        allowNull: true
    },
    isWebsiteCompletelyCreated:{
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSaltSync(10, 'a');
                user.password = bcrypt.hashSync(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSaltSync(10, 'a');
                user.password = bcrypt.hashSync(user.password, salt);
            }
        },
        afterSync: async () => {
            const checkConstraintQuery = `SELECT 1
              as unique_constraint
              FROM information_schema.table_constraints 
              WHERE constraint_type = 'UNIQUE' 
              AND table_name = 'Users' 
              AND constraint_name = 'Users_email_key'`;
      
            const [constraintExists] = await sequelize.query(checkConstraintQuery);
      
            if (!constraintExists.length) {
              const addConstraintQuery = `ALTER TABLE "Users" 
                ADD CONSTRAINT "Users_email_key" UNIQUE ("email")`;
              await sequelize.query(addConstraintQuery);
            }
        }
    }
});


(async () => {
    try {
      await UserModel.findOrCreate({
        where: { email: Env.adminEmail},
        defaults: { name: Env.adminUser, 
            email: Env.adminEmail,
            password: Env.adminPassword, 
            user_type:'email',
            isAdmin: true
        }
      });
    } catch (error) {
      console.error('Error Inserting Admin Credential', error);
    }
  })();


UserModel.sync({alter: true})

export default UserModel;