import { sequelize } from "../utils/database.js";
import { Sequelize, DataTypes } from 'sequelize';
import UserModel from "./auth.model.js";


const MonthlyTownHallModel = sequelize.define('monthly-townhall', {
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
    heading: {
        type: DataTypes.STRING,
        allowNull: false
    },
    subHeading: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    body:{
        type: DataTypes.TEXT,
        allowNull: false
    },
    townhallBtn1Label:{
        type: DataTypes.STRING,
        allowNull: false
    },
    townhallBtn1Url:{
        type: DataTypes.TEXT,
        allowNull: false
    },
    townhallBtn2Label:{
        type: DataTypes.STRING,
        allowNull: false
    },
    townhallBtn2Url:{
        type: DataTypes.TEXT,
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


UserModel.hasMany(MonthlyTownHallModel, {
    foreignKey: 'user_id'
  })
  
MonthlyTownHallModel.belongsTo(UserModel, {
    foreignKey: 'user_id'
});

MonthlyTownHallModel.sync({ alter: true });


export default MonthlyTownHallModel;