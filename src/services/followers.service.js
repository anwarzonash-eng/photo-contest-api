import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
import { updateMemberProfile, getMemberProfile } from '../utils/mailchimp/profile';
import  {findOrCreateInterest } from "../utils/mailchimp/interest";
import { updateUserNotifications, removeUserNotificationById } from '../utils/genericFunctions';

export class followerService extends baseService {

    async followUser(req) {
        try{
            global.appLogger.info(`\n---- Start Follow User Api Call by user with Id ${req.userData._id} ----`);
            let user = await this._userModel.findOne(   { where: { id: req.body.followerID} })
            if (!user) {
                return undefined;
            }
            else {
                let response=''
                if (req.body.is_follow == true) {
                    const [followUser, created] = await this._followerModel.findOrCreate(
                    {
                        where: {
                            follower_id: req.body.followerID,
                            user_id: req.userData._id
                        },
                        defaults: {
                            follower_id: req.body.followerID,
                            user_id: req.userData._id,
                            is_active: true
                        }
                    })
                    if(created){
                        response = {message:'User Followed', first_time_follow: false};
                   
                        setTimeout(async () => {
                            try{
                                    let followUserNotification = await this._notificationModel.create({
                                        receiver_id: req.body.followerID,
                                        sender_id: req.userData._id,
                                        notification_type: 'follow_user'
                                    });

                                    if(followUserNotification){
                                        let query = `Select n."id", n."notification_type", n."createdAt", 
                                        n."updatedAt", n."is_seen",
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
                                                END),
                                            'compressedProfileId', u."compressedProfileId",
                                            'login_username', (Select "name" from "Users" u1 where u1."id"='${req.userData._id}'),
                                            'login_photo_url', (SELECT CASE 
                                                    WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                                    ELSE u1."photo_url"  END 
                                                    FROM "Users" u1 
                                                    WHERE u1."id"='${req.userData._id}'
                                            ),
                                            'is_follow', (Select Exists(Select * from "Followers" where "user_id"= n."receiver_id" and "follower_id"= n."sender_id" and "is_active"=true)),
                                            'genres_list', (
                                                SELECT json_object_agg(genre, genre)
                                                FROM unnest(string_to_array(u."genres_list", ',')) AS genre
                                            ),
                                            'camera_brand', u."camera_brand"
                                        ) AS message
                                        from "notifications" n
                                        left join "Users" u on n."sender_id"= u."id"
                                        where n."id"='${followUserNotification.dataValues.id}'`;

                                        await updateUserNotifications(query, req.body.followerID);
                                    }
                            }
                            catch(err){
                                console.log(err.message);
                            }

                            try {   
                                //add interest for user who follow another user first time
                                const followingCount = await this._followerModel.count({
                                    where: {
                                    user_id: req.userData._id
                                    }
                                });

                                if(followingCount==1){        
                                    const FollowingUser = await this._userModel.findOne({
                                        where:{
                                            id: req.userData._id
                                        },
                                        attributes:['member_id']
                                    })
                                    
                                    global.appLogger.info(`[Start] Adding Mailchimp Interest for First Following By Member Id ${FollowingUser.dataValues.member_id}`);
                                    const interests = await findOrCreateInterest('BPH Master: Follows', 'First_Following');
                                    if(interests){
                                        let currentInterests = await getMemberProfile(FollowingUser.dataValues.member_id);  
                                        if(currentInterests){
                                            currentInterests[interests.interestId] = true;
                                            await updateMemberProfile(FollowingUser.dataValues.member_id, {interests: currentInterests});  
                                            global.appLogger.info(`[End] Successfully Added Mailchimp Interest for First Following By Member Id ${FollowingUser.dataValues.member_id} \n`);
                                        }
                                    }
                                }
                            }
                            catch(err) {  
                                global.appLogger.error(`[Error] Adding Mailchimp Interest for First Following ${err.message}`);
                                // console.log(err);
                            }

                            try{
                                //add interest for user who receives follow
                                const followCount = await this._followerModel.count({
                                    where: {
                                    follower_id: req.body.followerID
                                    }
                                });
                                if(followCount == 1){
                                    const FollowUser = await this._userModel.findOne({
                                        where:{
                                            id: req.body.followerID
                                        },
                                        attributes:['member_id']
                                    });

                                    global.appLogger.info(`[Start] Adding Mailchimp Interest for User who Receives First Follow By Member Id ${FollowUser.dataValues.member_id}`);
                                    const interests = await findOrCreateInterest('BPH Master: Follows', 'First_Follow');
                                    if(interests){
                                        let currentInterests = await getMemberProfile(FollowUser.dataValues.member_id);  
                                        if(currentInterests){
                                            currentInterests[interests.interestId] = true;
                                            await updateMemberProfile(FollowUser.dataValues.member_id, {interests: currentInterests});  
                                            global.appLogger.info(`[End] Successfully Added Mailchimp Interest for User who Receives First Follow By Member Id ${FollowUser.dataValues.member_id} \n`);
                                        }
                                    } 
                                }
                            }
                            catch(err){
                                global.appLogger.error(`[Error] Adding Mailchimp Interest for User who Receives First Follow ${err.message} \n`);
                            }
                        })
                    }
                    else{
                        await this._followerModel.update({
                            is_active:true
                        },{
                            where:{
                                id:followUser.dataValues.id
                            }
                        })

                        response = {message:'User Followed',first_time_follow: true}
                        //return response;
                    }

                    global.appLogger.info(`[End] User Followed Successfully \n`);
                    //return response;
                }
                else if (req.body.is_follow == false){
                    await this._followerModel.update({is_active:false},
                    {
                        where:{
                            follower_id: req.body.followerID,
                            user_id: req.userData._id
                        }
                    });

                    setTimeout(async () => {
                        try{
                            let notification = await this._notificationModel.findOne({
                                where:{
                                    receiver_id: req.body.followerID,
                                    sender_id: req.userData._id,
                                    notification_type: 'follow_user',
                                }
                            });

                            if(notification){
                                await removeUserNotificationById(req.body.followerID, notification.dataValues.id);                               
                                await notification.destroy();
                            }
                                       
                        }
                        catch(err){
                            console.log(err.message);
                        }
                        try {   
                            //remove interest for user who follow another user first time
                            const followingCount = await this._followerModel.count({
                                where: {
                                  user_id: req.userData._id,
                                  is_active:false
                                },
                            });

                            if(followingCount == 1){
                                const FollowingUser = await this._userModel.findOne({
                                    where:{
                                        id: req.userData._id
                                    },
                                    attributes:['member_id']
                                })

                                global.appLogger.info(`[Start] Removing Mailchimp Interest for User First Following ${FollowingUser.dataValues.member_id}`);
                                const interests = await findOrCreateInterest('BPH Master: Follows', 'First_Following');
                                if(interests){
                                    let currentInterests = await getMemberProfile(FollowingUser.dataValues.member_id);  
                                    if(currentInterests && currentInterests[interests.interestId] == true){
                                        currentInterests[interests.interestId] = false;
                                        await updateMemberProfile(FollowingUser.dataValues.member_id, {interests: currentInterests});
                                    }
                                }
                                global.appLogger.info(`[End] Removing Mailchimp Interest for User First Following ${FollowingUser.dataValues.member_id} \n`);
                            }
                        }
                        catch(err){
                            global.appLogger.error(`[Error] Removing Mailchimp Interest for User First Following ${err.message} \n`);
                        }

                        try{
                            const followCount = await this._followerModel.count({
                                where: {
                                  follower_id: req.body.followerID,
                                  is_active: false
                                }
                            });
                            if(followCount == 1){
                                const FollowUser = await this._userModel.findOne({
                                    where:{
                                        id: req.body.followerID,
                                    },
                                    attributes:['member_id']
                                });

                                global.appLogger.info(`[Start] Removing Mailchimp Interest for User First Follow By Member Id ${FollowUser.dataValues.member_id}`);
                                const interests = await findOrCreateInterest('BPH Master: Follows', 'First_Follow');
                                if(interests){
                                    let currentInterests = await getMemberProfile(FollowUser.dataValues.member_id);  
                                    if(currentInterests && currentInterests[interests.interestId] == true){
                                        currentInterests[interests.interestId] = false;
                                        await updateMemberProfile(FollowUser.dataValues.member_id, {interests: currentInterests});  
                                    }
                                    global.appLogger.info(`[End] Removing Mailchimp Interest for User First Follow By Member Id ${FollowUser.dataValues.member_id} \n`);
                            
                                } 
                            }
                        }
                        catch(err){
                            global.appLogger.error(`[Error] Removing Mailchimp Interest for User First Follow ${err.message} \n`);
                            //console.log(err);
                        }
                    })


                    global.appLogger.info(`[End] User UnFollowed Successfully!\n`);
                    response = 'User UnFollowed';
                    //return response;
                }
                global.appLogger.info(`[End] User Followed/UnFollowed Successfully \n`);


                
            
            setTimeout(async () => {
                // update follow/ unfollow user on my own activity page (user tbl notification)                               
                try{                        
                        
                    let followingUser = await this._userModel.findOne({
                        where :{
                            id: req.userData._id
                        },
                        attributes:['id', 'notifications']
                    });       

                    if(followingUser && followingUser.dataValues.notifications){
                        const RegularNotificationObj = followingUser.dataValues.notifications.find(n => n.notification_type === 'regular');
                        let RegularNotification = RegularNotificationObj?.regular_notifications;
                        if(RegularNotification){
                            const regularNotification = RegularNotification.filter(n => n.message.sender_id === req.body.followerID && n.message.receiver_id === req.userData._id);
                            if (regularNotification.length > 0) {
                                for (let notification of regularNotification) {
                                    notification.message.is_follow = req.body.is_follow;
                                }
                                followingUser.changed('notifications', true);
                                await followingUser.save();
                            }
                        }
                    }
                }
                catch(err){
                    console.log(err.message);
                }
            }, 0)

            return response;


            }
        }
        catch(err){
            global.appLogger.error(`[Error] Follow User Api Call ${err.message}\n`);
            throw new Error(err.message);
        }
    }

