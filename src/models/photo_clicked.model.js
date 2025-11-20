import { sequelize } from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';
import PhotoModel from './photo.model';

const PhotoClickedModel = sequelize.define('photo_clicked', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true

    },
    photo_id: {
        type: DataTypes.UUID,
        allowNull:false
    },
    source: {
        type: DataTypes.TEXT,
        allowNull: false  
    },
    total_count: {
        type: DataTypes.INTEGER,
        allowNull: false 
    }
}, {
    tableName: 'photo_clicked'
  }
);

PhotoModel.hasMany(PhotoClickedModel, {
    foreignKey: 'photo_id'
  });
PhotoClickedModel.belongsTo(PhotoModel, {
    foreignKey: 'photo_id'
});


export default PhotoClickedModel