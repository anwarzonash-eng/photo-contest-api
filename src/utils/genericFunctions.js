import bcrypt from 'bcrypt'
const CryptoJS = require("crypto-js");
import { sequelize } from './database';
import { HuntScoreModel, UserModel, GalleryPhotoModel, PersonalWebsiteModel, PersonalPhotoModel } from '../models';
import { transactionCommit, transactionRollback } from './transaction';
const uploadPhoto = require("./aws/s3");
import schedule from 'node-schedule';
import { Op } from 'sequelize';
import { QueryTypes } from 'sequelize';
import {Env} from '../config';

export async function hashpassword(password) {
    try{
        const saltRounds = 10;
        const salt = await bcrypt.genSalt(saltRounds, 'a');
        const hashedPassword = await bcrypt.hash(password, salt);
        return hashedPassword;
    }
    catch(err){
        throw err;
    }
}

export async function generateFileHash(buffer){
    try{
         const hashedData = CryptoJS.SHA1(CryptoJS.lib.WordArray.create(buffer)).toString();
         return hashedData;
    }
    catch(err){
        throw err;
    }
}



export function randomPassword() {
    try{
        const length = 6;
        let password = '';

        for (let i = 0; i < length; i++) {
            const randomDigit = Math.floor(Math.random() * 10); // Generate a random digit (0-9)
            password += randomDigit;
        }
        return password;
    }
    catch(err){
        throw err;
    }
}

//Encrypt
export function encrypt(text, secretKey) {
    try{
        const timestamp = Date.now() + 60 * 60 * 1000; // 1 hour expiration time
        const encryptedText = CryptoJS.AES.encrypt(JSON.stringify({ userId: text, timestamp }), secretKey).toString();
        return {encryptedText, timestamp};
    }
    catch(err){
        throw err;
    }
}


export async function encryptUserProfile(userData) {
    try{
        const encryptedUserData = CryptoJS.AES.encrypt(JSON.stringify(userData), 'REDACTED_FRONTEND_KEY').toString();
        const encryptedUrl = `${Env.Base_Url}/otherusers-profile?userdata=${encodeURIComponent(encryptedUserData)}`;
        return encryptedUrl;
    }
    catch(err){
        throw err;
    }
}

//Decrypt
export function decrypt(encryptedText, secretKey) {
    try{
        const bytes = CryptoJS.AES.decrypt(encryptedText, secretKey);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);
        const data = JSON.parse(decryptedText);
    
        // Check if the token has expired
        if (Date.now() > data.timestamp) {
        throw new Error('Reset Password Link has been expired!');
        }
        return data;
    }
    catch(err){
        throw err;
    }
}


export function shuffleData(data){
    try{
        for (let i = data.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [data[i], data[j]] = [data[j], data[i]];
        }
        return data;
    }
    catch(err){
        throw err;
    }
}

export async function generateUniqueShortCode(length = 6) {
    let isUnique = false;
    let code = "";
  
    while (!isUnique) {
        const randomBytes = CryptoJS.lib.WordArray.random(16); // 16 bytes
        code = CryptoJS.enc.Base64url.stringify(randomBytes).slice(0, length);
        const existingUser = await UserModel.findOne({ 
            where: { 
                profileCode: code 
            } 
        });
    
        if (!existingUser) {
            isUnique = true;
        }
    }
  
    return code;
  }

  
export async function updateHuntScorePoints(userId, huntType, points){
    const transaction = await sequelize.transaction();
    try {
        const [huntScore] = await HuntScoreModel.findOrCreate({
            where: { user_id: userId },
            defaults: { scores: {} },
            transaction,
        });

        huntScore.scores[huntType] = (huntScore.scores[huntType] || 0) + points;

        // Mark the scores field as changed
        huntScore.changed('scores', true);
        await huntScore.save({ transaction });
        await transactionCommit(transaction);
        global.appLogger.info(`[End] Successfully Added ${huntType} Hunt Score ${JSON.stringify(huntScore.scores)} For User ${userId} \n`);
        
    } 
    catch (error) {
      await transactionRollback(transaction);
      global.appLogger.error(`[Error] ${huntType} Hunt Score Transaction Failed For User ${userId} \n ${error.message} \n`);
    }
}

