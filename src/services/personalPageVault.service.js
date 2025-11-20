import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
const uploadPhoto = require("../utils/aws/s3");


export class personalPageVaultService extends baseService {

    async UploadPhotos(req) {
        try{
                global.appLogger.info(`\n---- Start Personal Page Vault Upload Photos Api Call ----`);

                let userId = req.userData._id; 

                let [generalFolder, _] = await this._foldersModel.findOrCreate({ 
                    where: { 
                        user_id: userId, 
                        folder_name: 'General Storage'
                    }, 
                    defaults: { 
                        user_id: userId, 
                        folder_name: 'General Storage',
                        isDefault: true 
                    }
                });

                let folderId = req.body.folderId ? req.body.folderId : generalFolder.id;
                    
                
                if(req.files && req.files?.photoUrl){                 
                    const photosData = await uploadPhoto.uploadPhoto(req.files.photoUrl);              
                    await this._personalPageVaultPhotosModel.create({
                        user_id: userId,
                        photo_url: photosData,
                        folder_id: folderId,
                        batch_id: req.body.batchId
                    });
                                
                    global.appLogger.info(`\n---- End Personal Page Vault Upload Photos Api Call ----`);                            
                    return { photo: photosData };
                }     
        }
        catch(err){
            global.appLogger.error(`[Error] Personal Page Vault Upload Photos Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while upload photos`};
        }
    }


