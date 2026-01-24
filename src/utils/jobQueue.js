const Queue = require('bull');
import { NotificationModel, UserModel } from '../models';
import { sequelize } from './database';
import { manageTags } from "./mailchimp/tags.js";
import { getSecrets } from "./secret-manager.js";
const redis = require('redis');
const redisClient = redis.createClient();


redisClient.on('ready', () => {
    global.appLogger.info(`Redis client connected From Job Queue`);
});
redisClient.on('error', (err) => {
    global.appLogger.error(`Redis error From Job Queue:  ${err} \n`);
});


const notificationQueue = new Queue('notificationQueue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
});


const personalWebsite60MinTagQueue = new Queue('Personal_Website_60min_Ready_TagQueue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
  },
});


// Process jobs in the queue
notificationQueue.process(async (job) => {
    const { userId } = job.data;
    try{  
        global.appLogger.info(`[Start] Processing Notification Queue For User ${userId}`);       
        const RegularNotificationCount = await NotificationModel.count({
            where:{
              receiver_id: userId,
              text: 'regular'
            }
        });

        if(RegularNotificationCount >= 5){
            const notificationList = await processNotifications(userId);
            return notificationList; 
        }
    }
    catch(err){
        global.appLogger.error(`[Error] Cached Notifications For User ${userId} \n ${err.message} \n`)
    }
});


personalWebsite60MinTagQueue.process(async (job) => {
    const { memberId, mailchimplistId } = job.data;

    try {
            global.appLogger.info(`[Start] Processing Personal Website 60 Min Ready Tag for memberId ${memberId}`);

            await manageTags( memberId, mailchimplistId,'Personal_Website_60min_Ready', 'active');

            return true;
    }
    catch (err) {
        global.appLogger.error(`[Error] Personal Website 60 Min Ready Tag for memberId ${memberId}\n${err.message}\n`);
        throw err;
    }
});


