import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export async function generateSignedUrl(bucketName, objectKey) {
  try{
            const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        });


        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

        return signedUrl;
    }
    catch(err){
        console.log(err);
    }
}

