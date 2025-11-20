import { response } from 'express';
import baseService from './base.service';
import { createToken} from '../utils/jwt';
import { hashpassword, encrypt, decrypt, updateHuntScorePoints, incrementHuntScorePoints,
     updateUserNotifications
 } from '../utils/genericFunctions'
import { Op, literal } from 'sequelize';
import bcrypt from 'bcrypt'
import { sequelize } from '../utils/database';
import  {findOrCreateMultipleInterests, findOrCreateInterest, getAllInterestCategories, 
    getInterestsInCategory, findCategoryIdByName
} from "../utils/mailchimp/interest";
import  {addMemberToList } from "../utils/mailchimp/list";
import axios from 'axios';
import { Env } from '../config';
import {sendEmail} from "../utils/mailchimp/send_email";
import {getMemberProfile, updateMemberProfile, updateInterestsInProfile,  } from '../utils/mailchimp/profile';
import {getSecrets} from '../utils/secret-manager';
import { manageTags } from "../utils/mailchimp/tags";
import {v2 as cloudinary} from 'cloudinary';
import {photoOptimization} from "../utils/cloudinary/photo_optimization";


cloudinary.config({ 
    cloud_name:Env.cloudName,
    api_key:Env.cloudinaryApiKey,
    api_secret:Env.cloudinarySecretKey,
    secure: true  
  });
  

export class authService extends baseService {