export async function updateGalleryHuntScorePoints(userId){
    try{      
        const GalleryhuntScore = await HuntScoreModel.findOne({
            where:{
                user_id: userId,
                'scores.gallery_photo': {
                    [Op.ne]: null 
                }
            },
            attributes:['scores']
        });

        if (!GalleryhuntScore) {
            await updateHuntScorePoints(userId, 'gallery_photo', 50);
            await incrementHuntScorePoints(userId, 50);
        }
        else{
            global.appLogger.info(`[End] Already Assigned Gallery Hunt Score For User ${userId}`);
        }   
    }
    catch(err){
        global.appLogger.error(`[Error] Updating Gallery Hunt Score Points By User ${userId} ${err.message} \n`)
    } 
}



export async function scheduledGalleryPhotos(userId, galleryQueue) {
    try{
        global.appLogger.info(`[Start] Scheduling Grayed Out Gallery Photos more than 5 for 12 Hours`);                 

        // Cancel any previously scheduled job for this user
        if (galleryQueue.has(userId)) {
          const job = galleryQueue.get(userId);
          job.cancel();
        }

        
        const twelveHoursLater =  new Date(Date.now() + 12 * 60 * 60 * 1000);
        //new Date(Date.now() + 1 * 60 * 1000);  

       
        // const twoHours = new Date(Date.now() + 2 * 60 * 1000);                       

        const job = schedule.scheduleJob(twelveHoursLater, async () => {
        try {
              global.appLogger.info(`[Start] Inside 12 Hours Scheduled Gallery Photo Function`);  
              let user = await UserModel.findOne({
                where:{
                  id: userId
                }, 
                attributes:['isPaid']
              });

                if (user.dataValues.isPaid == false) {                         
                    const falsyGalleryPhotos = await GalleryPhotoModel.count({
                        where:{
                            user_id: userId,
                            photo_display_status: 'false'
                        }
                    });

                    const truthyGalleryPhotos = await GalleryPhotoModel.count({
                        where:{
                            user_id: userId,
                            photo_display_status: 'true'
                        }
                    });

                    if(falsyGalleryPhotos < 5 && truthyGalleryPhotos){
                        let updatedPhotos = 5 - falsyGalleryPhotos;   // 2
                        const photos = await GalleryPhotoModel.findAll({
                            where:{
                                user_id: userId,
                                photo_display_status: 'true'
                            },
                            attributes:['id'],
                            order:[['createdAt', 'ASC']],
                            limit: updatedPhotos
                        });

                        for(let i=0; i< photos.length; i++){
                            await GalleryPhotoModel.update({
                                photo_display_status: 'false'
                                }, {
                                    where:{
                                       id: photos[i]['dataValues']['id']
                                    }

                            })
                        }
                    }
       
                    await GalleryPhotoModel.update({
                        photo_display_status: 'expired'
                    }, {
                        where:{
                            user_id: userId,
                            photo_display_status: 'true'
                        }
                    });
                    global.appLogger.info(`[End] Successfully Scheduled Grayed Out Gallery Photos Expired For Non-Paid User`);  
              }
              else {
                    await GalleryPhotoModel.update({
                        photo_display_status: false 
                    }, {
                        where:{
                            user_id: userId
                        }
                    });
                    global.appLogger.info(`[End] Successfully Scheduled Grayed Out Gallery Photos Updated For Paid User`);  
              }
            }
            catch(err){
                global.appLogger.error(`[Error] Inside Scheduling Grayed Out Gallery Photo Function By Upload Photo ${err.message}\n`);  
            }
            finally{
              galleryQueue.delete(userId);
            }
          });

          galleryQueue.set(userId, job);     
    }
    catch(err){
        global.appLogger.error(`[Error] Scheduling Grayed Out Gallery Photos By User ${userId} ${err.message} \n`)
    }                 
}


export async function addGalleryPhoto(userId, photoData, optimizedData, metaData, photosCount, isHunted){
    try{
       
        let photo_display_status;
        if(photosCount >= 5){
            photo_display_status = true;
        }

        await GalleryPhotoModel.create({
            photo_url: photoData,
            user_id: userId,
            compressedImageUrl: optimizedData.compressedImageUrl,
            compressedImageId: optimizedData.compressedImageId,
            metadata: metaData, 
            photo_display_status: photo_display_status,
            isHunted: isHunted
        });
    }
    catch(err){
        global.appLogger.error(`[Error] Adding Gallery Photo By User ${userId} ${err.message} \n`);
    }
}