export async function processNotifications(userId) {
   try{
            const followerPostedPhotoQuery = sequelize.query(`SELECT p.id, p."user_id"
                FROM "Photos" p
                INNER JOIN "Followers" f ON p."user_id" = f."follower_id" and f.user_id = '${userId}'
                AND f."is_active" = true
                LEFT JOIN "Votes" v ON p.id = v."photo_id" AND v."user_id" = '${userId}'
                LEFT JOIN "Comments" c ON p.id = c."photo_id" AND c."user_id" = '${userId}'
                Where p."isQueued"=false
                AND p."createdAt"::timestamp >= date_trunc('week', CURRENT_DATE)
                AND p."createdAt"::timestamp < date_trunc('week', CURRENT_DATE) + interval '1 week'
                AND v.photo_id IS NULL AND c.photo_id IS NULL
                AND NOT EXISTS (
                    SELECT 1 FROM "notifications" n WHERE n."sender_id"= p."user_id" AND 
                    n."receiver_id" = '${userId}' AND n."photo_id" = p.id
                    and n."text" !='regular'
                )`, {
                    type: sequelize.QueryTypes.SELECT
            })

            
            const trendingPhotosQuery = sequelize.query(`SELECT p.id AS photo_id, p."user_id", COUNT(v.photo_id) AS upvotes
                FROM "Photos" p
                INNER JOIN "Votes" v ON p.id = v.photo_id
                WHERE p."createdAt"::timestamp >= date_trunc('week', CURRENT_DATE)
                and p."isQueued"=false and v."is_vote"=true and p."user_id"!='${userId}'
                AND p.id NOT IN (
                    SELECT photo_id FROM "Votes" WHERE user_id = '${userId}'
                    and "is_vote"=true
                    UNION
                    SELECT photo_id FROM "Comments" WHERE user_id = '${userId}'
                    UNION
                    SELECT photo_id FROM "notifications" WHERE receiver_id='${userId}'
                    and sender_id= p."user_id" and "photo_id"=p."id" and text!='regular'
                )
                GROUP BY p.id
                HAVING COUNT(v.photo_id) >= 5`, {
                    type: sequelize.QueryTypes.SELECT
            });


            const upvotedPhotosQuery = sequelize.query(`SELECT p.id AS photo_id, p.user_id
                FROM "Photos" p
                WHERE p."createdAt"::timestamp >= date_trunc('week', CURRENT_DATE)
                AND p."isQueued"=false and p."user_id"!='${userId}'
                AND p."user_id" IN (
                    SELECT DISTINCT p.user_id
                    FROM "Photos" p
                    INNER JOIN "Votes" v ON p.id = v.photo_id
                    WHERE v."user_id" = '${userId}'
                    and v."is_vote"=true
                )
                AND p.id NOT IN (
                SELECT photo_id FROM "Votes" WHERE user_id = '${userId}'
                and "is_vote"=true
                    UNION
                    SELECT photo_id FROM "Comments" WHERE user_id = '${userId}'
                    UNION
                    SELECT photo_id FROM "notifications" WHERE receiver_id = '${userId}'
                    and sender_id= p."user_id" and "photo_id"=p."id"
                )`, {
                    type: sequelize.QueryTypes.SELECT
                });

                const [followersPhotos, trendingPhotos, upvotedPhotos] = await Promise.all([
                    followerPostedPhotoQuery,
                    trendingPhotosQuery,
                    upvotedPhotosQuery
                ]);

                if (followersPhotos.length) {
                    await createNotifications(followersPhotos, 'who you follow, posted a photo', 'id', userId);
                } else if (trendingPhotos.length) {
                    await createNotifications(trendingPhotos, 'who is trending, posted a photo','photo_id', userId);
                } else if (upvotedPhotos.length) {
                    await createNotifications(upvotedPhotos, 'who you upvoted before, posted a photo','photo_id', userId);
                } else {                 
                    const userGenre = await UserModel.findOne({
                        where: {
                        id: userId
                        },
                        attributes:['genres_list']
                    });

                    const genres_list = userGenre.dataValues.genres_list;
                    if(genres_list!= null){
                        const genre = genres_list.split(',');
                        const conditions = genre.map(genre => `p."genres_list" LIKE '%${genre.trim()}%'`);
                        const genresListQuery = `SELECT p.id, p."user_id",u."genres_list" 
                            FROM "Photos" p inner join "Users" u  on u."id"= p."user_id"
                            WHERE p."createdAt"::timestamp >= date_trunc('week', CURRENT_DATE)
                            and p."isQueued"=false and u."genres_list" IS NOT NULL
                            AND p."user_id"!='${userId}'
                            AND p.id NOT IN (
                                SELECT photo_id FROM "Votes" WHERE user_id='${userId}'
                                and "is_vote"= true
                                UNION
                                SELECT photo_id FROM "Comments" WHERE user_id='${userId}'
                                UNION
                                SELECT photo_id FROM "notifications" WHERE receiver_id='${userId}'
                                and sender_id= p."user_id" and "photo_id"= p."id"
                            ) and (${conditions.join(' OR ')}
                        )`;

                        const genresMatchedUsers = await sequelize.query(genresListQuery, {
                            type: sequelize.QueryTypes.SELECT
                        });

                        if(genresMatchedUsers.length){
                            await createNotifications(genresMatchedUsers, 'who likes similar genres, posted a photo','id', userId);                          
                        }
                        else {
                            await RandomPhotos(userId)
                        }
                    }
                    else {
                        await RandomPhotos(userId)
                    }
            }
   }
   catch(err){
        global.appLogger.error(`[Error] Fetching Notification From DB By User ${userId} \n ${err.message} \n`);
   }
}