    async registerUser(user) 
    {
        let userData = user.body;
        let response, listId, inviter;        
            try{
                global.appLogger.info(`\n---- Start User SignUp Api Call via ${userData.userType} with email as ${userData.email}  ----`);
                if(userData.referral_code != ""){
                    inviter = await this._invitationLinksModel.findOne({
                        where:{
                            referral_code: userData.referral_code
                        },
                        attributes:['user_id', 'link_expiry']
                    });

                    if(!inviter){
                        return {status:'Error', message: 'Invalid Link'};
                    }

                    if (inviter && Date.now() > inviter['dataValues']['link_expiry']) {
                        return {status:'Error', message: 'The link has been expired.'};
                    }                
                }

                const secretKey = await getSecrets();
                if(secretKey){                  
                    listId = secretKey.listId;
                    const MailChimpApiKey = secretKey.MailChimpMarketingApiKey;
                    response = await axios.get(`https://${Env.MailChimpServerPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${userData.email}`, {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`anystring:${MailChimpApiKey}`).toString('base64')}`
                    }
                    });          
                }   
            }
            catch{}

    
    
        const transaction = await sequelize.transaction();
        try{
            let userObj = {
                name: userData.name,
                email: userData.email,
                facebookUserId: userData.facebookUserId,
                password: userData.password,
                user_type: userData.userType,
                photo_url: userData.photo_url,
                photograper_type: userData.photograperType,
                photo_desire_ratio: userData.photoDesireRatio,
                genres_list: userData.genresList,
                camera_brand: userData.cameraBrand,
                photo_assistance: userData.photo_assistance,
                facebook_link: userData.facebookLink,
                twitter_link: userData.twitterLink,
                instagram_link: userData.instagramLink,
                website: userData.website,
                state: userData.state,
                country: userData.country,
                source: userData.source,
                heard_us: userData.heard_us,
            }
            if(userData.referral_code != ''){
                userObj.inviterId = inviter.dataValues.user_id
                userObj.referral_code = userData.referral_code
            }
                
            const newUser = await this._userModel.create(userObj,  { transaction })
    
        let interests; let subscriber_hash;

        if (newUser) {     
            const Token = await createToken(newUser); 
            if (response!= undefined && response.status === 200) {
                if(response.data.status=="subscribed"|| response.data.status=="archived" || response.data.status == "unsubscribed" || response.data.status == "cleaned"){        
                    subscriber_hash = await response.data.id;
                    interests = await getMemberProfile(subscriber_hash);
                    for (let key in interests) {
                        interests[key] = false;
                    }
                    const allCategories = await getAllInterestCategories();
                    const category = await allCategories.find(category=> category.title === "BPH Master: User Account Status");
                    let interestCategoryId;
                    if(category != undefined){
                        interestCategoryId = await category.id;         
                        if(interestCategoryId){         
                            const InterestCategories = await getInterestsInCategory(interestCategoryId);
                            
                            var photographerId= await findCategoryIdByName(InterestCategories, "Account Created - Photographer");
                            var nonPhotographerId= await findCategoryIdByName(InterestCategories, "Account Created - Non-Photographer");
                            if(userData.photograperType=="A professional" || userData.photograperType=="A hobbyist having fun" || userData.photograperType=="I am still learning" || userData.photograperType=="I post on social media only"){
                                interests[photographerId]= true;
                                interests[nonPhotographerId] = false;
                            }
                            else{
                                interests[photographerId]= false;
                                interests[nonPhotographerId] = true;
                            }     

                            
                        }
                    }          

                    try{
                        let userName = userData.name.split(' ');
                        let lastName = (userName.length < 2) ? "" : userName[userName.length - 1];
                        const updateMember = await updateMemberProfile(subscriber_hash, 
                        { 
                            status: 'subscribed',
                            email_type: 'html',
                            merge_fields: {
                                FNAME : userName[0],
                                LNAME: lastName,
                                PHOTOGTYPE:  userData.photograperType 
                            },
                            interests,
                            marketing_permissions:[{
                                marketing_permission_id: "c73a9abd30",
                                enabled: true
                            }]
                        })

                        await this.updateUserMemberId(newUser, subscriber_hash, transaction);
                    }
                    catch(err){
                        let memberid = await response.data.id;
                        if(memberid){
                            await this.updateUserMemberId(newUser, memberid, transaction);
                        }        
                    }
                }
                else{                      
                    let memberid= await response.data.id;
                    if(memberid){
                        await this.updateUserMemberId(newUser, memberid, transaction);
                    }                
                }
            } 
            else{
                return {status:'Error', message: 'Oops! Your email needs attention. Please contact us at the chat below.'}
            }

           
            setTimeout(async () => {

                 let inviterData;
                 try{          
                    if(userData.referral_code != ""){
                        inviterData = await this._userModel.findOne({
                            where:{
                                id: inviter.dataValues.user_id
                            },
                            attributes:['email']
                        })
                        const template = {
                            from_email:'support@example.com', 
                            from_name: "Photo Contest", 
                            to_email: inviterData.dataValues.email, 
                            subject:`Your friend ${userData.name} joined the Photo Contest`, 
                            body:`<p>Hi! <br><br> It’s your friendly Photo Contest bot letting you know that your friend, 
                            ${userData.name} has joined the Photo Contest. You can click to their profile on your 
                            Invite page: ${Env.Base_Url}/invite-friend
                            <br><br>Once they post their first photo to a hunt, you’ll BOTH get a free two-month paid membership 
                            and you’ll see a bonus 75 points added to your Hunt Score.
                            <br><br>If you have any questions, please email us at support@example.com
                            <br><br> Have a great day!
                            <br><br>The Photo Contest</p>`
                        }
                        await sendEmail(template);
                        global.appLogger.info(`[End] Successfully Sended Mail to Inviter ${inviterData.dataValues.email} \n`); 
                    }
                }
                catch(err){
                    global.appLogger.info(`[Error] Sending Mail to Inviter ${inviterData.dataValues.email} \n ${err.message} \n`); 
                }
                try{
                    if(userData.photo_url){
                        global.appLogger.info(`[Start] Optimizing Photo`);
                        const optimizedData = await photoOptimization(userData.photo_url, {folder:'Resized_Profiles', quality:"auto:best"});
                        if(optimizedData){
                            await this._userModel.update({
                                    compressedProfilePic: optimizedData.compressedImageUrl,
                                    compressedProfileId: optimizedData.compressedImageId
                                }, {
                                    where:{
                                    id: newUser.dataValues.id
                                    }
                                });
                            global.appLogger.info(`[End] Photo Optimized Successfully`);
                        }
                    }
                }
                catch(err){
                    global.appLogger.error(`[Error] Optimizing Photo ${err.message}`);
                }

                try{
                    if(userData.photo_url){
                        global.appLogger.info(`[Start] Adding Mailchimp Interest for Avatar Upload`);
                        const user_interests = await findOrCreateInterest('BPH Master: User Profile Completions', 'Avatar Uploaded'); 
                        if(user_interests){
                            let currentInterests = await getMemberProfile(newUser.dataValues.member_id);
                            if(currentInterests){
                                currentInterests[user_interests.interestId] = true;
                                await updateMemberProfile(newUser.dataValues.member_id, {interests: currentInterests});
                                global.appLogger.info(`[End] Successfully Added Mailchimp Interest for Avatar Upload \n`);
                            }                        
                        }                   
                    }
                }
                catch(err){
                    global.appLogger.error(`[Error] Adding Mailchimp Interest for Avatar Upload ${err.message} \n`);
                }

                if(userData?.batchId){
                    try{
                            const batchCreatedAt = await this._tempUserActionsModel.findOne({
                                where: {
                                    batch_id: userData.batchId,
                                    createdAt: {
                                        [Op.gt]: literal(`NOW() - INTERVAL '12 HOURS'`)
                                    }
                                },
                                attributes: ['createdAt'],
                                order: [['createdAt', 'ASC']]
                            });

                            if (!batchCreatedAt) {
                                await this.destroyTempUserAction(null, userData.batchId);     
                            }
                            else {
                                try{
                                    await this.performUpvotesByBatchId(newUser.dataValues.id, userData.batchId);
                                    await this.destroyTempUserAction('upvote_photo', userData.batchId);    
                                }
                                catch(err){
                                    global.appLogger.error(`Error performing upvotes by batch id ${userData.batchId} ${ err.message } \n`);
                                }    
                                
                                
                                try{
                                    await this.addCommentsByBatchId(newUser.dataValues.id, userData.batchId);
                                    await this.destroyTempUserAction('comment', userData.batchId); 
                                }
                                catch(err){
                                    global.appLogger.error(`Error adding comments by batch id ${userData.batchId} ${ err.message } \n`);
                                }
                            }                          
                                             
                    }
                    catch(err){
                        global.appLogger.error(`Error performing tempUserActions By batch id ${userData.batchId} ${ err.message } \n`);
                    }
                

                    
                }

            });
            global.appLogger.info('[End] User Registered Successfully!\n');
            const { password, token, token_expiry, member_id, ...userDetail } = newUser.toJSON ? newUser.toJSON() : newUser;
            return [userDetail, Token];
        }
    }
    catch(err){
        global.appLogger.error(`Error:`, { message: err });
        await transaction.rollback();
        return {status:'Error', message: 'Something went wrong while signup the user'}
    }
}


    async destroyTempUserAction(actionType, batchId){
        try{
                await this._tempUserActionsModel.destroy({
                    where:{
                        batch_id: batchId,
                        ...(actionType && { action_type: actionType })
                    }
                });
        }
        catch(err){
            global.appLogger.error(`Error deleting temp user action ${err.message}`);
        }
    }



    async performUpvotesByBatchId(user_id, batchId){
        try{
            const upvotedPhotos = await this._tempUserActionsModel.findAll({
                where:{
                    batch_id: batchId,
                    action_type: 'upvote_photo'
                },
                attributes:['data', 'id'],
                raw: true
            });

            for(const photo of upvotedPhotos){
                let photoData = photo.data;            
                
                let photoId = photoData.photoID;
                let loggedInUserId = user_id;
                
                const userId = await this._photoModel.findOne({
                    where:{
                        id: photoId
                    },
                    attributes:['user_id']
                });               


                try{        
                    global.appLogger.info(`\n---- Starting Perform Vote Api Call by user with Id ${loggedInUserId}----`);    
                    const [vote, created] = await this._voteModel.findOrCreate(
                        {
                            where: {
                                photo_id: photoId,
                                user_id: loggedInUserId
                            },
                            defaults: {
                                photo_id: photoId,
                                user_id: loggedInUserId,
                                is_vote:true
                            }
                        });                          
                
                        if (created){                                  
                                try {
                                    await updateHuntScorePoints(loggedInUserId, 'upvote_photo', 2);
                                    await incrementHuntScorePoints(loggedInUserId, 2);
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
                                    replacements: { photoId, userId: loggedInUserId }
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

                
                        }
                        else{              
                            await this._voteModel.update({is_vote:true},{where:{
                                photo_id: photoId,
                                user_id: loggedInUserId
                            }});
                        }
                            
                        global.appLogger.info(`[End] Upvoted Successfully \n`);      
                }
                catch(err){
                    global.appLogger.error(`[Error] Upvoting Photo Api ${err.message} \n`);    
                }
                            
    
                try{                    
                    
                        //upvote notification
                        if(userId.dataValues.user_id != loggedInUserId){
                                let newNotification = await this._notificationModel.create({
                                    receiver_id: userId.dataValues.user_id,
                                    sender_id: loggedInUserId,
                                    photo_id: photoId,
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
                                            'login_username', (Select "name" from "Users" u1 where u1."id"='${loggedInUserId}'),
                                            'login_photo_url', (SELECT CASE 
                                                    WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                                    ELSE u1."photo_url"  END 
                                                FROM "Users" u1 
                                                WHERE u1."id"='${loggedInUserId}'
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
                            global.appLogger.error(`[Error] Update User Upvote Notification ${err.message} \n`);
                        }

                        try{                        
                            let upvotedUser = await this._userModel.findOne({
                                where :{
                                    id: loggedInUserId
                                },
                                attributes:['id', 'notifications']
                            });       
                
                            if(upvotedUser && upvotedUser.dataValues.notifications){
                                const PhotoNotificationObj = upvotedUser.dataValues.notifications.find(n => n.notification_type === 'posted_photo');
                                let PhotoNotification = PhotoNotificationObj?.photo_notifications;
                                if(PhotoNotification){
                                    const photoNotification = PhotoNotification.find(n => n.message.photo_id === photoId && n.message.receiver_id === loggedInUserId && n.message.sender_id === userId.dataValues.user_id);
                                    if(photoNotification){
                                        photoNotification.message.is_photo_upvoted = true;
                                        upvotedUser.changed('notifications', true);
                                        await upvotedUser.save();
                                    }
                                }
                            }
                        }
                        catch(err){
                            global.appLogger.error(`[Error] Updating Photo Posted Notification after Upvote ${err.message} \n`);
                        }


                 global.appLogger.info(`[End] Photo Upvoted Successfully for temp User Action Id ${photo.id}\n`); 
            }

            global.appLogger.info(`Photos Upvoted Successfully for batch id ${batchId}`);
        }
        catch(err){
            global.appLogger.error(`Error in upvoting photos by batch id ${batchId} ${ err.message } \n`);
        }
    }


    async addCommentsByBatchId(user_id, batchId){
        try{
            const commentedPhotos = await this._tempUserActionsModel.findAll({
                where:{ 
                    batch_id: batchId,
                    action_type: 'comment'
                },
                attributes:['data', 'id'],
                raw: true
            });

            for(const photo of commentedPhotos){
                let photoData = photo.data;            
                
                let photoId = photoData.photoID;
                let commentText = photoData.comment_text;
                let topCommentId = photoData.top_comment_id;
                let subCommentId = photoData.sub_comment_id;

                let loggedInUserId = user_id;

                global.appLogger.info(`\n---- Start Add Comment Api Call by user with Id ${loggedInUserId} ----`);
                            
                const newComment = await this._commentModel.create({
                    photo_id: photoId,
                    comment_text: commentText,
                    user_id: loggedInUserId,
                    sub_comment_id: subCommentId,
                    top_comment_id: topCommentId
                });
                
                const photoDetail = await this._photoModel.findOne({
                    where:{
                        id: photoId
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
             
                try{
                        
                    if(newComment.dataValues.top_comment_id=="00000000-0000-0000-0000-000000000000" && newComment.dataValues.sub_comment_id=="00000000-0000-0000-0000-000000000000"){             
                        if(photoDetail.dataValues.user_id != loggedInUserId){
                            const user = await this._userModel.findOne({
                                where:{
                                    id: loggedInUserId
                                },
                                attributes:['id']
                            });
                            
                            let newNotification = await this._notificationModel.create({
                                receiver_id: photoDetail.dataValues.user_id,
                                sender_id: user.dataValues.id,
                                comment_id: newComment.dataValues.id,
                                photo_id: photoId,
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
                                            'login_username', (Select "name" from "Users" u1 where u1."id"='${loggedInUserId}'),
                                            'login_photo_url', (SELECT CASE 
                                                WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                                ELSE u1."photo_url"  END 
                                                FROM "Users" u1 
                                                WHERE u1."id"='${loggedInUserId}'
                                            ),
                                            'comment_id', c."id",
                                            'comment_text', c."comment_text",
                                            'photo_id', p."id",
                                            'top_comment_id', (Select "top_comment_id" from "Comments" where "id"=n."comment_id"),
                                            'sub_comment_id', c."id",
                                            'comment_createdAt', c."createdAt",
                                            'is_photo_upvoted', (SELECT EXISTS( SELECT * FROM "Votes" WHERE "photo_id" = p."id"  
                                                and "user_id"='${loggedInUserId}' and "is_vote"=true) 
                                            ),
                                            'photo_upvoted_count', (Select count(*) from "Votes" where "photo_id"= p."id" and "is_vote"=true),
                                            'upvoted_count', (Select count(*) from "like_comments" c1 where c1."comment_id"=n."comment_id" ),
                                            'is_vote', (Select Exists(Select * from "like_comments" where 
                                                "user_id"='${loggedInUserId}' and "comment_id"=n."comment_id")
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
                        global.appLogger.error(`[Error] Updating User Comment Notification ${err.message} \n`);
                    }
            
                    try{
                        
                        if(replierId != null){        
                            let replyToCommentNotification;
                            try{
                                                
                                if(photoDetail.dataValues.user_id != loggedInUserId ){                  
                                    replyToCommentNotification = await this._notificationModel.create({
                                        receiver_id: photoDetail.dataValues.user_id,
                                        sender_id: loggedInUserId,
                                        comment_id: newComment.dataValues.id,
                                        photo_id: photoId,
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
                                                    END
                                                ),
                                                'compressedProfileId', u."compressedProfileId",
                                                'photo_url', p."compressedImageUrl",
                                                'original_photo_url', p."photo_url",
                                                'compressedImageId', p."compressedImageId",
                                                'photo_owner_id', p."user_id",
                                                'login_username', (Select "name" from "Users" u1 where u1."id"='${loggedInUserId}'),
                                                'login_photo_url', (SELECT CASE 
                                                    WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                                    ELSE u1."photo_url"  END 
                                                    FROM "Users" u1 
                                                    WHERE u1."id"='${loggedInUserId}'
                                                ),
                                                'comment_id', c."id",
                                                'comment_text', c."comment_text",
                                                'photo_id', p."id",
                                                'top_comment_id', (Select "top_comment_id" from "Comments" where "id"=n."comment_id"),
                                                'sub_comment_id', c."id",
                                                'comment_createdAt', c."createdAt",
                                                'is_photo_upvoted', (SELECT EXISTS( SELECT * FROM "Votes" WHERE "photo_id" = p."id"  
                                                    and "user_id"='${loggedInUserId}' and "is_vote"=true) 
                                                ),
                                                'photo_upvoted_count', (Select count(*) from "Votes" where "photo_id"= p."id" and "is_vote"=true),
                                                'upvoted_count', (Select count(*) from "like_comments" c1 where c1."comment_id"=n."comment_id" ),
                                                'is_vote', (Select Exists(Select * from "like_comments" where 
                                                    "user_id"='${loggedInUserId}' and "comment_id"=n."comment_id")
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
                                            where n."id"='${replyToCommentNotification.dataValues.id}'`;
                                        
                                            await updateUserNotifications(query, photoDetail.dataValues.user_id);
                                        }
                                }
                            }
                            catch(err){
                                global.appLogger.error(`[Error] Updating Reply to Comment User Notification ${err.message} \n`);
                            }
                
