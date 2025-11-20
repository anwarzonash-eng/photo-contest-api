import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
import {updateInterestsInProfile, getMemberProfile, updateMemberProfile } from '../utils/mailchimp/profile';
import  {findOrCreateMultipleInterests, findOrCreateInterest } from "../utils/mailchimp/interest";
import { updateHuntScorePoints, incrementHuntScorePoints, updateUserNotifications } from '../utils/genericFunctions';
import { manageTags } from "../utils/mailchimp/tags";
import { getSecrets } from "../utils/secret-manager.js";


export class commentService extends baseService {
    async addComment(req) {
       try
        {
            if(req.body?.batchId){
                 const defaultUUID = '00000000-0000-0000-0000-000000000000';
                await this._tempUserActionsModel.create({
                    batch_id: req.body.batchId,
                    data: {
                        photoID: req.body.photoID,  
                        comment_text: req.body.commentText,
                        sub_comment_id: req.body.subcommentID || defaultUUID,
                        top_comment_id: req.body.topcommentID || defaultUUID,
                    },
                    action_type: 'comment'
                });
                return {
                    response: 'Comment action queued in batch',
                };
            }


            global.appLogger.info(`\n---- Start Add Comment Api Call by user with Id ${req.userData._id} ----`);
            const newComment = await this._commentModel.create({
                photo_id: req.body.photoID,
                comment_text: req.body.commentText,
                user_id: req.userData._id,
                sub_comment_id: req.body.subcommentID,
                top_comment_id: req.body.topcommentID
            });

            const photoDetail = await this._photoModel.findOne({
                where:{
                    id: req.body.photoID
                },
                attributes:['user_id', 'photo_url']
            });

            let replierId = null;
            if(newComment.dataValues.top_comment_id!="00000000-0000-0000-0000-000000000000" && newComment.dataValues.sub_comment_id=="00000000-0000-0000-0000-000000000000"){
                replierId = newComment.dataValues.top_comment_id;
            }

            if(newComment.dataValues.sub_comment_id!="00000000-0000-0000-0000-000000000000"){
                replierId = newComment.dataValues.sub_comment_id;
            }
             
            if(replierId != null){
                //reply to a comment notification
                
                let replyUser = await sequelize.query(`Select user_id, name from "Comments" c join "Users" u
                on u.id = c.user_id where c."id"='${replierId}'`, {
                    type: sequelize.QueryTypes.SELECT,
                });

                newComment.dataValues.replyToId = replyUser[0].user_id;
                newComment.dataValues.replyToName = replyUser[0].name;
            }
            newComment.dataValues.is_vote = false;
            newComment.dataValues.total_likes = 0;
            let user = await this._userModel.findOne({
                where:{
                    id: newComment.dataValues.user_id 
                },
                attributes:['name', 'photo_url', 'compressedProfilePic', 'compressedProfileId']
            });

            newComment.dataValues.username = user.name;
            newComment.dataValues.user_profile_pic = user.compressedProfilePic? user.compressedProfilePic: user.photo_url;
            newComment.dataValues.compressedProfileId = user.compressedProfileId;

            setTimeout(async () => {
                try{
                    if(newComment.dataValues.top_comment_id=="00000000-0000-0000-0000-000000000000" && newComment.dataValues.sub_comment_id=="00000000-0000-0000-0000-000000000000"){             
                        if(photoDetail.dataValues.user_id != req.userData._id){
                            const user = await this._userModel.findOne({
                                where:{
                                    id: req.userData._id
                                },
                                attributes:['id']
                            });
            
                            let newNotification = await this._notificationModel.create({
                                receiver_id: photoDetail.dataValues.user_id,
                                sender_id: user.dataValues.id,
                                comment_id: newComment.dataValues.id,
                                photo_id: req.body.photoID,
                                notification_type: 'comment_on_photo'
                            })

                            if(newNotification){
                                let query = `Select n."id", n."notification_type", n."createdAt", n."updatedAt", n."is_seen",
                                json_build_object(
                                    'id', u."id",
                                    'notification_createdAt', TO_CHAR(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                                    'receiver_id',n."receiver_id",
                                    'sender_id',n."sender_id",
                                    'name', u."name",
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
                                    'login_username', (Select "name" from "Users" u1 where u1."id"='${req.userData._id}'),
                                    'login_photo_url', (SELECT CASE 
                                            WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                            ELSE u1."photo_url"  END 
                                            FROM "Users" u1 
                                            WHERE u1."id"='${req.userData._id}'
                                    ),
                                    'comment_id', c."id",
                                    'comment_text', c."comment_text",
                                    'photo_id', p."id",
                                    'top_comment_id', (Select "top_comment_id" from "Comments" where "id"=n."comment_id"),
                                    'sub_comment_id', c."id",
                                    'comment_createdAt', c."createdAt",
                                    'is_photo_upvoted', (SELECT EXISTS( SELECT * FROM "Votes" WHERE "photo_id" = p."id"  and "user_id"='${req.userData._id}' and "is_vote"=true) ),
                                    'photo_upvoted_count', (Select count(*) from "Votes" where "photo_id"= p."id" and "is_vote"=true),
                                    'upvoted_count', (Select count(*) from "like_comments" c1 where c1."comment_id"=n."comment_id" ),
                                    'is_vote', (Select Exists(Select * from "like_comments" where 
                                            "user_id"='${req.userData._id}' and "comment_id"=n."comment_id")
                                    ),                 
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
                                where n."id"='${newNotification.dataValues.id}'`;
                
                                await updateUserNotifications(query, photoDetail.dataValues.user_id);
                            }
                        }
                    }
                }
                catch(err){
                    console.log(err.message);
                }

                try{
                    if(replierId != null){        
                        let replyToCommentNotification;
                         try{
                                if(photoDetail.dataValues.user_id != req.userData._id ){                  
                                        replyToCommentNotification = await this._notificationModel.create({
                                        receiver_id: photoDetail.dataValues.user_id,
                                        sender_id: req.userData._id,
                                        comment_id: newComment.dataValues.id,
                                        photo_id: req.body.photoID,
                                        notification_type: 'reply_to_comment'
                                    });
                                
                                    if(replyToCommentNotification){
                                        let query = `Select n."id", n."notification_type", n."createdAt", n."updatedAt", n."is_seen",
                                            json_build_object(
                                                'id', u."id",
                                                'notification_createdAt', TO_CHAR(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                                                'receiver_id',n."receiver_id",
                                                'sender_id',n."sender_id",
                                                'name', u."name",
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
                                                'login_username', (Select "name" from "Users" u1 where u1."id"='${req.userData._id}'),
                                                'login_photo_url', (SELECT CASE 
                                                    WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                                    ELSE u1."photo_url"  END 
                                                    FROM "Users" u1 
                                                    WHERE u1."id"='${req.userData._id}'
                                                ),
                                                'comment_id', c."id",
                                                'comment_text', c."comment_text",
                                                'photo_id', p."id",
                                                'top_comment_id', (Select "top_comment_id" from "Comments" where "id"=n."comment_id"),
                                                'sub_comment_id', c."id",
                                                'comment_createdAt', c."createdAt",
                                                'is_photo_upvoted', (SELECT EXISTS( SELECT * FROM "Votes" WHERE "photo_id" = p."id"  and "user_id"='${req.userData._id}' and "is_vote"=true) ),
                                                'photo_upvoted_count', (Select count(*) from "Votes" where "photo_id"= p."id" and "is_vote"=true),
                                                'upvoted_count', (Select count(*) from "like_comments" c1 where c1."comment_id"=n."comment_id" ),
                                                'is_vote', (Select Exists(Select * from "like_comments" where 
                                                "user_id"='${req.userData._id}' and "comment_id"=n."comment_id")),
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
                                            where n."id"='${replyToCommentNotification.dataValues.id}'`;
                        
                                        await updateUserNotifications(query, photoDetail.dataValues.user_id);
                                    }
                                }
                            }
                        catch(err){
                            console.log(err.message);
                        }

                        try{                       
                            if(photoDetail.dataValues.user_id !=  newComment.dataValues.replyToId){
                                replyToCommentNotification = await this._notificationModel.create({
                                    receiver_id: newComment.dataValues.replyToId,
                                    sender_id: req.userData._id,
                                    comment_id: newComment.dataValues.id,
                                    photo_id: req.body.photoID,
                                    notification_type: 'reply_to_comment'
                                });
                                
                                if(replyToCommentNotification){
                                    let query = `Select n."id", n."notification_type", n."createdAt", n."updatedAt", n."is_seen",
                                    json_build_object(
                                        'id', u."id",
                                        'notification_createdAt', TO_CHAR(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                                        'receiver_id',n."receiver_id",
                                        'sender_id',n."sender_id",
                                        'name', u."name",
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
                                        'login_username', (Select "name" from "Users" u1 where u1."id"='${req.userData._id}'),
                                        'login_photo_url', (SELECT CASE 
                                            WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                            ELSE u1."photo_url"  END 
                                            FROM "Users" u1 
                                            WHERE u1."id"='${req.userData._id}'
                                        ),
                                        'comment_id', c."id",
                                        'comment_text', c."comment_text",
                                        'photo_id', p."id",
                                        'top_comment_id', (Select "top_comment_id" from "Comments" where "id"=n."comment_id"),
                                        'sub_comment_id', c."id",
                                        'comment_createdAt', c."createdAt",
                                        'is_photo_upvoted', (SELECT EXISTS( SELECT * FROM "Votes" WHERE "photo_id" = p."id"  and "user_id"='${req.userData._id}' and "is_vote"=true) ),
                                        'photo_upvoted_count', (Select count(*) from "Votes" where "photo_id"= p."id" and "is_vote"=true),
                                        'upvoted_count', (Select count(*) from "like_comments" c1 where c1."comment_id"=n."comment_id" ),
                                        'is_vote', (Select Exists(Select * from "like_comments" where 
                                        "user_id"='${req.userData._id}' and "comment_id"=n."comment_id")),
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
                                    where n."id"='${replyToCommentNotification.dataValues.id}'`;
                            
                                    await updateUserNotifications(query, newComment.dataValues.replyToId);
                                }
                            }
                        }       
                        catch(err){
                            console.log(err.message);
                        }
                    }

                }
                catch(err){
                    console.log(err.message);
                }
                  //add interest for adding comment
                let result;
                try 
                {  
                    let query = `Select
                        (Select email from "Users" where "id"=:userId) as commenter_email,
                        (SELECT COUNT(*)::integer FROM "Comments" where "user_id"=:userId) as comments,
                        (SELECT COUNT(*)::integer FROM "Comments" where "user_id"=:userId and 
                        top_comment_id = '00000000-0000-0000-0000-000000000000'
                        and sub_comment_id = '00000000-0000-0000-0000-000000000000'
                        ) as top_comments_count,
                        (SELECT COUNT(*)::integer FROM "Comments" JOIN "Photos" ON "Photos".id = "Comments".photo_id
                        WHERE "Photos".user_id = (SELECT "user_id" FROM "Photos" WHERE "Photos".id = :photoId)) as comment_received,
                        (Select email from "Photos" join "Users" on "Users"."id" = "Photos"."user_id"
                        where "Photos".id = :photoId),
                        (Select "member_id" from "Users" where "email"=
                        (Select email from "Users" where "id"=:userId)) as commenter_member_id,
                        (Select "member_id" from "Users" where "email"=
                        (Select email from "Photos" join "Users" on "Users"."id" = "Photos"."user_id"
                        where "Photos".id =:photoId)) as photo_member_id`;

                    result = await sequelize.query(query, {
                        type: sequelize.QueryTypes.SELECT,
                        replacements: { photoId: req.body.photoID, userId: req.userData._id }
                    });

                    if((result[0].comments < 5) && (result[0].email != result[0].commenter_email)){
                        global.appLogger.info(`[Start] Adding MailChimp Interest For ${result[0].comments} Comment Given By Email ${result[0].commenter_email}`);
                        const interestList = ['Comment Given 1', 'Comment Given 2', 'Comment Given 3', 'Comment Given 4']                     
                        const getInterestId = await findOrCreateMultipleInterests('BPH Master: Comment GIVEN', interestList);
                        if(getInterestId){
                            await updateInterestsInProfile(getInterestId, result[0].comments, result[0].commenter_member_id);
                            global.appLogger.info(`[End] Successfully Added MailChimp Interest For ${result[0].comments} Comment Given By Email ${result[0].commenter_email} \n`);
                        }
                    }
                }
                catch(err){
                    global.appLogger.error(`[Error] Adding MailChimp Interest For ${result[0].comments} Comment Given ${err.message} \n`);
                    await this._commentModel.update({ status: false},{ where: { id: newComment.dataValues.id}});
                } 

                try
                {
                    if((result[0].comment_received == 25) && (result[0].email != result[0].commenter_email)){
                        global.appLogger.info(`[Start] Adding MailChimp Interest For 25th Comment Received By Email ${result[0].email}`);
                        const interests = await findOrCreateInterest('BPH Master: Comment RECEIVED', 'Comment Received 25');
                        if(interests){
                            let currentInterests = await getMemberProfile(result[0].photo_member_id);  
                            if(currentInterests){
                                currentInterests[interests.interestId] = true;
                                await updateMemberProfile(result[0].photo_member_id, {interests: currentInterests});   
                                global.appLogger.info(`[End] Successfully Added MailChimp Interest For 25th Comment Received By Email ${result[0].email}  \n`);    
                            }  
                        }        
                    }
                }
                catch(err){
                    global.appLogger.error(`[Error] Adding MailChimp Interest For 25th Comment Received  ${err.message} \n`);
                }

                try
                {
                    if((result[0].comment_received < 5) && (result[0].email != result[0].commenter_email)){
                        global.appLogger.info(`[Start] Adding MailChimp Interest For ${result[0].comment_received} Comment Received By Email ${result[0].email} `);
                        const interestList = ['Comment Received 1', 'Comment Received 2', 'Comment Received 3', 'Comment Received 4']                    
                        const getInterestId = await findOrCreateMultipleInterests('BPH Master: Comment RECEIVED', interestList);
                        if(getInterestId){
                            await updateInterestsInProfile(getInterestId, result[0].comment_received, result[0].photo_member_id);
                            global.appLogger.info(`[End] Successfully Added MailChimp Interest For ${result[0].comment_received} Comment Received By Email ${result[0].email}\n`);
                        }
                    }
                }
                catch (error) {
                    global.appLogger.error(`[Error] Adding MailChimp Interest For ${result[0].comment_received} Comment Received  ${error.message} \n`);
                    await this._commentModel.update({ status: false},{ where: { id: newComment.dataValues.id}});
                }
            
                await this._commentModel.update({ status: true},{ where: { id: newComment.dataValues.id}});  
                try {
                    if(newComment.dataValues.top_comment_id == '00000000-0000-0000-0000-000000000000' && newComment.dataValues.sub_comment_id == '00000000-0000-0000-0000-000000000000'){
                        await updateHuntScorePoints(req.userData._id, 'leave_comment', 5);
                        await incrementHuntScorePoints(req.userData._id, 5);
                    }
                }
                catch(err){
                    throw err;
                }


                // Mailchimp tag when user gives 9th comment (not reply comment)
                try {
                    if(result[0]['top_comments_count'] == 9 && (result[0].email != result[0].commenter_email) && 
                    newComment.dataValues.top_comment_id == '00000000-0000-0000-0000-000000000000' 
                    && newComment.dataValues.sub_comment_id == '00000000-0000-0000-0000-000000000000'){
                        const secretKey = await getSecrets();
                        await manageTags(result[0]['commenter_member_id'], secretKey.listId, 'User_Gave_9_Comments', 'active');
                        global.appLogger.info(`Mailchimp Tag User_Gave_9_Comments for User ${result[0].commenter_email} Added Successfully`)
                    }
                }
                catch(err){
                    throw err;
                }
            }, 0); 
                    
            global.appLogger.info(`[End] Comment Added Successfully \n`);
            return newComment;
        }
        catch(error)
        {
            global.appLogger.error(`[Error] Add Comment Api Call ${error.message} \n`);
            return { status: 'Error', message: 'Something went wrong while commenting photo.' };
        }
    }


