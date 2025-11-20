 

 export async function uploadPhotoToBackBlaze(b2, BackBlaze_Bucket, BackBlaze_Region, backblazeKey, s3Object) {
    try{
            const uploadParams = {
                Bucket: BackBlaze_Bucket,
                Key: backblazeKey,
                Body: s3Object.Body,
                ContentType: s3Object.ContentType || 'application/octet-stream',
                ACL: 'private',
            };

            const result = await b2.upload(uploadParams).promise();
            let backBlazeUrl = `https://s3.${BackBlaze_Region}.backblazeb2.com${result.Location}`; 
            return backBlazeUrl;
    }
    catch(err){
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