                            try{                       
                                if(photoDetail.dataValues.user_id !=  newComment.dataValues.replyToId){
                                        replyToCommentNotification = await this._notificationModel.create({
                                            receiver_id: newComment.dataValues.replyToId,
                                            sender_id: loggedInUserId,
                                            comment_id: newComment.dataValues.id,
                                            photo_id: photoId,
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
                                                        END
                                                    ),
                                                    'compressedProfileId', u."compressedProfileId",
                                                    'photo_url', p."compressedImageUrl",
                                                    'original_photo_url', p."photo_url",
                                                    'compressedImageId', p."compressedImageId",
                                                    'photo_owner_id', p."user_id",
                                                    'login_username', (Select "name" from "Users" u1 where u1."id"='${loggedInUserId}'),
                                                    'login_photo_url', (SELECT CASE 
                                                        WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                                        ELSE u1."photo_url"  END 
                                                        FROM "Users" u1 
                                                        WHERE u1."id"='${loggedInUserId}'
                                                    ),
                                                    'comment_id', c."id",
                                                    'comment_text', c."comment_text",
                                                    'photo_id', p."id",
                                                    'top_comment_id', (Select "top_comment_id" from "Comments" where "id"=n."comment_id"),
                                                    'sub_comment_id', c."id",
                                                    'comment_createdAt', c."createdAt",
                                                    'is_photo_upvoted', (SELECT EXISTS( SELECT * FROM "Votes" WHERE "photo_id" = p."id"  
                                                        and "user_id"='${loggedInUserId}' and "is_vote"=true) 
                                                    ),
                                                    'photo_upvoted_count', (Select count(*) from "Votes" where "photo_id"= p."id" and "is_vote"=true),
                                                    'upvoted_count', (Select count(*) from "like_comments" c1 where c1."comment_id"=n."comment_id" ),
                                                    'is_vote', (Select Exists(Select * from "like_comments" where 
                                                        "user_id"='${loggedInUserId}' and "comment_id"=n."comment_id")
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
                                                where n."id"='${replyToCommentNotification.dataValues.id}'`;
                                            
                                                await updateUserNotifications(query, newComment.dataValues.replyToId);
                                            }
                                        }
                            }       
                            catch(err){
                                global.appLogger.error(`[Error] Updating Replier to Comment User Notification ${err.message} \n`);
                            }
                        }
                
                    }
                    catch(err){
                        global.appLogger.error(`[Error] Update reply to comment notification ${err.message} \n`);
                    }
                                  
                    //add interest for adding comment
                    let result;
                    try  {  
                                    
                        let query = `Select
                            (Select email from "Users" where "id"=:userId) as commenter_email,
                            (SELECT COUNT(*)::integer FROM "Comments" where "user_id"=:userId) as comments,
                            (SELECT COUNT(*)::integer FROM "Comments" where "user_id"=:userId and 
                                top_comment_id = '00000000-0000-0000-0000-000000000000'
                                and sub_comment_id = '00000000-0000-0000-0000-000000000000'
                            ) as top_comments_count,
                            (SELECT COUNT(*)::integer FROM "Comments" JOIN "Photos" ON "Photos".id = "Comments".photo_id
                                WHERE "Photos".user_id = (SELECT "user_id" FROM "Photos" WHERE "Photos".id = :photoId)
                            ) as comment_received,
                            (Select email from "Photos" join "Users" on "Users"."id" = "Photos"."user_id"
                                where "Photos".id = :photoId
                            ),
                            (Select "member_id" from "Users" where "email"=
                            (Select email from "Users" where "id"=:userId)) as commenter_member_id,
                            (Select "member_id" from "Users" where "email"=
                            (Select email from "Photos" join "Users" on "Users"."id" = "Photos"."user_id"
                                where "Photos".id =:photoId)
                            ) as photo_member_id`;
                
                            result = await sequelize.query(query, {
                                type: sequelize.QueryTypes.SELECT,
                                replacements: { photoId, userId: loggedInUserId }
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
                                await updateHuntScorePoints(loggedInUserId, 'leave_comment', 5);
                                await incrementHuntScorePoints(loggedInUserId, 5);
                            }
                        }
                        catch(err){
                            global.appLogger.error(`[Error] Updating Hunt Score Points for Comment By User Id ${loggedInUserId} ${err.message} \n`);
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
                            global.appLogger.error(`[Error] Mailchimp Tag User_Gave_9_Comments for User ${result[0].commenter_email} ${err.message} \n`);
                        }
                   
                                    
                global.appLogger.info(`[End] Comment Added Successfully for temp User Action Id ${photo.id}\n`);

            }

            global.appLogger.info(`Comments Added Successfully for batch id ${batchId}`);

        }
        catch(err){
            global.appLogger.error(`[Error] Perform Comments By Batch Id ${batchId} ${err.message} \n`);
        }
    }

    async updateUserMemberId(newUser, memberId, transaction){
        try{
            await this._userModel.update({ member_id: memberId }, { where: { id: newUser.dataValues.id }, transaction });                 
            newUser.dataValues.member_id = memberId;
            await transaction.commit();
        }
        catch(err){
            throw err;
        }
    }

    async isUserExist(email) {
        try{
            let user = await this._userModel.findOne({ where: { email: email } })
            if (user) {
                return user;
            }
            return undefined;
        }
        catch{}
    }


    async login(email,  userPassword) {
        try{
                global.appLogger.info(`\n---- Start User Login Api Call with email as ${email} ----`);
                let user = await this._userModel.findOne({ 
                    where: {
                        email: email
                    }
                });

                if(user && user.isBlocked == true){
                    return {status:'Error', message: `Your account is blocked`};
                }
        
        
                if (!user) {
                    return {status:'Error', message: `Sorry. We don't recognize that username or password. If you forgot your password,`}
                }
            
                if((user.user_type == 'google' || user.user_type == 'facebook') && userPassword){
                    return { status: 'Error', message:`You previously logged in via ${user.user_type}. Please try that.`}
                }
         
                const passwordMatch = await bcrypt.compare(userPassword, user.password);
                if (!passwordMatch) {
                    return {status:'Error', message: `Sorry. We don't recognize that username or password. If you forgot your password,`}
                }               
 
                user.dataValues.photo_url= user.dataValues.compressedProfilePic ? user.dataValues.compressedProfilePic: user.dataValues.photo_url;
                const Token = await createToken(user);
                const { password, token, token_expiry, ...userData } = user.toJSON ? user.toJSON() : user;
                global.appLogger.info(`[End] User Login Successfully\n`);
                return [userData, Token];   
        }
        catch(err){
            global.appLogger.error(`[Error] User Login Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }

    async forgetPassword(userEmail){
        try{
            global.appLogger.info(`\n---- Start Forget Password Api Call with email as ${userEmail} ----`);
            const user = await this._userModel.findOne({
                where:{email: userEmail}
            });
            if(user){
                if(user.dataValues.isBlocked == true){
                    return {status:'Error', message:`Your Account is Blocked`}
                }
                if(user.dataValues.user_type == 'email'){
                    const secretKey = await getSecrets();
                    const CRYPTO_SECRET = secretKey.CRYPTO_SECRET;
                    const encryptedData = encrypt(user.dataValues.id, `${CRYPTO_SECRET}`)
                    const encodedToken = encodeURIComponent(encryptedData.encryptedText);
                    let link = `${Env.Base_Url}/reset-password?token=` + encodedToken;
                    const template={from_email:'support@example.com', from_name: "Photo Contest", to_email:userEmail, subject:'Reset Your Password', body:`<p>Hi - <br><br> Thanks for requesting a link to reset your Photo Contest password. Click on the link below to take you to a private password page. <br><br> ${link} <br><br> If you did not request this password change, please reply to this email with a message to let us know. <br><br> Thanks so much,<br> Photo Contest</p>`}
                    const message =  await sendEmail(template);
                    await this._userModel.update({ token:encodedToken, token_expiry:encryptedData.timestamp }, { where: { id: user.dataValues.id } });                 
                    global.appLogger.info(`[End] Password Forget Successfully\n`);
                    return message;
                }
                else{
                    return {status:'Error', message:`Your given email type is ${user.dataValues.user_type}. You can't change your password.`}
                }           
            }
            else{
                return {status:'Error', message:'Email Not Exist'}
            }
            
        }
        catch(err){
            global.appLogger.error(`[Error] Forget Password Api Call ${err.message}\n`);
            throw new Error(err);
            //return {status:'Error', message:'Something went wrong while forgetting the password.'}
        }
    }