    async listComment(req) {
        try{
            global.appLogger.info(`\n---- Start List Comment Api Call by user with Id ${req.userData._id} ----`);
            
            const query = `SELECT jsonb_build_object(
            'total_comments', (SELECT COUNT(*) FROM "Comments" JOIN 
                "Users" ON "Comments".User_ID = "Users".ID
                WHERE photo_id = :photoId AND "Comments"."isDeleted" = false 
                AND "Users"."isBlocked" = false
                and "Comments"."top_comment_id"='00000000-0000-0000-0000-000000000000'
                ),
                'comments', json_agg(commentsData)
                ) AS commentsData
            FROM (
            SELECT "Comments".id, "Comments"."user_id", 
            CASE 
            WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
            ELSE photo_url
            END AS user_profile_pic, "compressedProfileId", photo_id, comment_text, "Comments"."createdAt", "Comments"."updatedAt", "Users".name AS username,
            (SELECT COUNT(*) FROM "Comments" c join "Users" u on u.id= c.user_id
            WHERE c.top_comment_id = "Comments".id and c."photo_id"= photo_id AND
            c."isDeleted" = false and u."isBlocked"=false
           ) as total_replies,
           (SELECT EXISTS( SELECT * FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote,
           (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' 
           and f.follower_id= "Comments"."user_id" and f."is_active"=true) AS is_follow),
           (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
           WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false) AS total_votes
            FROM "Comments"
            JOIN "Users" ON "Comments".User_ID = "Users".ID
            WHERE "Comments".photo_id = :photoId and "Comments"."isDeleted"=false and "Users"."isBlocked"=false
            and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000'
            ORDER BY "Comments"."createdAt" DESC, "Comments".id
            LIMIT 4 OFFSET :offSet
          ) AS commentsData`;

            const result = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT,
                replacements: { offSet:req.body.offSet, photoId: req.body.photoID }
            });

