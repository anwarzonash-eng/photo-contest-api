import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
import {photoOptimization} from "../utils/cloudinary/photo_optimization";
import {v2 as cloudinary} from 'cloudinary';
const uploadPhoto =require("../utils/aws/s3");
import { Env } from '../config';



cloudinary.config({ 
  cloud_name:Env.cloudName,
  api_key:Env.cloudinaryApiKey,
  api_secret:Env.cloudinarySecretKey,
  secure: true  
});



export class townhallService extends baseService {
    async AddTownHall(req) {
        try{             
            global.appLogger.info(`\n---- Start Add TownHall Api Call ----`);      
            let photoData = await uploadPhoto.uploadPhoto(req.files.photoUrl);    
            let imageFilePath = req.files.photoUrl['tempFilePath'];
            let optimizedData = await photoOptimization(imageFilePath, {folder: 'Resized_Photos', quality:"auto:good"});
            let compressedImageUrl = optimizedData?.['compressedImageUrl'];

            const newTownHall = await this._prevTownhallModel.create({
                user_id: req?.adminUser?._id,
                photo_url: photoData,
                compressedImageUrl: compressedImageUrl,
                compressedImageId: optimizedData?.compressedImageId,
                date: req.body.date,
                guestName: req.body.guestName,
                description: req.body.description,
                videoLink: req.body.videoLink,
                townhallBtnLabel: req.body.townhallBtnLabel
            });
        
            return newTownHall;

        }
        catch(err){
            global.appLogger.error(`[Error] Adding TownHall Api ${err.message} \n`);
            return {status: 'Error', message:`Something went wrong while adding townhall`};
        }
    }


       async AddMonthlyTownHall(req) {
        try{             
            global.appLogger.info(`\n---- Start Add Monthly TownHall Api Call ----`);      
            let photoData = await uploadPhoto.uploadPhoto(req.files.photoUrl);    
            let imageFilePath = req.files.photoUrl['tempFilePath'];
            let optimizedData = await photoOptimization(imageFilePath, {folder: 'Resized_Photos', quality:"auto:good"});
            let compressedImageUrl = optimizedData?.['compressedImageUrl'];

            const newMonthlyTownHall = await this._monthlyTownhallModel.create({
                user_id: req?.adminUser?._id,
                photo_url: photoData,
                compressedImageUrl: compressedImageUrl,
                compressedImageId: optimizedData?.compressedImageId,
                heading: req.body.heading,
                subHeading: req.body.subHeading,
                body: req.body.body,
                townhallBtn1Label: req.body.townhallBtn1Label,
                townhallBtn1Url: req.body.townhallBtn1Url,
                townhallBtn2Label: req.body.townhallBtn2Label,
                townhallBtn2Url: req.body.townhallBtn2Url,
            });
        
            return newMonthlyTownHall;

        }
        catch(err){
            global.appLogger.error(`[Error] Adding Monthly TownHall Api ${err.message} \n`);
            return {status: 'Error', message:`Something went wrong while adding monthly townhall`};
        }
    }


    async UpdateTownHall(req) {
        try{             
            global.appLogger.info(`\n---- Start Update TownHall Api Call ----`);  
            const isTownHallExist = await this._prevTownhallModel.findOne({
                where:{
                    id: req.body.townhallId
                },
                attributes:['id']
            });

            if(!isTownHallExist){
                return {status: 'Error', message: `Townhall does not exist`}
            }

            let photoData; let optimizedData;
            if( req.files && req.files.photoUrl ){
                photoData = await uploadPhoto.uploadPhoto(req.files.photoUrl);    
                let imageFilePath = req.files.photoUrl['tempFilePath'];
                optimizedData = await photoOptimization(imageFilePath, {folder: 'Resized_Photos', quality:"auto:good"});
            }

            const updatedTownHall = await this._prevTownhallModel.update({
                user_id: req?.adminUser?._id,
                photo_url: photoData,
                compressedImageUrl:optimizedData?.compressedImageUrl,
                compressedImageId: optimizedData?.compressedImageId,
                date: req.body.date,
                guestName: req.body.guestName,
                description: req.body.description,
                videoLink: req.body.videoLink,
                townhallBtnLabel: req.body.townhallBtnLabel
            }, {
                where: {
                    id: req.body.townhallId
                },
                returning: true
            });
        
            return updatedTownHall?.[1]?.[0]?.get();

        }
        catch(err){
            global.appLogger.error(`[Error] Update TownHall Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while updating townhall`};
        }
    }


    
    async UpdateMonthlyTownHall(req) {
        try{             
            global.appLogger.info(`\n---- Start Update Monthly TownHall Api Call ----`);  
            const isTownHallExist = await this._monthlyTownhallModel.findOne({
                where:{
                    id: req.body.townhallId
                },
                attributes:['id']
            });

            if(!isTownHallExist){
                return {status: 'Error', message: `Townhall does not exist`}
            }

            let photoData; let optimizedData;
            if( req.files && req.files.photoUrl ){
                photoData = await uploadPhoto.uploadPhoto(req.files.photoUrl);    
                let imageFilePath = req.files.photoUrl['tempFilePath'];
                optimizedData = await photoOptimization(imageFilePath, {folder: 'Resized_Photos', quality:"auto:good"});
            }

            const updatedTownHall = await this._monthlyTownhallModel.update({
                user_id: req?.adminUser?._id,
                photo_url: photoData,
                compressedImageUrl:optimizedData?.compressedImageUrl,
                compressedImageId: optimizedData?.compressedImageId,
                heading: req.body.heading,
                subHeading: req.body.subHeading,
                body: req.body.body,
                townhallBtn1Label: req.body.townhallBtn1Label,
                townhallBtn1Url: req.body.townhallBtn1Url,
                townhallBtn2Label: req.body.townhallBtn2Label,
                townhallBtn2Url: req.body.townhallBtn2Url,
            }, {
                where: {
                    id: req.body.townhallId
                },
                returning: true
            });
        
            return updatedTownHall?.[1]?.[0]?.get();

        }
        catch(err){
            global.appLogger.error(`[Error] Update Monthly TownHall Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while updating monthly townhall`};
        }
    }


