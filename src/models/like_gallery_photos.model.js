import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import GalleryPhotoModel from "./gallery_photo.model.js";
import UserModel from "./auth.model.js";

const LikeGalleryPhotoModel = sequelize.define('like_gallery_photos', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {        
        type: DataTypes.UUID,
        allowNull:false
    },
    gallery_photo_id: {
        type: DataTypes.UUID,
        allowNull:false
    },
    isHearted:{
        type: DataTypes.BOOLEAN,
        allowNull: false
    }
});

UserModel.hasMany(LikeGalleryPhotoModel, {
    foreignKey: 'user_id'
});
  
LikeGalleryPhotoModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

GalleryPhotoModel.hasMany(LikeGalleryPhotoModel, {
    foreignKey: 'gallery_photo_id'
});
  
LikeGalleryPhotoModel.belongsTo(GalleryPhotoModel, {
    foreignKey: 'gallery_photo_id'
});

LikeGalleryPhotoModel.sync({alter:true});

export default LikeGalleryPhotoModel