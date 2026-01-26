import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
const uploadPhoto = require("../utils/aws/s3");
import { downloadBackBlazeFolderAsZip, deletePhotosFromBackBlaze } from '../utils/back_blaze/backBlaze';
import { PhotoVaultStatusEnum } from '../enums/photoVaultStatus.enum';
const schedule = require('node-schedule');
const scheduledJobs = new Map();
import {Op} from 'sequelize';
import { deletePhotosFromCloudinary } from '../utils/cloudinary/photo_optimization';
import { manageTags } from '../utils/mailchimp/tags';
import { getSecrets } from "../utils/secret-manager.js";


export class personalPageVaultService extends baseService {

    async UploadPhotos(req) {
        try{

                let userId = req.userData._id; 
                global.appLogger.info(`\n---- Start Personal Page Vault Upload Photos Api Call By User Id ${userId} ----`);
         
                let { batchId } = req.body;
                let photoCount = Number(req.body.photoCount);
                    
                
                if(req.files && req.files?.photoUrl){ 
                    const [batch, created] =  await this._photoVaultBatchModel.findOrCreate({
                        where: {    
                            user_id: userId,
                            batch_id: batchId,
                        },
                        defaults: { 
                            user_id: userId,
                            batch_id: batchId,
                            ...(req.body.folderId && { folder_id: req.body.folderId }),
                            photosCount: photoCount
                        },
                    });
                    

                    let fileName =  req.files.photoUrl?.name;  
                    let photosData;    
                    try{     

                        photosData = await uploadPhoto.uploadPhoto(req.files.photoUrl);  
                        global.appLogger.info(`Photo Vault Uploaded Successfully to S3 By BatchId ${batchId}`);   
                    }
                    catch(err)
                    {
                        await this._photoVaultBatchModel.decrement(
                            'photosCount',
                            { 
                                by: 1, 
                                where: { 
                                    id: batch.id 
                                } 
                            }
                        );

                        global.appLogger.info(`[Error] Photo Vault Upload to S3 for BatchId ${batchId} \n ${err.message} \n`);  
                    }

                    let folderId = req.body.folderId ? req.body.folderId : null;
                    let newPhotoVault = await this._personalPageVaultPhotosModel.create({
                        user_id: userId,
                        folder_id: folderId,
                        batch_id: batchId,
                        fileName,
                        photo_url: photosData,
                        status: 'uploaded_to_s3'
                    });
                    let photoId = newPhotoVault.dataValues.id;

                    let batchData = await this._photoVaultBatchModel.findOne({
                        where:{
                            batch_id: batchId
                        },
                        attributes:['is_confirmed', 'folder_id']
                    });

                    if(batchData && batchData.dataValues.is_confirmed){
                        const userPhotos = [{
                            id: photoId,
                            photo_url: photosData
                        }]

                        let folderId = batchData.dataValues.folder_id;
                        if(!folderId){
                            let folderData = await this._personalPageVaultPhotosModel.findOne({
                                where:{
                                    user_id: userId,
                                    batch_id: batchId,
                                    folder_id:{
                                        [Op.ne]: null
                                    }
                                },
                                attributes:['folder_id']
                            });

                            folderId = folderData?.dataValues?.['folder_id'];
                        }

                        if(!folderId){
                            global.appLogger.error(`[Error] FolderId not found for BatchId ${batchId} while batch is already confirmed`);  
                            return {status:'Error', message: `Something went wrong while upload photos`};
                        }
                        
                        await this._personalPageVaultPhotosModel.update({
                                folder_id: folderId,
                        }, {
                            where: {
                                batch_id: batchId,
                                user_id: userId
                            }
                        });

                        global.appLogger.info(`Start Uploading To BackBlaze By BatchId ${batchId} while batch is already confirmed`);  
                        await uploadPhoto.uploadS3PhotosToVault(userPhotos, userId, folderId);

                        global.appLogger.info(`[End] Successfully Uploaded To BackBlaze By BatchId ${batchId} while batch is already confirmed`); 

                        await this.UpdatePhotoVaultLogs({
                            batchId,
                            userId,
                            photoCount
                        });
              
                    }
                     

                    // Schedule Job to remove AWS S3 temporary photos after 90 minutes
                    if (batchId && !scheduledJobs.has(batchId)) {
                        const job = schedule.scheduleJob(new Date(Date.now() + 90 * 60 * 1000), async () => {
                            try {   
                                    
                                let batchData = await this._photoVaultBatchModel.findOne({
                                    where:{
                                        batch_id: batchId
                                    },
                                    attributes:['is_confirmed', 'user_id']
                                });

                                let userId = batchData.dataValues.user_id;
                                
                                if(batchData && batchData.dataValues.is_confirmed){         
                                    const pendingbackBlazePhotos = await this._personalPageVaultPhotosModel.findAll({
                                        where: {
                                            batch_id: batchId,
                                            status: 'uploaded_to_s3' 
                                        },
                                        attributes: ['id', 'photo_url', 'folder_id'],
                                        raw: true
                                    });

                                    if (pendingbackBlazePhotos.length > 0) {
                                        global.appLogger.info(`Start Uploading ${pendingbackBlazePhotos.length}  Pending BackBlaze Photos for BatchId ${batchId}`
                                        );

                                        await uploadPhoto.uploadS3PhotosToVault(pendingbackBlazePhotos, userId, pendingbackBlazePhotos[0]['folder_id']);

                                    }
                                    
                                    let batchPhotos  = await this._photoVaultBatchModel.findOne({
                                        where:{
                                            batch_id: batchId
                                        },
                                        attributes:['photosCount', 'is_logged']
                                    });

                                    if(batchPhotos && !batchPhotos?.is_logged   ){                                       
                                        await this. UpdatePhotoVaultLogs({
                                            batchId,
                                            userId,
                                            photoCount: batchPhotos.dataValues.photosCount
                                        });                         
                                    }
                                }
                                else{    
                                    let userId =  batchData.dataValues.user_id;
                                    await this.deleteUserPhotosFromS3(batchId, userId);

                                    await this._personalPageVaultPhotosModel.destroy({
                                        where:{
                                            user_id: userId,
                                            batch_id: batchId
                                        }
                                    });

                                    await this._photoVaultBatchModel.destroy({
                                        where:{
                                            user_id: userId,
                                            batch_id: batchId
                                        }
                                    })
                                }
                            }
                            catch (err) {
                                global.appLogger.error(`[Error] Scheduled job for batch ${batchId} failed: ${err.message}`);
                                                     
                            } 
                            finally {                                  
                                // Remove from map after execution
                                scheduledJobs.delete(batchId);
                            }
                        });
                     
                        scheduledJobs.set(batchId, job);
                    }      


                                
                    global.appLogger.info(`\n---- End Personal Page Vault Upload Photos Api Call ----`);                            
                    return { photo: photosData };
                }     
        }
        catch(err){
            global.appLogger.error(`[Error] Personal Page Vault Upload Photos Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while upload photos`};
        }
    }



