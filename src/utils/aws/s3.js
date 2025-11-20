import fs from 'fs';
import { Env } from '../../config';
import path from 'path';
const aws = require('aws-sdk');
import util from 'util';
import { getSecrets } from '../secret-manager';
import { PersonalPageVaultPhotosModel } from '../../models';
import { photoOptimization } from '../cloudinary/photo_optimization';
import { uploadPhotoToBackBlaze, fetchPhotoFromBackBlaze } from '../back_blaze/backBlaze';
import os from 'os';
import { generateFileHash } from '../genericFunctions';
import {sequelize} from '../database';
import { transactionCommit, transactionRollback } from '../transaction';


const secretKey = getSecrets();
aws.config.update({
    region: secretKey.aws_region,
    accessKeyId: secretKey.aws_access_key,
    secretAccessKey: secretKey.aws_secert_access_key
});
const s3 = new aws.S3();


// --- 2. Create Backblaze client (S3-compatible API) ---
const b2 = new aws.S3({
  endpoint: `https://s3.${Env.BackBlaze_Region}.backblazeb2.com`, 
  region: `${Env.BackBlaze_Region}`,
  accessKeyId: Env.BackBlaze_B2_Key,  
  secretAccessKey: Env.BackBlaze_App_Key, 
  s3ForcePathStyle: true, 
  signatureVersion: 'v4',
});

export const uploadPhoto = async (file) => {
        const fileStream = fs.createReadStream(file['tempFilePath']);
        let currentTimestamp = Date.now(); 
        const uploadParams = {
            Bucket: Env.Bucket,
            Key: "image_" + currentTimestamp + "_" + file['name'],
            Body: fileStream,
            ContentType: file['mimetype'],
            ACL: 'public-read',
        };

        const uploadPromise = util.promisify(s3.upload.bind(s3));
        try {
            let data = await uploadPromise(uploadParams);
            return data.Location;
        } 
        catch (err) {
            throw err;
        }
};


export const uploadS3PhotosToVault = async (s3Keys, userId, folderId) => {
    const transaction = await sequelize.transaction();  
    try {

         for (const s3Key of s3Keys) {
            let photoUrl = s3Key.photo_url?.replace(/^https?:\/\/[^/]+\/?/, '');
            
            // downlad photo from s3 bucket
            const s3Object = await s3.getObject({
                Bucket: Env.Bucket,
                Key: photoUrl
            }).promise();

        
           
            const s3Hash = await generateFileHash(s3Object.Body);


            const fileName = path.basename(photoUrl);
            const backblazeKey = `${userId}/${folderId}/${fileName}`;
            let backBlazeUrl = await uploadPhotoToBackBlaze(b2, Env.BackBlaze_Bucket, backblazeKey, s3Object);


            const backblazeBuffer = await fetchPhotoFromBackBlaze(b2, backblazeKey, Env.BackBlaze_Bucket);
            const backblazeHash = await generateFileHash(backblazeBuffer);
            

            // Compare hashes  
            if (s3Hash !== backblazeHash) {
                throw new Error(`Hash Mismatch for ${fileName}`);
            }

        
            const tempFilePath = path.join(os.tmpdir(), fileName);
            fs.writeFileSync(tempFilePath, s3Object.Body);


            const cloudinaryResult = await photoOptimization(tempFilePath, {
                quality: 'auto:good',    
                folder: `VaultPhotos/${userId}/${folderId}` 
            });

        
            fs.unlinkSync(tempFilePath);

            const imgExtension = cloudinaryResult.fileFormat;        
            const imgFileSizeBytes = cloudinaryResult.fileSize; 
            await PersonalPageVaultPhotosModel.update(
                { 
                    backBlazeImageUrl: backBlazeUrl,
                    compressedImageUrl: cloudinaryResult.compressedImageUrl,  
                    compressedImageId: cloudinaryResult.compressedImageId,
                    fileType: imgExtension,
                    fileSize: imgFileSizeBytes,
                    status: 'uploaded_to_BackBlaze'
                },
                {   
                    where: { 
                        photo_url: s3Key.photo_url
                    },
                    transaction 
                } 
            );
    }

        
        await transactionCommit(transaction);
        return;

  } 
  catch (err) {
    await transactionRollback(transaction);
    throw err;
  }
};


export const deletePhotosFromS3 = async (photosToDelete ) => {
    const transaction = await sequelize.transaction();  
    
    try {
            
        // delete all vault photos from s3 
        await s3.deleteObjects({
            Bucket: Env.Bucket,
            Delete: {
                Objects: photosToDelete.map(
                    (key) => ({ Key: key })
                ),
            },
        })
        .promise();
            

        await transactionCommit(transaction);
    }
    catch(err){
        await transactionRollback(transaction);
    }
}




export const uploadTempPhotos = async (file, eventId) => {
    const fileStream = fs.createReadStream(file['tempFilePath']);
    let currentTimestamp = Date.now();
    const fileKey = `${eventId}/image_${currentTimestamp}_${file['name']}`;

    const uploadParams = {
        Bucket: Env.Bucket,
        Key: fileKey,
        Body: fileStream,
        ContentType: file['mimetype'],
        ACL: 'public-read',
    };

    const uploadPromise = util.promisify(s3.upload.bind(s3));

    try {
        let data = await uploadPromise(uploadParams);
        // return both location and folder uuid for later deletion
        return data.Location;
    } 
    catch (err) {
        throw err;
    }
};


export const deleteFolderFromS3 = async (folderUUID) => {
    try {
        // Ensure prefix ends with a slash
        const prefix = folderUUID.endsWith("/") ? folderUUID : `${folderUUID}/`;

        // 1. List all objects under this prefix
        const listedObjects = await s3.listObjectsV2({
            Bucket: Env.Bucket,
            Prefix: prefix,
        }).promise();

        if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
            global.appLogger.info(`No objects found for folder: ${prefix}`);
            return;
        }
        

        // 2. Build array of keys to delete
        const deleteParams = {
            Bucket: Env.Bucket,
            Delete: {
                Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key })),
            },
        };

        // 3. Delete objects
        await s3.deleteObjects(deleteParams).promise();
        global.appLogger.info(`Successfully deleted folder: ${prefix}`);

        // 4. Handle pagination (more than 1000 files)
        if (listedObjects.IsTruncated) {
            await deleteFolder(folderUUID);
        }
    } catch (err) {
        global.appLogger.error(`[Error] Failed to delete folder from S3: ${err.message}`);
        throw new Error(`Failed to delete folder from S3: ${err.message}`);
    }
};