export async function incrementHuntScorePoints(userId, points){
    try{         
        await UserModel.increment('total_hunt_scores', {
            by: points, 
            where: {
                id: userId
            },
        });
    }
    catch(err){}
}

export async function decrementHuntScorePoint(huntScoreType, points, userId){
    try{
        await HuntScoreModel.sequelize.query(`UPDATE hunt_scores SET scores = jsonb_set(
                scores, '{${huntScoreType}}', 
                to_jsonb(greatest(
                    coalesce(nullif((scores ->> '${huntScoreType}')::integer, null), 0) - ${points}, 
                    0
                ))
            )
            WHERE user_id = :userId AND 
            (scores ->> '${huntScoreType}')::integer > 0`, 
        {
            replacements: { userId },
            type: QueryTypes.UPDATE
        });  
        
        await incrementHuntScorePoints(userId, `-${points}`);
        
        global.appLogger.info(`[End] Successfully Decremented Hunt Score Point ${points} For Hunt Score Type ${huntScoreType} By User ${userId} \n`)
    }
    catch(err){
        global.appLogger.error(`[Error] Decrementing Hunt Score Points For Hunt Score Type ${huntScoreType} By User ${userId} ${err.message} \n`)
    }
}


export async function getUserRegularNotifications(userId, offset, limit){
     try{
             let query = `Select n."id", n."notification_type", n."createdAt", n."updatedAt", n."is_seen",
                        json_build_object(
                            'id', u."id",
                            'notification_createdAt', TO_CHAR(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                            'receiver_id',n."receiver_id",
                            'sender_id',n."sender_id",
                            'name', u."name",
                            'text', n."text",
                            'state', u."state",
                            'profile_pic', ( CASE 
                                WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                                ELSE u."photo_url"
                                END),
                            'compressedProfileId', u."compressedProfileId",
                            'photo_url', p."compressedImageUrl",
                            'original_photo_url', p."photo_url",
                            'compressedImageId', p."compressedImageId",
                            'photo_owner_id', p."user_id",
                            'login_username', (Select "name" from "Users" u1 where u1."id"='${userId}'),
                            'login_photo_url', (SELECT CASE 
                                WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                ELSE u1."photo_url"  END 
                                FROM "Users" u1 
                                WHERE u1."id"='${userId}'
                            ),
                            'is_follow', (Select Exists(Select * from "Followers" where "user_id"= n."receiver_id" and "follower_id"= n."sender_id" and "is_active"=true)),
                            'comment_id', c."id",
                            'comment_text', c."comment_text",
                            'photo_id', p."id",
                            'top_comment_id', (Select "top_comment_id" from "Comments" where "id"=n."comment_id"),
                            'sub_comment_id', c."id",
                            'comment_createdAt', c."createdAt",
                            'is_photo_upvoted', (SELECT EXISTS( SELECT * FROM "Votes" WHERE "photo_id" = p."id"  and "user_id"='${userId}' and "is_vote"=true) ),
                            'photo_upvoted_count', (Select count(*) from "Votes" where "photo_id"= p."id" and "is_vote"=true),
                            'upvoted_count', (Select count(*) from "like_comments" c1 where c1."comment_id"=n."comment_id" ),
                            'is_vote', (Select Exists(Select * from "like_comments" where 
                            "user_id"='${userId}' and "comment_id"=n."comment_id")),
                            'is_thanked', (case 
                            WHEN n."notification_type"='upvote_photo' then (Select Exists(Select * from "notifications" where 
                            "receiver_id"=n."sender_id" and "sender_id"=n."receiver_id" and 
                            "photo_id"=n."photo_id" and "notification_type"='thanks_on_upvote')) 
                            
                            WHEN n."notification_type" = 'upvote_comment' then (Select Exists(Select * from "notifications" where 
                            "receiver_id"= n."sender_id" and "sender_id"=n."receiver_id" and "photo_id"=n."photo_id" 
                            and "notification_type"='thanks_on_upvote_comment' and "comment_id"= n."comment_id")) 
                            
                            WHEN n."notification_type" = 'congratulate_weekly_toptenuser' then 
                            (Select Exists(Select * from "notifications" where 
                            "receiver_id"=n."sender_id" and "sender_id"=n."receiver_id" and 
                            "photo_id"=n."photo_id" and "notification_type"='thanks_on_weeklytopten_congratulation'))
                            
                            WHEN n."notification_type" = 'thanks_on_weeklytopten_congratulation' then 
                            (Select Exists(Select * from "notifications" where 
                            "receiver_id"=n."sender_id" and "sender_id"=n."receiver_id" and 
                            "notification_type"='thanks_weekly_toptenuser')) else null end),
        
                            'isCongratulateTopTenUser', case 
                            WHEN n."notification_type"='follower_in_weekly_top_ten'
                            then (Select Exists(Select * from "notifications" where 
                            "receiver_id"=n."sender_id" and "sender_id"=n."receiver_id" and 
                            "photo_id"=n."photo_id" and  "notification_type"='congratulate_weekly_toptenuser')) 
                            else null end,
                            'genres_list', (
                                SELECT json_object_agg(genre, genre)
                                FROM unnest(string_to_array(u."genres_list", ',')) AS genre
                            ),
                            'camera_brand', u."camera_brand"
                        ) AS message
                        from "notifications" n
                        left join "Users" u on n."sender_id"= u."id"
                        left join "Photos" p on p."id"= n."photo_id"
                        left join "Comments" c on c."id"= n."comment_id"
                        where "receiver_id"= '${userId}' and u."isBlocked"=false and "text"='regular' 
                        order by 
                            CASE WHEN (n."notification_type" = 'Inactive for 56 days' and "is_seen"= false) THEN 1 
                            ELSE 0 END DESC,
                            "is_seen" = false DESC, 
                            n."createdAt" DESC 
                        limit ${limit} 
                        offset '${offset}'`;
                                
            let result = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT
            });

            return result;
        }
        catch(err){
            throw err;
        }
}
       