     async getTownHallById(req) {
        try{     
             global.appLogger.info(`\n---- Start Fetch TownHall By Id Api Call ----`);  
             const townHall = await this._prevTownhallModel.findOne({
                where:{
                    id: req.body.townhallId
                },
            });

            if( !townHall){
                return {status: 'Error', message: `Townhall does not exist`}
            }

            return townHall;
        }
        catch(err){
            global.appLogger.error(`[Error] Get TownHall Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while getting townhall`};
        }
    }


    
     async getMonthlyTownHallById(req) {
        try{     
             global.appLogger.info(`\n---- Start Fetch Monthly TownHall By Id Api Call ----`);  
             const townHall = await this._monthlyTownhallModel.findOne({
                where:{
                    id: req.body.townhallId
                },
            });

            if( !townHall){
                return {status: 'Error', message: `Townhall does not exist`}
            }

            return townHall;
        }
        catch(err){
            global.appLogger.error(`[Error] Get Monthly TownHall Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while getting monthly townhall`};
        }
    }

    
    
    async getTownHallList(req) {
        try{     
                global.appLogger.info(`\n---- Start Fetching TownHall List Api Call ----`);  
                const townHall = await this._prevTownhallModel.findAll({
                    where:{
                        isDeleted: false
                    },
                    order: [['createdAt', 'DESC']]      
                });

                return {
                    townHalls: townHall
                }
        }
        catch(err){
            global.appLogger.error(`[Error] Get TownHall Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while getting townhall`};
        }
    }

    
    async getMonthlyTownHallList(req) {
        try{     
                global.appLogger.info(`\n---- Start Fetching Monthly TownHall List Api Call ----`);  
                const townHall = await this._monthlyTownhallModel.findAll({
                    where:{
                        isDeleted: false
                    },     
                });

                return {townHalls: townHall};
        }
        catch(err){
            global.appLogger.error(`[Error] Get Monthly TownHall Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while getting monthly townhall`};
        }
    }


    async removeTownHall(req) {
        try{     
                global.appLogger.info(`\n---- Start Removing TownHall Api Call ----`);  

                const townHall = await this._prevTownhallModel.findOne({
                    where:{
                        id: req.body.townhallId
                    },
                });

                if( !townHall){
                    return {status: 'Error', message: `Townhall does not exist`}
                }
                
                await this._prevTownhallModel.update({
                    isDeleted: true
                }, {
                    where: {
                        id: req.body.townhallId
                    },
                });

                return { message: 'Townhall Deleted Successfully' }
        
        }
        catch(err){
            global.appLogger.error(`[Error] Remove TownHall Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while removing townhall`};
        }
    }

    
    async removeMonthlyTownHall(req) {
        try{     
                global.appLogger.info(`\n---- Start Removing Monthly TownHall Api Call ----`);  

                const townHall = await this._monthlyTownhallModel.findOne({
                    where:{
                        id: req.body.townhallId
                    },
                });

                if( !townHall){
                    return {status: 'Error', message: `Townhall does not exist`}
                }
                
                await this._monthlyTownhallModel.update({
                    isDeleted: true
                }, {
                    where: {
                        id: req.body.townhallId
                    },
                });

                return { message: 'Townhall Deleted Successfully' }
        
        }
        catch(err){
            global.appLogger.error(`[Error] Remove Monthly TownHall Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while removing townhall`};
        }
    }
}