    async getPhotoVaultStats(req){
        try{
                global.appLogger.info(`\n---- Start Fetching Photo Vault Stats Api Call ----`);

                let userId = req.userData._id; 

                let query = `SELECT
                    (
                        SELECT COUNT("fileCount")
                        FROM "photo_vault_logs"
                        WHERE "user_id" = '${userId}'
                        AND "actionType" = 'Upload'
                    ) AS "photos_stored",
                    (
                        SELECT COUNT("fileCount")
                        FROM "photo_vault_logs"
                        WHERE "user_id" =  '${userId}'
                        AND "actionType" = 'Upload'
                        AND "createdAt" = (
                            SELECT MAX("createdAt")
                            FROM "photo_vault_logs"
                            WHERE "user_id" =  '${userId}'
                            AND "actionType" = 'Upload'
                        )
                    ) AS "last_upload_count",
                    (
                        SELECT MAX("createdAt")
                        FROM "photo_vault_logs"
                        WHERE "user_id" =  '${userId}'
                        AND "actionType" = 'Upload'
                    ) AS "last_uploaded_date",
                    (
                        SELECT COUNT("fileCount")
                        FROM "photo_vault_logs"
                        WHERE "user_id" =  '${userId}'
                        AND "actionType" = 'Download'
                        AND "createdAt" = (
                            SELECT MAX("createdAt")
                            FROM "photo_vault_logs"
                            WHERE "user_id" =  '${userId}'
                            AND "actionType" = 'Download'
                        )
                    ) AS "last_download_count",
                    (
                        SELECT MAX("createdAt")
                        FROM "photo_vault_logs"
                        WHERE "user_id" =  '${userId}'
                        AND "actionType" = 'Download'
                    ) AS "last_downloaded_date"`;

                const stats = await sequelize.query(query, {
                    type: 'select'
                })

                return {stats};
                
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Photo Vault Stats Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while fetching vault stats`};
        }
    }


    async getPhotoVaultLogs(req){
        try{
                global.appLogger.info(`\n---- Start Fetching Photo Vault Logs Api Call ----`);

                let userId = req.userData._id; 

                let logs = await this._photoVaultLogsModel.findAll({
                    where:{
                        user_id: userId
                    },
                    order:[['createdAt', 'DESC']],
                    offset: req.body.offSet,
                    limit: 1
                });
                
                return { logs }
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Photo Vault Logs Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while fetching vault logs`};
        }
    }


    async CreateFolder(req) {
        try{
                
                let userId = req.userData._id; 
                global.appLogger.info(`\n---- Start Create Folder Api Call By User with id ${userId} ----`);   
                let { folderName } = req.body;

     
                let newFolder = await this._foldersModel.create({ 
                    user_id: userId,
                    folder_name: folderName,
                    isDefault: false    
                });
                global.appLogger.info(`\n---- End Personal Page Create Folder Api Call ----`);
                return newFolder;
        }   
            
        catch(err){
            global.appLogger.error(`[Error] Personal Page  Create Folder Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while creating folder`};
        }   
    }


    
    async UpdateFolderName(req) {
        try{
                
                let userId = req.userData._id; 
                global.appLogger.info(`\n---- Start Updating Folder Name Api Call By User with id ${userId} ----`);   
                let { folderName } = req.body;

     
                await this._foldersModel.update({ 
                    folder_name: folderName,  
                }, {
                    where:{
                        id: req.body.folderId,
                    }
                });
                global.appLogger.info(`\n---- End Updated Folder Name Api Call ----`);
                return {message: 'Folder Name Updated Successfully!'}
        }   
            
        catch(err){
            global.appLogger.error(`[Error] Updating Folder Name Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while updating folder name`};
        }   
    }


    async UploadPhotosToVault(req){
        try{
            let userId = req.userData._id; 
            global.appLogger.info(`\n---- Start Uploading Photos To Folder Api Call By User with id ${userId} ----`);  
 
            let {folderId, batchId} = req.body;
            await this._personalPageVaultPhotosModel.update({
                folder_id: folderId,
            }, {
                where: {
                    batch_id: batchId,
                    user_id: userId
                }
            });

            const userPhotos = await this._personalPageVaultPhotosModel.findAll({
                where: {
                    batch_id: batchId,
                    user_id: userId
                },
                attributes: ['id', 'photo_url']
            });

            await uploadPhoto.uploadS3PhotosToVault(userPhotos, userId, folderId);

            await this._photoVaultLogsModel.create({
                user_id: userId,
                actionType: 'Upload',
                fileCount: userPhotos.length,
                notes: 'Secured in Vault'
            });

            global.appLogger.info(`\n---- End Successfully Uploading Photos To Folder Api Call ----`);
            return {message: 'Photos Successfully Uploaded to BackBlaze'}

        }
        catch(err){
            global.appLogger.error(`[Error] Uploading Photos To Folder Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while uploading photos to BackBlaze`};
        }
    }

    
    async getFoldersList(req) {
        try{
                
                let userId = req.userData._id; 
                global.appLogger.info(`\n---- Start Fetching Folders Api Call By User with id ${userId} ----`);   
             
                const folders = await this._foldersModel.findAndCountAll({
                    where: { 
                        user_id: userId, 
                        isDeleted: false 
                    },
                    attributes:[ 'id', 'folder_name', 'isDefault', 'createdAt'],
                    order: [['createdAt', 'DESC']],
                    offset: req.body.offSet,
                    limit: 10
                }); 

                global.appLogger.info(`\n---- End Fetching All Folders Api Call ----`);
                return {
                    folders: folders.rows, 
                    recordsCount: folders.count
                }
        }   
            
        catch(err){
            global.appLogger.error(`[Error] Fetching All Folders Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while fetching folders`};
        }   
    }


    async getPhotosList(req) {
        try{

                let userId = req.userData._id;
                global.appLogger.info(`\n---- Start Fetching Photos Api Call By User with id ${userId} ----`);
                const photos = await this._personalPageVaultPhotosModel.findAndCountAll({
                    where: { 
                        user_id: userId, 
                        folder_id: req.body.folderId,
                        isDeleted: false
                    },
                    attributes:[ 'id', 'compressedImageUrl', 'compressedImageId', 'folder_id', 'createdAt'],
                    order: [['createdAt', 'DESC']], 
                    offset: req.body.offSet,    
                    limit: 10
                }); 
                global.appLogger.info(`\n---- End Fetching All Photos Api Call ----`);
                
                return {
                    photos: photos.rows,
                    recordsCount: photos.count
                }
        }       
        catch(err){
            global.appLogger.error(`[Error] Fetching All Photos Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while fetching photos`};
        }
    }
} 