     async resetPassword(req){
        try{
            global.appLogger.info(`\n---- Start Reset Password Api Call ----`);
            const secretKey = await getSecrets();
            const CRYPTO_SECRET = secretKey.CRYPTO_SECRET;
            let decryptedText = decrypt(`${req.query.token}`, `${CRYPTO_SECRET}` );
            let userId = `${decryptedText.userId}`;
            let user = await this._userModel.findOne({
                where: {
                    id: userId
                }
            })
            if(user){
                let token = encodeURIComponent(req.query.token);
                if(Date.now() < decryptedText.timestamp && token== user.dataValues.token)
                {
                    const hashPassword = await hashpassword(req.body.password);
                    await this._userModel.update({ password: hashPassword, token:null, token_expiry: null }, { where: { id: userId } });                 
                    const token = await createToken(user);
                    token.message = 'Password Reset Successfully!';
                    global.appLogger.info(`[End] Password Reset Successfully\n`);
                    return [token];
                }
                else{
                    return {status:'Error', message:'Reset Password Link has been expired!'}
                }
            }
            else{
                return {status:'Error', message:'User Not Exist'}
            }
        }
        catch(error){
            global.appLogger.error(`[Error] Reset Password Api Call ${error.message}\n`);
           // return {status:'Error', message:error.message}
           throw new Error(error);
        }
    }

