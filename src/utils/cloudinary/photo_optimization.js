import {v2 as cloudinary} from 'cloudinary';

export async function photoOptimization(filePath, photoParams) {
  try{
      let result = await cloudinary.uploader.upload(filePath, {
          quality: photoParams.quality,
          fetch_format: "webp",
          folder: photoParams.folder     
      })

      let compressedUrl = result.secure_url.split('/');
      const ImageFileName = compressedUrl[compressedUrl.length - 1];

      return {
        compressedImageUrl: result.secure_url, 
        fileFormat: result.format,
        fileSize: result.bytes,
        compressedImageId: ImageFileName
      }
    }
    catch(err){
      throw err;
    }
}


export async function deletePhotosFromCloudinary(publicIds) {
    try {
 
        const photoIds = Array.isArray(publicIds) ? publicIds : [publicIds];

        if (photoIds.length > 0) {
          const result = await cloudinary.api.delete_resources(photoIds,  { invalidate: true });                

          global.appLogger.info(`Successfully deleted ${photoIds.length} photos from Cloudinary`);
          return result;
        }
    } 
    catch (err) {
      global.appLogger.error(`[Error] Failed to delete Cloudinary photos: ${err.message} \n`);
      throw err;
    }
};


export async function deleteCloudinaryFolder(folderUuid) {
  try {
      // 1. Delete all resources inside the folder
      await cloudinary.api.delete_resources_by_prefix(folderUuid, {
          resource_type: "image",
          invalidate: true
        });

      // 2. Delete the folder itself
      await cloudinary.api.delete_folder(folderUuid);

      return;
  } 
  catch (err) {
     throw err;
  }
}