    async UpdatePhotoVaultLogs(logsData){
        try{
                let {batchId, userId, photoCount } = logsData;
                
                const backBlazePhotosCount = await this._personalPageVaultPhotosModel.count({
                    where: {
                        batch_id: batchId,
                        user_id: userId,
                        status: PhotoVaultStatusEnum.UPLOADED_TO_BACKBLAZE
                    }
                });

                if(photoCount == backBlazePhotosCount){
                    await this._photoVaultLogsModel.update({
                        notes: 'Secured in Vault',
                        fileCount: photoCount,
                    }, 
                    {
                        where: {
                            batch_id: batchId,
                            user_id: userId,
                            actionType: 'Upload',
                            notes: 'Uploaded. Securing in Vault.'
                        }
                    });

                    await this._photoVaultBatchModel.update({
                        is_logged: true
                    }, {
                        where:{
                            batch_id: batchId
                        }
                    });
                    
                    global.appLogger.info(`[End] Successfully set is_logged to true for a batchId ${batchId}`);

                    await this.deleteUserPhotosFromS3(batchId, userId);                 
                }
        }
        catch(err){
            global.appLogger.error(`[Error] Updating Photo Vault Logs for batch Id ${logsData.batchId} \n ${err.message} \n`)
        }
    }



    async deleteUserPhotosFromS3( batchId, userId ){
        try{
                
            let userPhotos = await this._personalPageVaultPhotosModel.findAll({
                where:{
                    batch_id: batchId,
                    user_id: userId
                },
                attributes:['photo_url'],
                raw: true,
            });

            const deletedPhotos = userPhotos?.map((
                { photo_url }) => photo_url?.replace(/^https?:\/\/[^/]+\/?/, '')
            ).filter(Boolean); 
                                
            if(deletedPhotos.length > 0 ){
                await uploadPhoto.deletePhotosFromS3(deletedPhotos);
                global.appLogger.info(`[End] Successfully Removed All Photos From S3 for Batch Id ${batchId}`)
            }

        }
        catch(err){
            global.appLogger.error(`[Error] Removing All Photos From S3 for BatchId ${batchId} \n ${err.message} \n`);
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
                        AND "notes"='Secured in Vault'
                    ) AS "photos_stored",
                    (
                        SELECT COUNT("fileCount")
                        FROM "photo_vault_logs"
                        WHERE "user_id" =  '${userId}'
                        AND "actionType" = 'Upload'
                        AND "notes"='Secured in Vault'
                        AND "createdAt" = (
                            SELECT MAX("createdAt")
                            FROM "photo_vault_logs"
                            WHERE "user_id" =  '${userId}'
                            AND "actionType" = 'Upload'
                            AND "notes"='Secured in Vault'
                        )
                    ) AS "last_upload_count",
                    (
                        SELECT MAX("createdAt")
                        FROM "photo_vault_logs"
                        WHERE "user_id" =  '${userId}'
                        AND "actionType" = 'Upload'
                        AND "notes"='Secured in Vault'
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

                return {stats:stats?.[0]};
                
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Photo Vault Stats Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while fetching vault stats`};
        }
    }

    async downloadBackBlazePhotos(req, res){
        try{
            let userId = req.userData._id;
            global.appLogger.info(`\n---- Start Downloading BackBlaze Photos Api Call By user Id ${userId} ----`);
    
           
            let folderId = req.body.folderId;
                        
            const data = await downloadBackBlazeFolderAsZip(`${userId}/${folderId}/`, `${folderId}`, userId, res);
            if(data){
                return data;
            }
           
        }
        catch(err){
            global.appLogger.error(`[Error] Downloading BackBlaze Photos Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while downloading BackBlaze Photos`};
        }
    }

    async DeleteVaultPhotos(req){
        try{
                let userId = req.userData._id; 
                global.appLogger.info(`\n---- Start Deleting Vault Photos Api Call By User with id ${userId} ----`);   
                
                let { photosId } = req.body;
                let photosData = await this._personalPageVaultPhotosModel.findAll({
                    where:{
                        id: {
                            [Op.in]: photosId 
                        },
                        user_id: userId
                    },
                    attributes:['photo_url', 'backBlazeImageUrl', 'compressedImageUrl'],
                    raw: true
                });

                if(photosData.length == 0){
                    return {status:'Error', message: `No photos found to delete`};
                }
                

                // Fetch Backblaze keys for these photos (if stored in DB)
                const backBlazeKeys = photosData.map(p => {
                    const url = p.backBlazeImageUrl;
                    return url ? url.replace(/^https?:\/\/[^/]+\/[^/]+\/?/, '') : null;
                }).filter(Boolean);

                if (backBlazeKeys.length > 0) {
                    await deletePhotosFromBackBlaze(backBlazeKeys);
                }               


                // Extract Cloudinary public IDs from full URLs
                const cloudinaryIds = photosData.map(p => {
                    const url = p.compressedImageUrl;
                    if (!url) return null;

                    const match = url.match(/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
                    return match ? match[1] : null;
                })
                .filter(Boolean);

                if (cloudinaryIds.length > 0) {
                    await deletePhotosFromCloudinary(cloudinaryIds);
                }


                await this._personalPageVaultPhotosModel.update({
                    isDeleted: true
                }, {
                    where:{
                        id: {
                            [Op.in]: photosId
                        },
                        user_id: userId
                    }
                });
                
                global.appLogger.info(`\n---- End Deleted Vault Photos Api Call ----`);
                return {message: 'Photos Deleted Successfully!'}
        }   
        catch(err){
            global.appLogger.error(`[Error] Deleting Vault Photos Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while deleting vault photos`};
        }
    }



    async getPhotoVaultLogs(req){
        try{
                global.appLogger.info(`\n---- Start Fetching Photo Vault Logs Api Call ----`);

                let userId = req.userData._id; 

                let logs = await this._photoVaultLogsModel.findAndCountAll({
                    where:{
                        user_id: userId
                    },
                    order:[['createdAt', 'DESC']],
                    offset: req.body.offSet,
                    limit: req.body?.limit || 10
                });
                
                 return {
                    logs: logs.rows, 
                    recordsCount: logs.count
                }
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
    
                let { folderId, batchId, photoCount } = req.body;
            
                const [batch, created] =  await this._photoVaultBatchModel.findOrCreate({
                    where: {    
                        user_id: userId,
                        batch_id: batchId,
                        folder_id: folderId
                    },
                    defaults: { 
                        user_id: userId,
                        batch_id: batchId,
                        photosCount: photoCount
                    },
                });

                

                await this._personalPageVaultPhotosModel.update({
                    folder_id: folderId,
                }, {
                    where: {
                        batch_id: batchId,
                        user_id: userId
                    }
                });

                await this._photoVaultBatchModel.update({
                    is_confirmed: true
                }, {
                    where:{
                        batch_id: batchId,
                    }
                });

            await this._photoVaultLogsModel.create({
                user_id: userId,
                batch_id: batchId,
                actionType: 'Upload',
                fileCount: photoCount,
                notes: 'Uploaded. Securing in Vault.'
            });
                    
               
            setImmediate(async () => {
                try {
                    global.appLogger.info(`\n [Start] Background Job to Upload S3 Photos to BackBlaze for batch ${batchId}`);
                    const userPhotos = await this._personalPageVaultPhotosModel.findAll({
                        where: {
                            batch_id: batchId,
                            user_id: userId,
                            status: 'uploaded_to_s3'
                        },
                        attributes: ['id', 'photo_url'],
                        raw: true
                    });

                    if(userPhotos.length > 0 ){
                        global.appLogger.info(`\n Start Uploading S3 Photos to BackBlaze inside folder ${folderId} for batch ${batchId}`);
                        await uploadPhoto.uploadS3PhotosToVault(userPhotos, userId, folderId);
        
                        let userData = await this._userModel.findOne({
                            where:{
                                id: userId
                            },
                            attributes:['member_id', 'isAssignedPhotosVaultTag']
                        });

                        if(userData['isAssignedPhotosVaultTag'] == false){
                            const secretKey = await getSecrets();
                            let mailchimpListId = secretKey.listId;
                        
                            await manageTags(userData['member_id'], mailchimpListId, 'User_Has_Photos_In_Vault', 'active');
                            await this._userModel.update({
                                isAssignedPhotosVaultTag: true
                            }, {
                                where:{
                                    id: userId
                                }
                            });
                        }
                    }
                        
                    let batchData = await this._photoVaultBatchModel.findOne({
                        where: {
                            batch_id: batchId
                        },
                        attributes:['photosCount']
                    });



                    let photoCount = batchData?.dataValues?.['photosCount']; 
                    await this.UpdatePhotoVaultLogs({
                        batchId,
                        userId,
                        photoCount
                    });
                    
                    
                     global.appLogger.info(`\n[Background Job Completed] Photos for batch ${batchId} uploaded successfully.`);
                } 
                catch (err) {
                    global.appLogger.error(`[Background Job Error] Uploading Photos for batch ${batchId} \n ${err.message} \n`);
                }
            })
                

            global.appLogger.info(`\n---- End Successfully Confirmed Photos Api Call ----`);
            return {message: 'User Photos Confirmed Successfully'}

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
             
                
                await this._foldersModel.findOrCreate({ 
                    where: { 
                        user_id: userId, 
                        folder_name: 'General Storage',
                        isDeleted: false
                    }, 
                    defaults: { 
                        user_id: userId, 
                        folder_name: 'General Storage',
                        isDefault: true 
                    }
                });

                const folders = await this._foldersModel.findAndCountAll({
                    where: { 
                        user_id: userId, 
                        isDeleted: false 
                    },
                    attributes:[ 'id', 'folder_name', 'isDefault', 'createdAt'],
                    order: [  
                        ['isDefault', 'DESC'], 
                        ['createdAt', 'DESC']
                    ]
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
                let { sortingType, sortOrder, folderId, offSet } = req.body;
                const orderDirection = sortOrder === 'ASC' ? 'ASC' : 'DESC';

                let orderBy = [];
                if (sortingType === 'date') {
                    orderBy = [['createdAt', orderDirection]];
                }
                else if(sortingType == 'size'){
                    orderBy = [['fileSize', orderDirection]];
                }
                else if(sortingType == 'name'){
                    orderBy = [['fileName', orderDirection]];
                }
                else if(sortingType == 'fileType'){
                     orderBy = [['fileType', orderDirection]];
                }


                
                global.appLogger.info(`\n---- Start Fetching Photos Api Call By User with id ${userId} ----`);
                const photos = await this._personalPageVaultPhotosModel.findAndCountAll({
                    where: { 
                        user_id: userId, 
                        folder_id: folderId,
                        isDeleted: false,
                        compressedImageUrl: {
                            [Op.ne]: null
                        }
                    },
                    attributes:[ 'id', 'compressedImageUrl', 'compressedImageId', 'folder_id', 'createdAt', 
                        'fileName', 'fileSize', 'fileType'],
                    order: orderBy,
                    offset: offSet,    
                    limit: req.body?.limit || 10
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