import { sequelize } from "../utils/database.js";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";

const PrevTownHallModel = sequelize.define('previous-townhall', {
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
    date: {
        type: DataTypes.STRING,
        allowNull: false
    },
    guestName: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    description:{
        type: DataTypes.TEXT,
        allowNull: false
    },
    videoLink:{
        type: DataTypes.TEXT,
        allowNull: false
    },
    townhallBtnLabel:{
        type: DataTypes.STRING,
        allowNull: false
    },
    isDeleted: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: true
    },
}, {
    timestamps: true,
});


UserModel.hasMany(PrevTownHallModel, {
    foreignKey: 'user_id'
  });
PrevTownHallModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
  });

PrevTownHallModel.sync({ alter: true });


export default PrevTownHallModel