            let data; 
            if (result.length && result[0].hasOwnProperty('commentsdata')) {
                data = result[0].commentsdata;
                if(data.comments == null){
                    data.comments =[];
                }
            }
            global.appLogger.info(`[End] Successfully Fetched Comments List \n`);
            return data;
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Comments List Api Call ${err.message} \n`);
            throw new Error(err.message);
        }
    }



    async listReplies(req){
        try{
          
            global.appLogger.info(`\n---- Start List Replies Api Call by user with Id ${req.userData._id} ----`);
            
            const query = `SELECT "Comments".id, user_id, 
            CASE 
            WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
            ELSE photo_url
            END AS user_profile_pic, "compressedProfileId",
             photo_id, comment_text, "Comments"."createdAt", "isDeleted", status,
            "Comments"."updatedAt", "Users".name AS username, "Comments"."top_comment_id", "Comments"."sub_comment_id",
            (SELECT COALESCE(
                (SELECT u.id FROM "Comments" sub
                JOIN "Users" u ON u.id = sub.user_id
                WHERE sub.id = "Comments"."sub_comment_id"),
                (SELECT u.id FROM "Comments" top
                JOIN "Users" u ON u.id = top.user_id
                WHERE top.id = "Comments"."top_comment_id")
                ) AS "replyToId"
                FROM "Comments" c where c."id"= "Comments"."id"),
            (SELECT COALESCE(
                (SELECT u.name FROM "Comments" sub
                JOIN "Users" u ON u.id = sub.user_id
                WHERE sub.id = "Comments"."sub_comment_id"),
                (SELECT u.name FROM "Comments" top
                JOIN "Users" u ON u.id = top.user_id
                WHERE top.id = "Comments"."top_comment_id")
                ) AS "replyToName"
                FROM "Comments" c where c."id"="Comments"."id"),
            (SELECT EXISTS( SELECT * FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote,
            (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
            WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false) AS total_likes
            FROM "Comments"
            JOIN "Users" ON "Comments".User_ID = "Users".ID
            WHERE "Comments".photo_id = '${req.body.photoID}'
            and "Comments"."isDeleted"=false and "Users"."isBlocked"=false
            and "Comments".top_comment_id= '${req.body.topcommentID}'
            ORDER BY "Comments"."createdAt" ASC`;

            const result = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT
            });    

            global.appLogger.info(`[End] Successfully Fetched List Replies \n`);
            return result;
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching List Replies Api Call ${err.message}\n`);
            throw new Error(err.message);
        }
    } 
}