export async function getUserPhotoNotifications(userId, photoOffset, PhotoNotificationLimit){
    try{            
        let PhotoNotification = `WITH ranked_notifications AS ( 
            Select n."id", n."notification_type", 
            n."createdAt", n."updatedAt", n."is_seen",
            json_build_object(
                'id', u."id",
                'notification_createdAt', TO_CHAR(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                'receiver_id',n."receiver_id",
                'sender_id',n."sender_id",
                'name', u."name",
                'text', n."text",
                'state', u."state",
                'profile_pic', ( CASE 
                    WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                    ELSE u."photo_url"
                    END
                ),
                'compressedProfileId', u."compressedProfileId",
                'photo_url', p."compressedImageUrl",
                'original_photo_url', p."photo_url",
                'compressedImageId', p."compressedImageId",
                'photo_owner_id', p."user_id",
                'photo_id', p."id",
                'is_photo_upvoted', (
                    SELECT EXISTS( 
                        SELECT * FROM "Votes" WHERE "photo_id" = p."id"  and "user_id"='${userId}' and "is_vote"=true
                    ) 
                )
            ) AS message,
            ROW_NUMBER() OVER (PARTITION BY n."photo_id" ORDER BY n."createdAt" DESC) AS row_num
            from "notifications" n
            left join "Users" u on n."sender_id"= u."id"
            left join "Photos" p on p."id"= n."photo_id"
            left join "Comments" c on c."id"= n."comment_id"
            where "receiver_id"= '${userId}' and u."isBlocked"=false 
            AND n."text" != 'regular'
        )
        SELECT * FROM ranked_notifications
        WHERE row_num = 1
        ORDER BY "createdAt" DESC
        LIMIT ${PhotoNotificationLimit}
        OFFSET ${photoOffset}`;
    
        let PhotoNotificationResult = await sequelize.query(PhotoNotification, {
            type: sequelize.QueryTypes.SELECT
        });
        
        return PhotoNotificationResult;
    }
    catch(err){
        throw err;
    }
}

