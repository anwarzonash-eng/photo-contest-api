 
import aws from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Env } from '../../config';


const b2 = new aws.S3({
  endpoint: `https://s3.${Env.BackBlaze_Region}.backblazeb2.com`, 
  region: `${Env.BackBlaze_Region}`,
  accessKeyId: Env.BackBlaze_B2_Key,  
  secretAccessKey: Env.BackBlaze_App_Key, 
  s3ForcePathStyle: true, 
  signatureVersion: 'v4',
});



export async function downloadBackBlazeFolderAsZip( folderPrefix, zipFileName, userId, res ) {
  try {
    
            const listedObjects = await b2.listObjectsV2({
                Bucket: Env.BackBlaze_Bucket,
                Prefix: folderPrefix,
            }).promise();
            

            if (listedObjects && listedObjects.Contents.length === 0) {
                return {message: 'No Photos Exist in the specified folder'};
            }



            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}.zip"`);

            //  stream zip directly to response 
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.pipe(res);

            // Download each file and append it to the zip
            for (const file of listedObjects.Contents) {
                const key = file.Key;

                //  use Backblaze getObject stream correctly
                const fileStream = b2.getObject({
                    Bucket: Env.BackBlaze_Bucket,
                    Key: key,
                }).createReadStream();

                archive.append(fileStream, {
                    name: path.basename(key),
                });
            }

            archive.finalize();

            archive.on('error', (err) => {
                global.appLogger.error(`[Download BackBlaze Error] ${err.message} \n`);
            });  

            
            global.appLogger.info(`\n [End] Successfully Downloaded BackBlaze Photos By user Id ${userId} \n`);
            return;
        
        
    } 
    catch (err) {
        throw err;
    }
}







export async function uploadPhotoToBackBlaze(b2, BackBlaze_Bucket, backblazeKey, s3Object) {
    try{
            const uploadParams = {
                Bucket: BackBlaze_Bucket,
                Key: backblazeKey,
                Body: s3Object.Body,
                ContentType: s3Object.ContentType || 'application/octet-stream',
                ACL: 'private',
            };

            await b2.upload(uploadParams).promise();
            let backBlazeUrl = `https://${b2.endpoint.hostname}/${BackBlaze_Bucket}/${backblazeKey}`;
            return backBlazeUrl;
    }
    catch(err){
        throw err;
    }
 }
 

 export async function deletePhotosFromBackBlaze( backblazeKeys = [] ) {
    try {
        if (!Array.isArray(backblazeKeys) || backblazeKeys.length === 0) {
            throw new Error('No Backblaze keys provided for deletion');
        }

        const deleteParams = {
            Bucket: Env.BackBlaze_Bucket,
            Delete: {
                Objects: backblazeKeys.map(
                    (key) => (
                        { Key: key }
                    )
                ),
            },
        };

        await b2.deleteObjects(deleteParams).promise();

        global.appLogger.info(`Successfully deleted ${backblazeKeys.length} photo(s) from BackBlaze`);
        return true;
    } 
    catch (err) {
        global.appLogger.error(`[Error] Failed to delete BackBlaze photos: ${err.message} \n`);
        throw err;
    }
}


 export async function fetchPhotoFromBackBlaze(b2, backblazeKey, BackBlaze_Bucket){
    try{
        const backblazeObject = await b2.getObject({
            Bucket: BackBlaze_Bucket,
            Key: backblazeKey,
        }).promise();


        return backblazeObject.Body;
    }
    catch(err){
        throw err;
    }
}