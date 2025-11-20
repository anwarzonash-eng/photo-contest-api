import { sequelize } from "../utils/database.js";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";

const PersonalWebsiteModel = sequelize.define('Personal_Website', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull:false
    },
    template_name: {
        type: DataTypes.STRING,
        allowNull:false
    },
    website_purpose:{
        type: DataTypes.STRING,
        allowNull:true
    }, 
    user_name:{
        type: DataTypes.STRING,
        allowNull:true
    }, 
    user_bio:{
        type: DataTypes.TEXT,
        allowNull:true
    }, 
    headline:{
        type: DataTypes.TEXT,
        allowNull:true
    },
    subHeadline:{
        type: DataTypes.TEXT,
        allowNull:true
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
    tiktok: {
        type: DataTypes.STRING,     
        defaultValue:''
    },
    linkedIn: {
        type: DataTypes.STRING,    
        defaultValue:''
    },
    website_url: {
        type: DataTypes.STRING,     
        defaultValue:''
    },
    uploaded_photos: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []       
    },
    selected_photos: {
        type: DataTypes.JSONB,  
        allowNull: true,
        defaultValue: []       
    },
    cover_photo: {
        type: DataTypes.JSONB,  
        allowNull: true,
        defaultValue: []       
    },
    isHearted:{
        type: DataTypes.BOOLEAN,  
        allowNull: true,
        defaultValue: false
    },
    isTopTenPhoto:{
        type: DataTypes.BOOLEAN,  
        allowNull: true,
        defaultValue: false
    },
    followMe:{
        type: DataTypes.BOOLEAN,  
        allowNull: true,
        defaultValue: false
    },
    show_big_photo_hunt_profile:{
        type: DataTypes.BOOLEAN,  
        allowNull: true,
        defaultValue: false
    },
    big_photo_hunt_branding:{
        type: DataTypes.BOOLEAN,  
        allowNull: true,
        defaultValue: false
    },
    update_my_followers:{
        type: DataTypes.BOOLEAN,  
        allowNull: true,
        defaultValue: false
    },
    is_monthly_file_audit_email:{
        type: DataTypes.BOOLEAN,  
        allowNull: true,
        defaultValue: false 
    },
    profile_pic: {
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
    createdAt: {
        type: DataTypes.STRING, 
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"), 
    },
    updatedAt: {
        type: DataTypes.STRING,  
        defaultValue:  Sequelize.literal("CURRENT_TIMESTAMP"), 
    }
}, {
    timestamps: true
});

UserModel.hasOne(PersonalWebsiteModel, {
    foreignKey: 'user_id'
  });
PersonalWebsiteModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
  });

PersonalWebsiteModel.sync({ alter: true });


export default PersonalWebsiteModel;