export async function updateUserNotifications(query, receiverId){
    try{    
            let postedUser = await UserModel.findOne({
                where :{
                    id: receiverId
                },
                attributes:['notifications']
            });       
                            
            let Notifications = postedUser.dataValues.notifications;
            if(Notifications == null){
                let RegularNotificationResult = await  getUserRegularNotifications(receiverId, 0, 20);              
                let PhotoNotificationResult = await getUserPhotoNotifications(receiverId, 0, 4); 
                if(RegularNotificationResult || PhotoNotificationResult){                                
                    Notifications = [
                        {
                            notification_type: 'regular',
                            regular_notifications: RegularNotificationResult
                        },
                        {
                            notification_type: 'posted_photo',
                            photo_notifications: PhotoNotificationResult
                        }
                    ]                                            
                }                        
            }
            else{
                    const regularNotifObj = Notifications.find(n => n.notification_type === 'regular');
                    let regularNotifications = regularNotifObj?.regular_notifications || [];
                        
                    const photoNotifObj = Notifications.find(n => n.notification_type === 'posted_photo');
                    let photoNotifications = photoNotifObj?.photo_notifications || [];
                    if (regularNotifications.length === 20) {
                        regularNotifications.pop(); 
                    } 
                    
                    let userNotification = await sequelize.query(query, {
                            type: sequelize.QueryTypes.SELECT,
                    });
                               
                    if(userNotification){
                        regularNotifications.unshift(userNotification[0]);
                    }
                    Notifications = [
                                {
                                    notification_type: 'regular',                                     
                                    regular_notifications: regularNotifications
                                },
                                {
                                    notification_type: 'posted_photo',
                                    photo_notifications: photoNotifications                                       
                                }
                    ]                 
                }                            
                                        
                await UserModel.update({
                    notifications: Notifications
                },
                {
                    where:{
                        id: receiverId
                    }
                });                         
    }
    catch(err){
        console.log(err.message);
        throw err;
    }
}


export async function removeUserNotificationById(receiverId, notificationId){
    try{
        await sequelize.query(`UPDATE "Users" SET notifications = jsonb_set(
            notifications, '{0,regular_notifications}',
            (
                SELECT jsonb_agg(elem)
                FROM jsonb_array_elements(notifications->0->'regular_notifications') AS elem
                WHERE elem->>'id' != '${notificationId}'
            )
        )
        WHERE id = '${receiverId}'
        AND notifications->0->>'notification_type' = 'regular'`, {
        type: sequelize.QueryTypes.UPDATE
    });
    }
    catch(err){
        console.log(err.message);
        throw err;
    }
}

export async function checkWebsitePublished(createdAt) {
  try {
    const gracePeriodMinutes = 56;

    const createdTime = new Date(createdAt);

    // add 56 minutes in ms
    const publishTime = new Date(createdTime.getTime() + gracePeriodMinutes * 60000);

    const now = new Date();

    if (now < publishTime) {
      const diffMs = publishTime - now;

      const minutesLeft = Math.floor(diffMs / 60000);
      const secondsLeft = Math.floor((diffMs % 60000) / 1000);

      return {
        published: false,
        minutesLeft,
        secondsLeft,
      };
    }

    return {
      published: true,
      minutesLeft: 0,
      secondsLeft: 0,
    };
  } 
  catch (err) {
    throw err;
  }
}


export async function deleteInActiveUserPhotos(eventId, photoType = 'uploaded_photos'){
    try{
            const inActivePhotos = await PersonalPhotoModel.count({
                where: { 
                    eventId, 
                    isActive: false
                }
            });
                                                        
                                    
            if (inActivePhotos > 0){
                if(photoType == 'uploaded_photos'){
                    await uploadPhoto.deleteFolderFromS3(eventId);
                }
        
                                            
                // 1. Get the photos to delete
                const photosToDelete = await PersonalPhotoModel.findAll({
                    where: { 
                        eventId 
                    },
                    attributes: ['id', 'user_id'],   
                    raw: true                                      
                });
        
                const deleteIds = photosToDelete.map(p => p.id);
                    if (deleteIds.length > 0) {
                        let userId = photosToDelete[0]['user_id'];
                                                
                        const personalWebsite = await PersonalWebsiteModel.findOne({
                            where: { user_id: userId },
                            attributes: ['id', `${photoType}`]
                        });
        
                        
                        if (personalWebsite) {                                                    
                            let updatedPhotos = personalWebsite[photoType].filter(
                                id => !deleteIds.includes(id)
                            );
        
                            await personalWebsite.update({
                                [photoType]: updatedPhotos
                            });
                        }
                                          
                        await PersonalPhotoModel.destroy({
                            where: { id: { [Op.in]: deleteIds } }
                        });
                    }
        
                }
    }
    catch(err){
        throw err;
    }
}


