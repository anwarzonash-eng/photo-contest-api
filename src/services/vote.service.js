import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
import {updateInterestsInProfile, getMemberProfile, updateMemberProfile } from '../utils/mailchimp/profile';
import  {findOrCreateMultipleInterests, findOrCreateInterest} from "../utils/mailchimp/interest";
import { updateHuntScorePoints, incrementHuntScorePoints, decrementHuntScorePoint, removeUserNotificationById, 
    updateUserNotifications
} from '../utils/genericFunctions';
import { UserModel, PhotoModel, CommentsModel } from '../models';


export class voteService extends baseService {

    async performVote(req) {
        try{

            if(req.body?.batchId){
                await this._tempUserActionsModel.create({
                    batch_id: req.body.batchId,
                    data: {
                        photoID: req.body.photoID,  
                    },
                    action_type: 'upvote_photo'
                });
                return {
                    response: 'Vote action queued in batch',
                };
            }


            let response = '';  let notificationId;
            const userId = await this._photoModel.findOne({
                where:{
                    id: req.body.photoID
                },
                attributes:['user_id']
            });

            if (req.body.actionType == 'add') {
                try{        
                    global.appLogger.info(`\n---- Starting Perform Vote Api Call by user with Id ${req.userData._id}----`);    
                    const [vote, created] = await this._voteModel.findOrCreate(
                    {
                        where: {
                            photo_id: req.body.photoID,
                            user_id: req.userData._id
                        },
                        defaults: {
                            photo_id: req.body.photoID,
                            user_id: req.userData._id,
                            is_vote:true
                        }
                    });                          

                    if (created){              
                        response = 'Vote Added'                         
                        setTimeout(async () => {
                            try {
                                await updateHuntScorePoints(req.userData._id, 'upvote_photo', 2);
                                await incrementHuntScorePoints(req.userData._id, 2);
                            }
                            catch(err){
                                throw err;
                            }
                            
                            let query =  `Select
                            (Select email from "Users" where "id"=:userId) as upvoter_email,
                            (Select COUNT(*)::integer FROM "Votes" where "user_id"=:userId and "is_vote"=true) as vote_count,
                            (SELECT COUNT(*)::integer FROM "Votes" JOIN "Photos" ON "Photos".id = "Votes".photo_id
                            WHERE "is_vote"=true and "Photos".user_id = (SELECT "user_id" FROM "Photos" WHERE "Photos".id = :photoId)) as vote_received,
                            (Select email from "Photos" join "Users" on "Users"."id" = "Photos"."user_id"
                            where "Photos".id = :photoId),
                            (Select "member_id" from "Users" where "email"=
                            (Select email from "Users" where "id"=:userId)) as upvoter_member_id,
                            (Select "member_id" from "Users" where "email"=
                            (Select email from "Photos" join "Users" on "Users"."id" = "Photos"."user_id"
                            where "Photos".id = :photoId)) as photo_member_id`;

                            const result = await sequelize.query(query, {
                                type: sequelize.QueryTypes.SELECT,
                                replacements: { photoId: req.body.photoID, userId: req.userData._id }
                            });
                            const VoteId = vote.dataValues.id;
                        
                            try {      
                                if((result[0].vote_count < 5) && (result[0].email != result[0].upvoter_email)){        
                                    global.appLogger.info(`[Start] Adding Mailchimp Interest for ${result[0].vote_count} Upvote Given`);    
                                    const interestList = ['Upvote Given 1', 'Upvote Given 2', 'Upvote Given 3', 'Upvote Given 4']         
                                    const getInterestId = await findOrCreateMultipleInterests('BPH Master: Upvote GIVEN', interestList)
                                    if(getInterestId){
                                        await updateInterestsInProfile(getInterestId, result[0].vote_count, result[0].upvoter_member_id); 
                                        global.appLogger.info(`[End] Successfully Added Mailchimp Interest for ${result[0].vote_count} Upvote Given \n`);                                                             
                                    }
                                }
                            }
                            catch(err){
                                global.appLogger.error(`[Error] Adding Mailchimp Interest for ${result[0].vote_count} Upvote Given ${err.message} \n`);    
                            }

                           
                            try{
                                    
                                if((result[0].vote_received == 50) && (result[0].email != result[0].upvoter_email)){
                                    global.appLogger.info(`[Start] Adding Mailchimp Interest for 50th Upvote Received`);    
                                    const interests = await findOrCreateInterest('BPH Master: Upvote Received', 'Upvote Received 50');
                                    if(interests){                
                                        let currentInterests = await getMemberProfile(result[0].photo_member_id);  
                                        if(currentInterests){
                                            currentInterests[interests.interestId] = true;
                                            await updateMemberProfile(result[0].photo_member_id, {interests: currentInterests});  
                                            global.appLogger.info(`[End] Successfully Added Mailchimp Interest for 50th Upvote Received \n`);  
                                        }                           
                                    }                                         
                                }
                            }
                            catch(err){
                                global.appLogger.error(`[Error] Adding Mailchimp Interest for 50th Upvote Received ${err.message} \n`);    
                            }

                            try{
                                if((result[0].vote_received < 5) && (result[0].email != result[0].upvoter_email)){     
                                    global.appLogger.info(`[Start] Adding Mailchimp Interest for ${result[0].vote_received} Upvote Received`);                                         
                                    const interestList = ['Upvote Received 1', 'Upvote Received 2', 'Upvote Received 3', 'Upvote Received 4']        
                                    const getInterestId = await findOrCreateMultipleInterests('BPH Master: Upvote Received', interestList);
                                    if(getInterestId){
                                        await updateInterestsInProfile( getInterestId, result[0].vote_received, result[0].photo_member_id);    
                                        global.appLogger.info(`[End] Successfully Added Mailchimp Interest for ${result[0].vote_received} Upvote Received \n`);                                                    
                                    }
                                } 
                            } catch (error) {
                                global.appLogger.error(`[Error] Adding Mailchimp Interest for ${result[0].vote_received} Upvote Received ${error.message} \n`);    
                                await this._voteModel.update({ status: false},{ where: { id: VoteId }});
                            }

                            await this._voteModel.update({ status: true},{ where: { id: VoteId }});      
                            
                           
                            
                        }, 0); 

                    }
                    else{              
                        await this._voteModel.update({is_vote:true},{where:{
                            photo_id: req.body.photoID,
                            user_id: req.userData._id,
                        }});
                        response = 'Vote Exists'
                    }
                    global.appLogger.info(`[End] Upvoted Successfully \n`);      
                }
                catch(err){
                    global.appLogger.error(`[Error] Upvoting Photo Api ${err.message} \n`);    
                    throw new Error(err.message);
                }
            }
            else if (req.body.actionType == 'remove') {       
                try{
                    global.appLogger.info(`\n---- Starting Removing Vote Api Call by User with Id ${req.userData._id}----`);      
                    await this._voteModel.update({is_vote:false},
                    {
                        where: {
                            photo_id: req.body.photoID,
                            user_id: req.userData._id
                        }
                    });
                    response = 'Vote Removed'
                    global.appLogger.info(`[End] Vote Removed Successfully \n`);  
                }
                catch(err){
                    global.appLogger.error(`[Error] Removing Upvote Api ${err.message} \n`);  
                }    
            }


            setTimeout(async () => {      
                try{                    
                        //upvote notification
                        if(req.body.actionType == 'add' && userId.dataValues.user_id != req.userData._id){
                            let newNotification = await this._notificationModel.create({
                                receiver_id: userId.dataValues.user_id,
                                sender_id: req.userData._id,
                                photo_id: req.body.photoID,
                                notification_type: 'upvote_photo'
                            });
                            
                            if(newNotification){
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
                                    'is_follow', (Select Exists(Select * from "Followers" where "user_id"= n."receiver_id" and
                                        "follower_id"= n."sender_id" and "is_active"=true)
                                    ),
                                    'photo_id', p."id",
                                    'genres_list', (
                                        SELECT json_object_agg(genre, genre)
                                        FROM unnest(string_to_array(u."genres_list", ',')) AS genre
                                    ),
                                    'camera_brand', u."camera_brand"
                                ) AS message
                                from "notifications" n
                                left join "Users" u on n."sender_id"= u."id"
                                left join "Photos" p on p."id"= n."photo_id"
                                where n."id"='${newNotification.dataValues.id}'`;

                                await updateUserNotifications(query, userId.dataValues.user_id);
                            }
                        
                        }                                             
                    }
                    catch(err){
                        console.log(err.message);
                        throw err;
                    }

                    if (req.body.actionType == 'remove'){    
                        try{              
                            const notification = await this._notificationModel.findOne({
                                where: {
                                    receiver_id: userId.dataValues.user_id,
                                    sender_id: req.userData._id,
                                    photo_id: req.body.photoID,
                                    notification_type: 'upvote_photo',
                                }
                            });
                            
                            if (notification) {
                                await removeUserNotificationById(userId.dataValues.user_id, notification.dataValues.id);
                                await notification.destroy();
                            }
                        }   
                        catch(err){
                            console.log(err.message)
                        }         
                        try{
                            await decrementHuntScorePoint('upvote_photo', 2, req.userData._id);                      
                        }
                        catch(err){ }
                    }

                    
                    try{                        
                        let upvotedUser = await this._userModel.findOne({
                            where :{
                                id: req.userData._id
                            },
                           attributes:['id', 'notifications']
                        });       

                        if(upvotedUser && upvotedUser.dataValues.notifications){
                            const PhotoNotificationObj = upvotedUser.dataValues.notifications.find(n => n.notification_type === 'posted_photo');
                            let PhotoNotification = PhotoNotificationObj?.photo_notifications;
                            if(PhotoNotification){
                                const photoNotification = PhotoNotification.find(n => n.message.photo_id === req.body.photoID && n.message.receiver_id === req.userData._id && n.message.sender_id === userId.dataValues.user_id);
                                if(photoNotification){
                                    let isPhotoUpvoted = req.body.actionType == 'add'? true: false;
                                    photoNotification.message.is_photo_upvoted = isPhotoUpvoted;
                                    upvotedUser.changed('notifications', true);
                                    await upvotedUser.save();
                                }
                            }
                        }
                    }
                    catch(err){
                        console.log(err.message);
                    }
            }, 0);
            
            const voteCount = await this._voteModel.count({
                where: {
                    photo_id: req.body.photoID,
                    is_vote:true
                },
            });
            return {
                response: response,
                voteCount: voteCount,
            };
        }
        catch(err){
            global.appLogger.error(`[Error] Perfoming Upvote Api Call ${err.message} \n`);  
        }
    }


    
    async performVoteOnPersonalPhoto(req) {
        try{
            let response = ''; 
           
            if (req.body.actionType == 'add') {
                try{        
                    global.appLogger.info(`\n---- [Start] Personal Photo Upvote Api Call by user with Id ${req.userData._id} ----`);    
                    const [vote, created] = await this._personalPhotoUpvoteModel.findOrCreate(
                    {
                        where: {
                            photo_id: req.body.photoID,
                            user_id: req.userData._id
                        },
                        defaults: {
                            photo_id: req.body.photoID,
                            user_id: req.userData._id,
                            is_vote: true
                        }
                    });                          

                    if (created){              
                        response = 'Personal Photo Upvote Added'                         
                    }
                    else{              
                        await this._personalPhotoUpvoteModel.update(
                            { is_vote: true },
                            {
                                where:{
                                    photo_id: req.body.photoID,
                                    user_id: req.userData._id,
                                }
                            }
                        );
                        response = 'Personal Photo Upvote Exists'
                    }
                    global.appLogger.info(`[End] Personal Photo Upvoted Successfully \n`);      
                }
                catch(err){
                    global.appLogger.error(`[Error] Upvoting Personal Photo Api ${err.message} \n`);    
                    throw new Error(err.message);
                }
            }
            else if (req.body.actionType == 'remove') {       
                try{
                    
                    global.appLogger.info(`\n---- [Start] Removing Personal Photo Upvote Api Call by User with Id ${req.userData._id} ----`);      
                    
                    await this._personalPhotoUpvoteModel.update(
                        { is_vote: false },
                        {
                            where: {
                                photo_id: req.body.photoID,
                                user_id: req.userData._id
                            }
                        }
                    );
                    
                    response = 'Personal Photo Upvote Removed'
                    global.appLogger.info(`[End] Personal Photo Upvote Removed Successfully \n`);  
                }
                catch(err){
                    global.appLogger.error(`[Error] Removing Personal Photo Upvote Api ${err.message} \n`);  
                }    
            }
  
            return {
                response: response
            };
        }
        catch(err){
            global.appLogger.error(`[Error] Personal Photo Upvote Api Call ${err.message} \n`);  
        }
    }



    async performVoteOnComment(req){
        try{
            global.appLogger.info(`\n---- Starting Perform Vote On Comment Api Call by user with Id ${req.userData._id}----`);    
            let response = ''
            const commentedUserId = await this._commentModel.findOne({
                where:{
                    id: req.body.commentID
                },
                attributes:['user_id', 'photo_id','comment_text']
            });

            if (req.body.actionType == 'add') {
                try
                {            
                    const [vote, created] = await this._voteCommentModel.findOrCreate(
                    {
                        where: {
                            comment_id: req.body.commentID,
                            user_id: req.userData._id
                        },
                        defaults: {
                            comment_id: req.body.commentID,
                            user_id: req.userData._id
                        }
                    })
                    if(created){
                        if(commentedUserId.dataValues.user_id != req.userData._id){
                            setTimeout( async () => {
                                try{
                                        
                                    let notification = await this._notificationModel.create({
                                        receiver_id: commentedUserId.dataValues.user_id,
                                        sender_id: req.userData._id,
                                        comment_id: req.body.commentID,
                                        photo_id: commentedUserId.dataValues.photo_id,
                                        notification_type: 'upvote_comment'
                                    });

                                    if(notification){
                                        let query = `Select n."id", n."notification_type", n."createdAt", 
                                        n."updatedAt", n."is_seen",
                                        json_build_object(
                                            'id', u."id",
                                            'notification_createdAt', TO_CHAR(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                                            'receiver_id', n."receiver_id",
                                            'sender_id', n."sender_id",
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
                                            'is_follow', (Select Exists(
                                                    Select * from "Followers" where "user_id"= n."receiver_id" 
                                                    and "follower_id"= n."sender_id" and "is_active"=true)
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
                                            'is_thanked', (Select Exists(Select * from "notifications" where 
                                                "receiver_id"= n."sender_id" and "sender_id"=n."receiver_id" and "photo_id"=n."photo_id" 
                                                and "notification_type"='thanks_on_upvote_comment' and "comment_id"= n."comment_id")
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
                                        where n."id"='${notification.dataValues.id}'`;

                                        await updateUserNotifications(query, commentedUserId.dataValues.user_id);
                                    }
                                }
                                catch(err){
                                    console.log(err.message);
                                }
                            },0);
                            response = 'Vote Added';
                        }
                    }
                    else{
                        response = 'Vote Exists';
                    }
                    global.appLogger.info(`[End] Successfully Performed Vote On Comment \n`);      
                }   
                catch(error){           
                    global.appLogger.info(`[Error] Performed Vote On Comment Api ${error.message} \n`);   
                    response = {status:'Error', message: error.message};
                    return response;
                }
            }
            else if (req.body.actionType = 'remove') {
                await this._voteCommentModel.destroy(
                    {
                        where: {
                            comment_id: req.body.commentID,
                            user_id: req.userData._id
                        }
                    }
                );

                setTimeout(async () => {
                    try{
                        let notification = await this._notificationModel.findOne({
                            where:{
                                receiver_id: commentedUserId.dataValues.user_id,
                                sender_id: req.userData._id,
                                comment_id: req.body.commentID,
                                photo_id: commentedUserId.dataValues.photo_id,
                                notification_type: 'upvote_comment'
                            }
                        });
                        
                        if (notification) {
                            await removeUserNotificationById(commentedUserId.dataValues.user_id, notification.dataValues.id);
                            await notification.destroy();
                        }

                    }
                    catch(err){
                        console.log(err.message);
                    }
                },0)
             

                response = 'Vote Removed'
                global.appLogger.info(`[End] Successfully Removed Vote On Comment \n`);   
            }
            const voteCount = await this._voteCommentModel.count({
                where: {
                    comment_id: req.body.commentID
                },
            });

            setTimeout( async () => {
                try{
                    let upvoteCommentUser = await this._userModel.findOne({
                        where :{
                            id: req.userData._id
                        },
                       attributes:['id', 'notifications']
                    });       

                    if(upvoteCommentUser && upvoteCommentUser.dataValues.notifications){
                        const RegularNotificationObj = upvoteCommentUser.dataValues.notifications.find(n => n.notification_type === 'regular');
                        let RegularNotification = RegularNotificationObj?.regular_notifications;
                        if(RegularNotification){
                            const regularNotification = RegularNotification.find(n => n.message.comment_id === req.body.commentID && n.message.receiver_id === req.userData._id && n.message.sender_id === commentedUserId.dataValues.user_id);
                            if(regularNotification){
                                let isPhotoUpvoted = req.body.actionType == 'add'? true: false;
                                regularNotification.message.is_vote = isPhotoUpvoted;
                                let [commentUpvotedCount] = await sequelize.query(`Select count(*) as "upvoted_count" from "like_comments" where "comment_id"='${req.body.commentID}'`, {
                                    type: sequelize.QueryTypes.SELECT
                                });
                                if(commentUpvotedCount){
                                    regularNotification.message.upvoted_count = commentUpvotedCount.upvoted_count;
                                }
                                upvoteCommentUser.changed('notifications', true);
                                await upvoteCommentUser.save();
                            }
                        }
                    }
                }
                catch(err){
                    console.log(err.message);
                }

                try{

                   //update upvoted_count to photo posted user + top commented user activity

                    const photoPostedUser = await UserModel.findOne({
                        attributes: ['id', 'notifications'],
                        include: [
                        {
                            model: PhotoModel,
                            attributes: [], 
                            where: {
                            id: commentedUserId.dataValues.photo_id
                            },
                            required: true 
                        }
                        ]
                    });
                    if(photoPostedUser && photoPostedUser.dataValues.notifications){
                        const RegularNotificationObj = photoPostedUser.dataValues.notifications.find(n => n.notification_type === 'regular');
                        let RegularNotification = RegularNotificationObj?.regular_notifications;
                        if(RegularNotification){
                            const regularNotification = RegularNotification.find(n => n.message.comment_id === req.body.commentID && n.message.receiver_id === photoPostedUser.dataValues.id && n.message.sender_id === commentedUserId.dataValues.user_id);
                            if(regularNotification){
                                let [commentUpvotedCount] = await sequelize.query(`Select count(*) as "upvoted_count" from "like_comments" where "comment_id"='${req.body.commentID}'`, {
                                    type: sequelize.QueryTypes.SELECT
                                });
                                if(commentUpvotedCount){
                                    regularNotification.message.upvoted_count = commentUpvotedCount.upvoted_count;
                                }

                                let topCommentId = regularNotification.message.top_comment_id;
                                if(topCommentId){
                                    const user = await UserModel.findOne({
                                        include: {
                                        model: CommentsModel,
                                        where: { id: topCommentId },
                                        attributes: [] 
                                        },
                                        attributes: ['id', 'notifications']
                                    });

                                    if(user){
                                        const UserRegularNotificationObj = user.dataValues.notifications.find(n => n.notification_type === 'regular');
                                        let UserRegularNotification = UserRegularNotificationObj?.regular_notifications;
                                        const UserNotification = UserRegularNotification.find(n => n.message.comment_id === req.body.commentID && n.message.receiver_id === user.dataValues.id && n.message.sender_id === commentedUserId.dataValues.user_id);
                                        if(UserNotification && commentUpvotedCount){
                                            UserNotification.message.upvoted_count = commentUpvotedCount.upvoted_count;
                                            user.changed('notifications', true);
                                            await user.save();
                                        }
                                    }
                                }                            
                                photoPostedUser.changed('notifications', true);
                                await photoPostedUser.save();
                            }
                        }
                    }
                }
                catch(err){
                    console.log(err.message);
                }
            }, 0)

            return {
                response: response,
                voteCount: voteCount
            };
        }
        catch(err){
            global.appLogger.info(`[Error] Performed Vote On Comment Api Call ${err.message} \n`);   
        }
    }
}