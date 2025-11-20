import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";

const GalleryPhotoModel = sequelize.define('gallery_photos', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.UUID,
        allowNull:false
    },
    photo_url: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    compressedImageUrl:{
        type: DataTypes.TEXT,
        allowNull: true
    },
    compressedImageId:{
        type:DataTypes.STRING,
        allowNull:true
    },
    isWeeklyTopTen:{
        type:DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    isHunted:{
        type:DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    isVisible:{
        type:DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
    metadata:{
        type: DataTypes.TEXT,
        allowNull: true
    }, 
    photo_display_status: {
        type: DataTypes.STRING,
        defaultValue: false,
        allowNull: true
    },
}, {
    indexes: [
        {
            name: 'idx_gallery_photos_createdat',
            using: 'BTREE',
            fields: ['createdAt'],
            order: [['createdAt', 'ASC']],
            nullsLast: true
        }
    ]
});

UserModel.hasMany(GalleryPhotoModel, {
    foreignKey: 'user_id'
  });
GalleryPhotoModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
  });

GalleryPhotoModel.sync({alter:true});

export default GalleryPhotoModel;