async function RandomPhotos(userId){
    try{
        const randomPhotoQuery =  `SELECT p.id, p."user_id"
        FROM "Photos" p WHERE p."isQueued"=false And
        p."createdAt"::timestamp >= date_trunc('week', CURRENT_DATE)
        AND p.id NOT IN (
            SELECT photo_id FROM "Votes" WHERE user_id = '${userId}'
            and "is_vote"=true
            UNION
            SELECT photo_id FROM "Comments" WHERE user_id = '${userId}'
            UNION
            SELECT photo_id FROM "notifications" WHERE receiver_id = '${userId}'
            and sender_id= p."user_id" and "photo_id"=p."id" and text!='regular'
        ) and p."user_id"!='${userId}'`;
                        
        const randomPhotoList =  await sequelize.query(randomPhotoQuery, {
            type: sequelize.QueryTypes.SELECT
        });
        
        if(randomPhotoList.length){
            await createNotifications(randomPhotoList, 'who wants to share more, posted a photo','id', userId);                          
        }
        return;
    }
    catch{}
}

notificationQueue.on('completed', (job, result) => {
  global.appLogger.info(`[End] Job with id ${job.id} has been completed \n`);
});

notificationQueue.on('failed', (job, err) => {
  global.appLogger.error(`[Error] Job with id ${job.id} has failed. Error: ${err.message} \n`);
});



async function createNotifications(photos, text, photo_id, receiverId) {
    try{
        const newNotifications = [];
        for (const photo of photos) {          
                const [notification, created] = await NotificationModel.findOrCreate({
                    where: {
                        receiver_id: receiverId,
                        notification_type: 'posted_photo',
                        photo_id: photo[photo_id],
                        sender_id: photo.user_id,
                        text
                    },
                    defaults: {
                        receiver_id: receiverId,
                        notification_type: 'posted_photo',
                        photo_id: photo[photo_id],
                        sender_id: photo.user_id,
                        text
                    }
                });

                if (created) {
                    let query = ` Select n."id", n."notification_type", n."createdAt", n."updatedAt", n."is_seen",
                        json_build_object(
                            'id', u."id",
                            'notification_createdAt', TO_CHAR(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                            'receiver_id', n."receiver_id",
                            'sender_id', n."sender_id",
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
                                    SELECT * FROM "Votes" WHERE "photo_id" = p."id"  and "user_id"='${receiverId}' and "is_vote"=true
                                ) 
                            )
                            ) AS message
                            from "notifications" n
                            left join "Users" u on n."sender_id"= u."id"
                            left join "Photos" p on p."id"= n."photo_id"
                            where n."id"='${notification.id}'`;

                    let result = await sequelize.query(query, {
                                type: sequelize.QueryTypes.SELECT
                    });
                    newNotifications.push(result);
                }
            }
        
            if (newNotifications.length > 0){       
                const user = await UserModel.findOne({
                    where: { id: receiverId },
                    attributes: ['id', 'notifications'],
                });
            
                if (user) {
                    let notificationsData = user.notifications || [];
                    const photoNotifIndex = notificationsData.findIndex(
                        (n) => n.notification_type === 'posted_photo'
                    );

                    let photoNotifications = newNotifications.flat(); 

                    if (photoNotifIndex !== -1) {
                        const existingPhotoNotifs = notificationsData[photoNotifIndex].photo_notifications || [];
                        photoNotifications = [...photoNotifications, ...existingPhotoNotifs].slice(0, 4);
                        notificationsData[photoNotifIndex].photo_notifications = photoNotifications;
                    } 
                    else {
                        notificationsData.push({
                            notification_type: 'posted_photo',
                            photo_notifications: photoNotifications.slice(0, 4)
                        });
                    }

                
                    await UserModel.update(
                        { notifications: notificationsData },
                        { 
                            where: { 
                                id: receiverId 
                            } 
                    });
                }
            }
    }
    catch(err){
        console.log(err.message);
    }
};


module.exports = {notificationQueue, processNotifications,  personalWebsite60MinTagQueue,};