    async getUserProfileByEmail(userEmail) {
        try{
            global.appLogger.info(`\n---- Start Getting User Profile By Email ${userEmail} Api Call ----`);
            const user = await this._userModel.findOne({
                where:{
                    [Op.or]: [
                        { email: userEmail} ,
                        { facebookUserId: userEmail }
                ]}
            });

            if(user){ 
                const isPhotoSorted = await this._galleryPhotoModel.count({
                    where:{
                      user_id: user.dataValues.id,
                      isVisible: true
                    }
                });
            
                  let photoSort = 'order by ("createdAt") ASC';
                  if(isPhotoSorted){
                    photoSort = `order by ("isVisible"=true) DESC, ("updatedAt") DESC`
                  }

                const query= `SELECT id, name, email, about_me, total_hunt_scores, "isWebsiteCompletelyCreated",
                (Select website_url from "Personal_Websites" where "user_id"= :userId) as website_url,
                (Select template_name from "Personal_Websites" where "user_id"= :userId) as template_name,
                CASE WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
                ELSE photo_url END AS photo_url, 
                "compressedProfileId", 
                CASE WHEN "membershipPlan" IS NOT NULL THEN true 
                ELSE false END AS "isBilling",
                CASE WHEN LENGTH("compressedCoverPhoto") > 0 THEN "compressedCoverPhoto" 
                ELSE "compressedCoverPhoto" END AS "compressedCoverPhoto", "compressedCoverPhotoId",
                user_type, photo_desire_ratio, photograper_type, camera_brand, photo_assistance, facebook_link, 
                twitter_link, instagram_link, website, state, country, source, "createdAt", "updatedAt",
                ( SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(genres_list, ',')) genre
                ) AS genres_list,
                ( SELECT json_object_agg(strength, strength) FROM unnest(string_to_array(strengths, ',')) strength
                ) AS strengths,
                ( SELECT json_object_agg(meet_for, meet_for) FROM unnest(string_to_array(meet_for, ',')) meet_for
                ) AS meet_for,
                COALESCE(
                    ( SELECT json_build_object( 'count', (SELECT count(*)
                    FROM "Followers" f JOIN "Users" u ON u.id = f.follower_id
                    WHERE f.user_id = :userId AND f."is_active"=true AND u."isBlocked" = false),
                    'data', json_agg(json_build_object('photo_url', photo_url, 'name', name, 
                    'compressedProfileId', "compressedProfileId"))
                    )
                    FROM (
                        SELECT f.*, CASE WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                        ELSE u."photo_url"
                        END AS "photo_url", u.name, u."compressedProfileId"
                        FROM "Followers" f
                        JOIN "Users" u ON u.id = f.follower_id
                        WHERE f.user_id = :userId AND f."is_active"=true
                        AND u."isBlocked" = false
                        ORDER BY f."updatedAt" DESC
                        LIMIT 3
                    ) f
                    GROUP BY f.user_id
                    ORDER BY MAX(f."updatedAt") DESC
                ),
                json_build_object('count', 0, 'data', '[]'::json)
                ) AS "Following",
                COALESCE(
                (
                    SELECT json_build_object(
                        'count', (SELECT count(*)
                        FROM "Followers" f
                        JOIN "Users" u ON u.id = f.follower_id
                        WHERE f.follower_id = :userId
                        AND f."is_active"=true
                        AND u."isBlocked" = false),
                        'data', json_agg(json_build_object('photo_url', photo_url, 'name', name,
                        'compressedProfileId', "compressedProfileId"))
                    )
                    FROM (
                        SELECT f.*,
                        CASE WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                        ELSE u."photo_url"
                        END AS "photo_url",
                        u."compressedProfileId", u.name
                        FROM "Followers" f
                        JOIN "Users" u ON u.id = f.user_id
                        WHERE f.follower_id = :userId AND f."is_active"=true
                        AND u."isBlocked" = false
                        ORDER BY f."updatedAt" DESC
                        LIMIT 3
                    ) f1
                    GROUP BY f1.follower_id
                    ORDER BY MAX(f1."updatedAt") DESC
                ),
                json_build_object('count', 0, 'data', '[]'::json)
            ) AS "Followers",
            (SELECT json_agg(
                json_build_object(
                  'compressedImageUrl', gp."compressedImageUrl",
                  'compressedImageId', gp."compressedImageId"
                )
              ) AS "gallery_photos"
              FROM (
                SELECT "compressedImageUrl", "compressedImageId"
                FROM "gallery_photos"
                WHERE "user_id" = u1.id
                ${photoSort}   
                LIMIT 5
              ) gp
            )  
            FROM "Users" u1 WHERE email = :UserEmail or "facebookUserId" = :UserEmail`;

           const results = await sequelize.query(query, 
            {
                type: sequelize.QueryTypes.SELECT,
                replacements: { UserEmail: userEmail, userId: user.dataValues.id }
            });

           if(user.dataValues.compressedCoverPhoto == null){
                const randomInt = Math.floor(Math.random() * 6) + 1;
                results[0]['compressedCoverPhoto'] = `https://bph051023a.s3.amazonaws.com/cover_photos/cover_img${randomInt}.jpg`
            }
                const token = await createToken(results[0]);
                global.appLogger.info(`[End] Successfully Fetched User Profile By Email \n`);
                return [results[0], token];     
           }
           else{
                return undefined;
           }   
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching User Profile By Email Api Call ${err.message} \n`);
            throw new Error(err);
        }
    }

    async checkUserExistenceByEmail(userEmail, referral_code, userType, batchId){
        try{
            if(referral_code != ""){
                let inviter = await this._invitationLinksModel.findOne({
                    where:{
                        referral_code: referral_code 
                    },
                    attributes:['link_expiry']
                });

                if(!inviter){
                    return {status:'Error', message: 'Invalid Link'};
                }

                if (inviter && Date.now() > inviter['dataValues']['link_expiry']) {
                    return {status:'Error', message: 'The link has been expired.'};
                }                              
            }

            global.appLogger.info(`\n---- Start Checking User Existence By Email ${userEmail} Api Call ----`);
            const user = await this._userModel.findOne({
                where:{
                    [Op.or]: [
                        { email: userEmail} ,
                        { facebookUserId: userEmail }
                ]}
            });

            if(user){
                if(user.dataValues.isBlocked == true){
                    return {message:"Your Account is Blocked"}
                }  

                global.appLogger.info(`[End] User Already Exist with email as ${userEmail}\n`);
                if(userType != 'email'){
                    if(batchId){
                        try{
                            const batchCreatedAt = await this._tempUserActionsModel.findOne({
                                where: {
                                    batch_id: batchId,
                                    createdAt: {
                                        [Op.gt]: literal(`NOW() - INTERVAL '12 HOURS'`)
                                    }
                                },
                                attributes: ['createdAt'],
                                order: [['createdAt', 'ASC']]
                            });

                            if (!batchCreatedAt) {
                                await this.destroyTempUserAction(null, batchId);     
                            }
                            else {
                                try{
                                    await this.performUpvotesByBatchId(user.dataValues.id, batchId);
                                    await this.destroyTempUserAction('upvote_photo', batchId);    
                                }
                                catch(err){
                                    global.appLogger.error(`Error performing upvotes by batch id ${batchId} ${ err.message } \n`);
                                }    
                                
                                
                                try{
                                    await this.addCommentsByBatchId(user.dataValues.id, batchId);
                                    await this.destroyTempUserAction('comment', batchId); 
                                }
                                catch(err){
                                    global.appLogger.error(`Error adding comments by batch id ${batchId} ${ err.message } \n`);
                                }
                            }                          
                                             
                    }
                    catch(err){
                        global.appLogger.error(`Error performing tempUserActions By batch id ${batchId} ${ err.message } \n`);
                    }
                

                    }
                    const isPhotoSorted = await this._galleryPhotoModel.count({
                            where:{
                            user_id: user.dataValues.id,
                            isVisible: true
                            }
                        });
                
                    let photoSort = 'order by ("createdAt") ASC';
                    if(isPhotoSorted){
                        photoSort = `order by ("isVisible"=true) DESC, ("updatedAt") DESC`
                    }
        
                    const query= `SELECT id, name, email, about_me,
                        CASE 
                        WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
                        ELSE photo_url
                        END AS photo_url, 
                        "compressedProfileId", 
                        CASE 
                        WHEN "membershipPlan" IS NOT NULL THEN true 
                        ELSE false 
                        END AS "isBilling",
                        CASE 
                        WHEN LENGTH("compressedCoverPhoto") > 0 THEN "compressedCoverPhoto" 
                        ELSE "compressedCoverPhoto"
                        END AS "compressedCoverPhoto", 
                        "compressedCoverPhotoId",
                        user_type, photo_desire_ratio, photograper_type, camera_brand, 
                        photo_assistance, facebook_link, 
                        twitter_link, instagram_link, website, state, country, source, "createdAt", "updatedAt",
                        ( SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(genres_list, ',')) genre
                        ) AS genres_list,
                        ( SELECT json_object_agg(strength, strength) FROM unnest(string_to_array(strengths, ',')) strength
                        ) AS strengths,
                        ( SELECT json_object_agg(meet_for, meet_for) FROM unnest(string_to_array(meet_for, ',')) meet_for
                        ) AS meet_for,
                        COALESCE(
                            ( SELECT json_build_object( 'count', (SELECT count(*)
                            FROM "Followers" f JOIN "Users" u ON u.id = f.follower_id
                            WHERE f.user_id = :userId AND f."is_active"=true AND u."isBlocked" = false),
                            'data', json_agg(json_build_object('photo_url', photo_url, 'name', name, 
                            'compressedProfileId', "compressedProfileId"))
                            )
                            FROM (
                                SELECT f.*, CASE WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                                ELSE u."photo_url"
                                END AS "photo_url", u.name, u."compressedProfileId"
                                FROM "Followers" f
                                JOIN "Users" u ON u.id = f.follower_id
                                WHERE f.user_id = :userId AND f."is_active"=true
                                AND u."isBlocked" = false
                                ORDER BY f."updatedAt" DESC
                                LIMIT 4
                            ) f
                            GROUP BY f.user_id
                            ORDER BY MAX(f."updatedAt") DESC
                        ),
                        json_build_object('count', 0, 'data', '[]'::json)
                        ) AS "Following",
                        COALESCE(
                        (
                            SELECT json_build_object(
                                'count', (SELECT count(*)
                                FROM "Followers" f
                                JOIN "Users" u ON u.id = f.follower_id
                                WHERE f.follower_id = :userId
                                AND f."is_active"=true
                                AND u."isBlocked" = false),
                                'data', json_agg(json_build_object('photo_url', photo_url, 'name', name,
                                'compressedProfileId', "compressedProfileId"))
                            )
                            FROM (
                                SELECT f.*,
                                CASE WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                                ELSE u."photo_url"
                                END AS "photo_url",
                                u."compressedProfileId", u.name
                                FROM "Followers" f
                                JOIN "Users" u ON u.id = f.user_id
                                WHERE f.follower_id = :userId AND f."is_active"=true
                                AND u."isBlocked" = false
                                ORDER BY f."updatedAt" DESC
                                LIMIT 4
                            ) f1
                            GROUP BY f1.follower_id
                            ORDER BY MAX(f1."updatedAt") DESC
                        ),
                        json_build_object('count', 0, 'data', '[]'::json)
                    ) AS "Followers",
                    (SELECT json_agg(
                        json_build_object(
                        'compressedImageUrl', gp."compressedImageUrl",
                        'compressedImageId', gp."compressedImageId"
                        )
                    ) AS "gallery_photos"
                    FROM (
                        SELECT "compressedImageUrl", "compressedImageId"
                        FROM "gallery_photos"
                        WHERE "user_id" = u1.id
                        ${photoSort}   
                        LIMIT 5
                    ) gp
                    )  
                    FROM "Users" u1 WHERE email = :UserEmail or "facebookUserId" = :UserEmail`;
    
                    const results = await sequelize.query(query, 
                    {
                        type: sequelize.QueryTypes.SELECT,
                        replacements: { UserEmail: userEmail, userId: user.dataValues.id }
                    });
    
                    if(user.dataValues.compressedCoverPhoto == null){
                        const randomInt = Math.floor(Math.random() * 6) + 1;
                        results[0]['compressedCoverPhoto'] = `https://bph051023a.s3.amazonaws.com/cover_photos/cover_img${randomInt}.jpg`
                    }
                        const token = await createToken(results[0]);
                        global.appLogger.info(`[End] Successfully Fetched User Profile By Email \n`);
                        return [results[0], token];     
                }
               return {message:"This user already exists. Please sign in below."}
           }
           else{
                try{
                    //setTimeout(async () => {
                        global.appLogger.info(`[Start] Adding Mailchimp Interest For User Started Registration`);
                        let userExistsInMailchimp;
                        const secretKey = await getSecrets();
                        let listId = secretKey.listId; 
                        const MailChimpApiKey = secretKey.MailChimpMarketingApiKey;
                        try{
                            userExistsInMailchimp = await axios.get(`https://${Env.MailChimpServerPrefix}.api.mailchimp.com/3.0/lists/${listId}/members/${userEmail}`, {
                                headers: {
                                    'Authorization': `Basic ${Buffer.from(`anystring:${MailChimpApiKey}`).toString('base64')}`
                                }
                            });
                        }
                        catch(err){}
                        const interests = await findOrCreateInterest('BPH Master: User Account Status', 'Started Registration'); 
                        if(userExistsInMailchimp !=undefined){
                            try{
                                const currentInterests = userExistsInMailchimp.data.interests;
                                if(currentInterests){
                                    for (let key in currentInterests) {
                                        currentInterests[key] = false;
                                    }
                                    currentInterests[interests.interestId] = true;
                                    await updateMemberProfile(userExistsInMailchimp.data.id, {
                                        status: 'subscribed',
                                        email_type: 'html',
                                        interests: currentInterests,
                                        marketing_permissions:[{
                                            marketing_permission_id: "c73a9abd30",
                                            enabled: true
                                        }]
                                    })
                                    global.appLogger.info(`[End] Successfully Added Mailchimp Interest For User Started Registration \n`);
                                }
                            }
                            catch{}
                        }
                        else{
                            try{
                                global.appLogger.info(`[Start] Added Member to Mailchimp List with email as ${userEmail}`);
                                await addMemberToList(listId, userEmail, interests.interestId);     
                                global.appLogger.info(`[End] Successfully Added Member to Mailchimp List with email as ${userEmail} \n`);          
                            }
                            catch(err){
                                global.appLogger.error(`[Error] Adding Member to Mailchimp List with email as ${userEmail} ${err} \n`);
                                return {message:"Oops! Your email needs attention. Please contact us at the chat below."}
                            }
                        }
                    //},0)
                    return undefined;
                }
                catch(err){
                    global.appLogger.error(`[Error] Adding Mailchimp Interest For User Registration ${err.message}`);
                }
           }   
        }
        catch(err){    
            global.appLogger.error(`[Error] Checking User Existence By Email ${userEmail} Api Call ${err.message}`);
            throw new Error(err);
        }
    }
}