    async viewFollowDetail(req){
        try{
            global.appLogger.info(`\n---- Start View Follow Detail Api Call By User with Id ${req.userData._id} ---`);
            let query; 
            let userQuery=``; let limit = 12;
            const user_id = req.body.user_id ? req.body.user_id : req.userData._id;
            if(req.body.user_id){
                userQuery = `(SELECT ARRAY(SELECT json_build_object('id', u1."id",'name', u1."name", 'state', u1."state",'genres_list', 
                (SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(u1."genres_list", ',')) genre), 
                'camera_brand', u1."camera_brand", 'photo_url', 
                (CASE 
                WHEN LENGTH(u1."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                ELSE u1."photo_url"
                END), 'compressedProfileId', u1."compressedProfileId", 'createdAt', u1."createdAt", 'following_count',
                (Select count(*) from "Users" u inner join "Followers" f on u."id"= f."follower_id" where "user_id"='${user_id}' and u."isBlocked"=false and f."is_active"=true),
                'followers_count', (Select count(*) from "Users" u inner join "Followers" f on u."id"= f."user_id" where "follower_id"='${user_id}' and u."isBlocked"=false and f."is_active"=true)
                ${req.body.user_id != undefined ? `,'is_follow', (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id=u1."id" and f."is_active"=true) AS is_follow)`:``}
                )::jsonb
                FROM "Users" u1 where u1."id"='${user_id}' and u1."isBlocked"=false) as user),`;
            }

            if(req.body.key == 'following'){
                global.appLogger.info(`[Start] Fetching Following Users List`);

                query =`Select 
                (Select count(*)::integer as recommended_count FROM "Users" u WHERE u."id" NOT IN (SELECT "follower_id" FROM "Followers" f1 WHERE f1."user_id" = '${req.userData._id}' and f1."is_active"=true) 
                and u."id" != '${req.userData._id}' and u."isBlocked"=false),
                (Select count(*)::integer as "following_count" from "Users" u inner join "Followers" f on u."id"= f."follower_id" where "user_id"='${user_id}' and u."isBlocked"=false and f."is_active"=true),
                (Select count(*)::integer as "follower_count" from "Users" u inner join "Followers" f on u."id"= f."user_id" where "follower_id"='${user_id}' and u."isBlocked"=false and f."is_active"=true),
                ${userQuery}
                (SELECT ARRAY( SELECT json_build_object('id', follower_id, 'name', u."name",'state', u."state", 'photo_url', 
                (CASE 
                WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                ELSE u."photo_url"
                END), 'compressedProfileId', u."compressedProfileId", 
                'genres_list',( SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(u."genres_list", ',')) 
                genre), 'camera_brand', u."camera_brand",'createdAt', u."createdAt",
                'photos', (WITH prioritized_photos AS (
                        (SELECT p.id, p."photo_url", p."compressedImageId", 1 AS priority
                            FROM "Photos" p
                            LEFT JOIN "Votes" v ON p.id = v."photo_id"
                            WHERE p.user_id = u."id"
                            AND p."isQueued" = false
                            GROUP BY p.id
                            ORDER BY MAX(CASE WHEN v."is_vote" = true THEN 1 ELSE 0 END) DESC, 
                            COUNT(v."photo_id") DESC, p."createdAt" DESC
                            LIMIT 3
                        )
                        UNION ALL
                        (SELECT g.id, g."photo_url", g."compressedImageId", 2 AS priority
                            FROM "gallery_photos" g
                            WHERE g."user_id" = u."id"
                            and g."isHunted"= false
                            ORDER BY g."createdAt" DESC
                            LIMIT 3
                        )
                    )
                    SELECT json_agg(json_build_object('id', p.id, 'photo_url', p."photo_url", 'compressedImageId', p."compressedImageId"))
                    FROM (
                        SELECT id, "photo_url", "compressedImageId", ROW_NUMBER() OVER (ORDER BY priority ASC) AS rank
                        FROM prioritized_photos
                    ) AS p
                    WHERE p.rank <= 3),
                    'is_follow', (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id=u."id" and f."is_active"=true) AS is_follow),
                    'is_follow_back', (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = u."id" and f.follower_id='${req.userData._id}' and f."is_active"=true) AS is_follow_back)
                )::jsonb
                from "Users" u inner join "Followers" f on u."id"= f."follower_id"
                where "user_id"='${user_id}' and f."is_active"=true
                and u."isBlocked"= false
                order by f."updatedAt" DESC
                offset ${req.body.offset} limit 12) as data)`; 
            }
            else if(req.body.key == 'recommended'){
                if(req.body.offset == 96){
                    limit = 4;
                }


                global.appLogger.info(`[Start] Fetching Recommended Users List`);
                query=`Select 
                (Select count(*)::integer as recommended_count FROM "Users" u WHERE u."id" NOT IN (SELECT "follower_id" FROM "Followers" f1 WHERE f1."user_id" = '${req.userData._id}' and f1."is_active"=true) 
                and u."id" != '${req.userData._id}' and u."isBlocked"=false),
                (Select count(*)::integer as "following_count" from "Users" u inner join "Followers" f on u."id"= f."follower_id" where "user_id"='${user_id}' and u."isBlocked"=false and f."is_active"=true),
                (Select count(*)::integer as "follower_count" from "Users" u inner join "Followers" f on u."id"= f."user_id" where "follower_id"='${user_id}' and u."isBlocked"=false and f."is_active"=true),
                ${userQuery}
                (SELECT ARRAY(
                    SELECT json_build_object('id', u.id, 'name', u.name, 'state', u."state",'genres_list', 
                    (SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(u."genres_list", ',')) genre), 
                    'camera_brand', u."camera_brand", 'photo_url', (CASE 
                    WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                    ELSE u."photo_url"
                    END), 'compressedProfileId', u."compressedProfileId", 'createdAt', u."createdAt",
                    'photos', (WITH prioritized_photos AS (
                        (SELECT p.id, p."photo_url", p."compressedImageId", 1 AS priority
                            FROM "Photos" p
                            LEFT JOIN "Votes" v ON p.id = v."photo_id"
                            WHERE p.user_id = u."id"
                            AND p."isQueued" = false
                            GROUP BY p.id
                            ORDER BY MAX(CASE WHEN v."is_vote" = true THEN 1 ELSE 0 END) DESC, 
                            COUNT(v."photo_id") DESC, p."createdAt" DESC
                            LIMIT 3
                        )
                        UNION ALL
                        (SELECT g.id, g."photo_url", g."compressedImageId", 2 AS priority
                            FROM "gallery_photos" g
                            WHERE g."user_id" = u."id"
                            and g."isHunted"= false
                            ORDER BY g."createdAt" DESC
                            LIMIT 3
                        )
                    )
                    SELECT json_agg(json_build_object('id', p.id, 'photo_url', p."photo_url", 'compressedImageId', p."compressedImageId"))
                    FROM (
                        SELECT id, "photo_url", "compressedImageId", ROW_NUMBER() OVER (ORDER BY priority ASC) AS rank
                        FROM prioritized_photos
                    ) AS p
                    WHERE p.rank <= 3),
                            'is_follow', (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id=u."id" and f."is_active"=true) AS is_follow),
                            'is_follow_back', (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = u."id" and f.follower_id='${req.userData._id}' and f."is_active"=true) AS is_follow_back)
                    )::jsonb
                    FROM "Users" u WHERE u."id" NOT IN (
                        SELECT "follower_id" FROM "Followers" WHERE "user_id" = '${req.userData._id}'
                        and "is_active"=true)
                        and u."id" != '${req.userData._id}' and u."isBlocked"=false
                        ORDER BY (
                            (u."lastVisitTime" IS NOT NULL), (u."lastVisitTime"),
                        (Select Exists(Select * from "Photos" _photo where _photo."user_id"= u."id" and _photo."isQueued"=false 
                        and _photo."createdAt"::timestamp >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') 
                        )),
                        u."winner_count",
                         (SELECT COUNT(*) FROM "Votes" v WHERE v."user_id" = '${req.userData._id}' and v."is_vote"=true
                         AND v."photo_id" IN (SELECT "id" FROM "Photos" WHERE "user_id" = u."id")),
                         (u."photo_url" IS NOT NULL AND LENGTH(u."photo_url") > 0),
                         (SELECT COUNT(*) FROM (
                            SELECT UNNEST(STRING_TO_ARRAY(u.genres_list, ',')) AS genre
                            INTERSECT
                            SELECT UNNEST(STRING_TO_ARRAY(u2.genres_list, ',')) AS genre
                            FROM "Users" u2 WHERE u2.id = '${req.userData._id}'
                        ) AS genre),
                         (SELECT COUNT(*) FROM "Votes" v
                         WHERE v."user_id" = u."id" and v."is_vote"=true
                         AND v."photo_id" IN (SELECT "id" FROM "Photos" WHERE "user_id" = '${req.userData._id}')),
                        (
                            (SELECT CASE WHEN position(',' IN u."state") > 0 THEN trim(split_part(u."state", ',', -1))
                              WHEN position('-' IN u."state") > 0 THEN trim(split_part(u."state", '-', -1))
                              ELSE state END AS country
                            )=
                            (SELECT CASE WHEN position(',' IN u1."state") > 0 THEN trim(split_part(u1."state", ',', -1))
                              WHEN position('-' IN u1."state") > 0 THEN trim(split_part(u1."state", '-', -1))
                              ELSE state  END AS country
                                FROM "Users" u1 where u1."id"='${req.userData._id}'
                            )
                        ),
                         ( u."camera_brand" is not null and LENGTH(u."camera_brand") > 0  and u."camera_brand" = (Select u1."camera_brand" from "Users" u1 where u1."id"='${req.userData._id}')),
                         (
                            (SELECT AVG(NULLIF(votes_count::float / NULLIF(photos_count, 0), NULL)) AS average_upvotes1
                             FROM ( SELECT
                             (Select count(*) from "Votes" v join "Photos" p on p."id" = v."photo_id" where 
                              p."user_id" = '${req.userData._id}' and v."is_vote"=true) AS votes_count,
                             (SELECT COUNT(*) FROM "Photos" p WHERE p."user_id" = '${req.userData._id}') AS photos_count
                              ) AS avg1) <
                            (SELECT AVG(NULLIF(votes_count::float / NULLIF(photos_count, 0), NULL)) AS average_upvotes2
                                 FROM (SELECT
                                 (Select count(*) from "Votes" v join "Photos" p on p."id" = v."photo_id" where 
                                  p."user_id" = u."id" and v."is_vote"=true) AS votes_count,
                                (SELECT COUNT(*) FROM "Photos" p WHERE p."user_id"= u."id") AS photos_count
                            ) AS avg2)
                        ), u."createdAt"
                    ) DESC
                 offset ${req.body.offset} limit ${limit}
                ) as data)`;
            }
            else{
                global.appLogger.info(`[Start] Fetching Followers List`);
                query = `Select 
                (Select count(*)::integer as recommended_count FROM "Users" u WHERE u."id" NOT IN (SELECT "follower_id" FROM "Followers" f1 WHERE f1."user_id" = '${req.userData._id}' and f1."is_active"=true) 
                and u."id" != '${req.userData._id}' and u."isBlocked"=false),
                (Select count(*)::integer as "following_count" from "Users" u inner join "Followers" f on u."id"= f."follower_id" where "user_id"='${user_id}' and u."isBlocked"=false and f."is_active"=true),
                (Select count(*)::integer as "follower_count" from "Users" u inner join "Followers" f on u."id"= f."user_id" where "follower_id"='${user_id}' and u."isBlocked"=false and f."is_active"=true),
                ${userQuery}
                (SELECT ARRAY( SELECT json_build_object('id', user_id, 'name', u."name",'state', u."state",
                'compressedProfileId', u."compressedProfileId",
                 'photo_url', 
                 (CASE 
                    WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                    ELSE u."photo_url"
                    END),   
                 'genres_list', ( SELECT json_object_agg(genre, genre) FROM 
                unnest(string_to_array(u."genres_list", ',')) genre), 'camera_brand', u."camera_brand", 
                'photos', (WITH prioritized_photos AS (
                        (SELECT p.id, p."photo_url", p."compressedImageId", 1 AS priority
                            FROM "Photos" p
                            LEFT JOIN "Votes" v ON p.id = v."photo_id"
                            WHERE p.user_id = u."id"
                            AND p."isQueued" = false
                            GROUP BY p.id
                            ORDER BY MAX(CASE WHEN v."is_vote" = true THEN 1 ELSE 0 END) DESC, 
                            COUNT(v."photo_id") DESC, p."createdAt" DESC
                            LIMIT 3
                        )
                        UNION ALL
                        (SELECT g.id, g."photo_url", g."compressedImageId", 2 AS priority
                            FROM "gallery_photos" g
                            WHERE g."user_id" = u."id"
                            and g."isHunted"= false
                            ORDER BY g."createdAt" DESC
                            LIMIT 3
                        )
                    )
                    SELECT json_agg(json_build_object('id', p.id, 'photo_url', p."photo_url", 'compressedImageId', p."compressedImageId"))
                    FROM (
                        SELECT id, "photo_url", "compressedImageId", ROW_NUMBER() OVER (ORDER BY priority ASC) AS rank
                        FROM prioritized_photos
                    ) AS p
                    WHERE p.rank <= 3),
                'createdAt', u."createdAt",
                'is_follow',(SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id=u."id" and f."is_active"=true) AS is_follow),
                'is_follow_back', (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = u."id" and f.follower_id='${req.userData._id}' and f."is_active"=true) AS is_follow_back)
                )::jsonb
                from "Users" u inner join "Followers" f on u."id"= f."user_id"
                where "follower_id"='${user_id}' and f."is_active"=true
                and u."isBlocked"= false
                order by f."updatedAt" DESC
                offset ${req.body.offset} limit 12) as data)`;
            }
        
            const results = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT
            });  

            global.appLogger.info(`[End] Successfully Fetched ${req.body.key} List \n`);
            return results;
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching ${req.body.key} List ${err.message} \n`);
            throw new Error(err.message);
        }
    }


    async followerUpvotedPhoto(req){
        try{
            global.appLogger.info(`\n --- Start Fetching Follower Upvoted Photo Api Call ----`);
            let query = `SELECT  u."id", u."name", u."state", 
            CASE 
            WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
            ELSE u."photo_url"
            END AS "profile_pic", u."compressedProfileId",
            (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id='${req.body.user_id}' and f."is_active"=true) ) AS is_follow,  
          ( SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(u."genres_list", ',')) 
           genre) as genres_list,  u."camera_brand", u."createdAt" as "join_date",
           u."photo_assistance", 
          (WITH prioritized_photos AS (
                (SELECT p.id, p."photo_url", p."compressedImageUrl", p."compressedImageId", 1 AS priority
                    FROM "Photos" p
                    LEFT JOIN "Votes" v ON p.id = v."photo_id"
                    WHERE p.user_id = '${req.body.user_id}'
                    AND p."isQueued" = false
                    GROUP BY p.id
                    ORDER BY MAX(CASE WHEN v."is_vote" = true THEN 1 ELSE 0 END) DESC, 
                    COUNT(v."photo_id") DESC, p."createdAt" DESC
                    LIMIT 10
                )
                UNION ALL
                (SELECT g.id, g."photo_url", g."compressedImageUrl", g."compressedImageId", 2 AS priority
                    FROM "gallery_photos" g
                    WHERE g."user_id" = '${req.body.user_id}'
                    and g."isHunted"= false
                    ORDER BY g."createdAt" DESC
                    LIMIT 10
                )
            )
            SELECT * FROM (
                SELECT json_agg(json_build_object('id', p.id, 'original_photo_url', p."photo_url", 'photo_url', p."compressedImageUrl",'compressedImageId', p."compressedImageId")) AS photos
                FROM (
                    SELECT id, "photo_url", "compressedImageUrl", "compressedImageId", ROW_NUMBER() OVER (ORDER BY priority ASC) AS rank
                    FROM prioritized_photos
                ) AS p
                WHERE p.rank <= 10
            ) AS photos)
          from "Users" u where u."id"='${req.body.user_id}'and u."isBlocked"=false`;

            const results = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT
            });  
            global.appLogger.info(`[End] Successfully Fetched Followers Upvoted Photos \n`);
            return results;
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Followers Upvoted Photos ${err.message}\n`);
            throw new Error(err.message);
        }
    }
}