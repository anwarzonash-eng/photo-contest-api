import {sequelize}  from "../utils/database";
import { Sequelize, DataTypes } from 'sequelize';


const ActivityCalloutModel = sequelize.define('activity_callout', {
    id: {
        type: DataTypes.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull:false
    },
    user_id:{
        type: DataTypes.STRING,
        allowNull: false
    },
    title:{
        type: DataTypes.TEXT,
        allowNull: false
    },
    subTitle:{
        type: DataTypes.TEXT,
        allowNull: false 
    },
    CTA:{
        type: DataTypes.TEXT,
        allowNull: false
    },
    CTA_Url:{
        type: DataTypes.TEXT,
        allowNull: false        
    }
}, {
    timestamps: true,
    tableName: 'activity_callout'
});

ActivityCalloutModel.sync({alter: true});


export default ActivityCalloutModel;
