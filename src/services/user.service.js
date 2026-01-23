import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
const uploadPhoto = require("../utils/aws/s3");
import { createToken } from '../utils/jwt';
import { hashpassword, shuffleData, generateUniqueReferralCode } from '../utils/genericFunctions';
import {getMemberProfile, updateMemberProfile } from '../utils/mailchimp/profile';
import {photoOptimization} from "../utils/cloudinary/photo_optimization";
import  {findOrCreateInterest} from "../utils/mailchimp/interest";
import { Env } from '../config';
import {sendEmail} from "../utils/mailchimp/send_email";
const moment_timezone = require('moment-timezone');
import {getSecrets} from "../utils/secret-manager";
import {v2 as cloudinary} from 'cloudinary';
const mailchimp = require("@mailchimp/mailchimp_marketing");
import { updateUserNotifications } from '../utils/genericFunctions';
import { Op } from 'sequelize';
import { UserModel } from '../models';
const Stripe = require('stripe');

cloudinary.config({ 
  cloud_name:Env.cloudName,
  api_key:Env.cloudinaryApiKey,
  api_secret:Env.cloudinarySecretKey,
  secure: true  
});


(async () => {
    try{
        let secret_key = await getSecrets();
        mailchimp.setConfig({
            apiKey: secret_key.MailChimpMarketingApiKey,
            server: Env.MailChimpServerPrefix 
        })
    }
    catch{}
})()

export class userService extends baseService {
    async editProfile(req) {
        try
        {
            global.appLogger.info(`\n---- Starting Edit Profile Api Call by User with Id ${req.userData._id} ----`);
            var photo_url;
            let user = await this._userModel.findOne(  { where: { id: req.userData._id } })
            if(user){
                try{   
                    const photoData = await uploadPhoto.uploadPhoto(req.files.photoUrl);
                    if (photoData != undefined){
                        photo_url =  photoData;
                    }
                }
                catch(err){            
                    photo_url = await user.dataValues.photo_url;    
                }

                let updateData;
                if(req.body.page=='edit_profile'){
                    if(req.body.aboutMe == "undefined"){
                        req.body.aboutMe = "";
                    }
                    updateData = { 
                        photograper_type: req.body.photographerType,
                        photo_assistance: req.body.photo_assistance,
                        genres_list: req.body.genresList,
                        camera_brand:  req.body.cameraBrand,
                        facebook_link: req.body.facebookLink,
                        twitter_link: req.body.twitterLink,
                        instagram_link: req.body.instagramLink,
                        website: req.body.website,
                        state: req.body.state,
                        email: req.body.email,
                        about_me: req.body.aboutMe,
                        strengths: req.body.strengths,
                        meet_for: req.body.meetFor,
                        photo_url
                    }
                }
                else{
                    updateData = {
                        photo_url
                    }
                }
            
                let updatedProfile = await this._userModel.update(
                    updateData, { returning:true, where: { id: req.userData._id }
                });
                let profile = updatedProfile[1][0].get();
                let optimizedData;
                try {
                    if(req.files != null){
                        let imageFilePath = await req.files.photoUrl['tempFilePath'];
                        optimizedData = await photoOptimization(imageFilePath, {folder:'Resized_Profiles', quality:"auto:good"});
                        updatedProfile =  await this._userModel.update({
                            compressedProfilePic: optimizedData.compressedImageUrl,
                            compressedProfileId: optimizedData.compressedImageId
                            }, {
                                returning:true,
                                where:{
                                    id: user.dataValues.id
                                }
                        });
                        profile = await updatedProfile[1][0].get();
                        profile.photo_url = await profile.compressedProfilePic ? profile.compressedProfilePic: profile.photo_url;
                    }
                }
                catch(err){
                    return { status: 'Error', message: 'Something went wrong while compressing image' };
                }
              
                setTimeout(async () => {
                    try {
                        if(req.files != null && user.dataValues.photo_url==''){
                            global.appLogger.info(`[Start] Adding Mailchimp Interest for Avatar Upload For Member Id ${user.dataValues.member_id} `);
                            const interests = await findOrCreateInterest('BPH Master: User Profile Completions', 'Avatar Uploaded'); 
                            if(interests){
                                let currentInterests = await getMemberProfile(user.dataValues.member_id);
                                if(currentInterests){
                                    currentInterests[interests.interestId] = true;
                                    await updateMemberProfile(user.dataValues.member_id, {interests: currentInterests});
                                    global.appLogger.info(`[End] Successfully Added Mailchimp Interest for Avatar Upload For Member Id ${user.dataValues.member_id} \n`);
                                }
                            }
                        }  

                        if(req.body.page=='edit_profile' &&  updateData.facebook_link=='' && updateData.twitter_link=='' && updateData.instagram_link=='' && updateData.website==''){
                            global.appLogger.info(`[Start] Removing Mailchimp Interest for Social Media Links For MemberId ${user.dataValues.member_id}`);
                            const interests = await findOrCreateInterest('BPH Master: User Profile Completions', 'Social Media Included'); 
                            if(interests){
                                let currentInterests = await getMemberProfile(user.dataValues.member_id);
                                if(currentInterests && currentInterests[interests.interestId] == true){
                                    currentInterests[interests.interestId] = false;
                                    await updateMemberProfile(user.dataValues.member_id, {interests: currentInterests});  
                                }
                                global.appLogger.info(`[End] Successfully Removed Mailchimp Interest for Social Media Links For Member Id ${user.dataValues.member_id} \n`);
                            }
                        }
                        else {
                            if(req.body.page=='edit_profile' && (user.dataValues.facebook_link!=updateData.facebook_link || user.dataValues.twitter_link != updateData.twitter_link || user.dataValues.instagram_link!=updateData.instagram_link || user.dataValues.website!= updateData.website)){
                                global.appLogger.info(`[Start] Adding Mailchimp Interest for Social Media Links For MemberId ${user.dataValues.member_id}`);
                                const interests = await findOrCreateInterest('BPH Master: User Profile Completions', 'Social Media Included'); 
                                if(interests){
                                    let currentInterests = await getMemberProfile(user.dataValues.member_id);
                                    if(currentInterests && currentInterests[interests.interestId] == false){
                                        currentInterests[interests.interestId] = true;
                                        await updateMemberProfile(user.dataValues.member_id, {interests: currentInterests});
                                    }
                                    global.appLogger.info(`[End] Successfully Added Mailchimp Interest for Social Media Links For MemberId ${user.dataValues.member_id} \n`);
                                }
                            }             
                        }
                    }
                    catch(error){
                        global.appLogger.error(`[Error] Adding Mailchimp Interest in Edit Profile Api Call ${error.message}`);
                    }
                });

                global.appLogger.info(`[End] Profile Edited Successfully \n`);
                return profile;
            }
    
        }
        catch(error){
            global.appLogger.error(`[Error] Edit Profile Api Call ${error.message} \n`);
            return { status: 'Error', message: 'Something went wrong while editing user profile.' };
        }
    }
    
    async updateLastVisitTime(req){
        try{
            global.appLogger.info(`\n---- Starting update Last Visit Time Api Call by User with Id ${req.userData._id} ----`);
            const lastVisitTime = (moment_timezone.tz(req.body.lastVisitTime, 'UTC').tz('America/New_York')).format('YYYY-MM-DD HH:mm:ss.SSSZZ'); 

            await this._userModel.update({ lastVisitTime: lastVisitTime }, 
                { where: { id: req.userData._id } 
            });
            global.appLogger.info(`[End] Last Visit Time Updated Successfully \n`);
            return {message:"Last Visit Time Updated Successfully!"}
        }
        catch(err){
            global.appLogger.error(`[Error] Update Last Visit Time Api Call ${err.message} \n`);
            throw new Error(err.message);
        }
    }

    async uploadCoverPhoto(req){
        try
        {
            global.appLogger.info(`\n---- Starting Upload Cover Photo Api Call by User with Id ${req.userData._id} ----`);
            const photoData = await uploadPhoto.uploadPhoto(req.files.photoUrl);
            if (photoData != undefined){
                let imageFilePath = await req.files.photoUrl['tempFilePath'];
                if(imageFilePath){
                    const optimizedData = await photoOptimization(imageFilePath, {folder:'Resized_Profiles', quality:"auto:good"});
                    if(optimizedData){
                        await this._userModel.update({
                            cover_photo_url: photoData,
                            compressedCoverPhoto: optimizedData.compressedImageUrl,
                            compressedCoverPhotoId: optimizedData.compressedImageId
                        }, {
                            returning:true,
                            where:{
                                id: req.userData._id
                            }
                        });
                    }
                }
                    
                global.appLogger.info(`[End] Cover Photo Uploaded Successfully by User with Id ${req.userData._id} \n`);
                return {message:"Cover Photo Uploaded Successfully"};
            }       
        }
        catch(err) {
            global.appLogger.error(`[Error] Uploading Cover Photo Api ${err.message} \n`);
            return { status: 'Error', message: 'Something went wrong while uploading cover photo' };
        }
    }

    async sendPhotoReminder(req){
        try{
            global.appLogger.info(`\n---- Starting Send Photo Reminder Api Call by User with Id ${req.userData._id} ----`);
            let reminderDate;
            if(req.body.isPaid == true && req.body.queuedPhotos == 4){
                const queuedPhoto = await this._photoModel.findOne({
                    where:{
                        user_id: req.userData._id,
                        isQueued: true
                    }, 
                    attributes:['createdAt','day'],
                    order:[['createdAt', 'ASC']],
                    limit: 1
                });

                if(queuedPhoto){
                    if(queuedPhoto.dataValues.day == 'Monday'){
                        reminderDate = queuedPhoto.dataValues.createdAt;
                    }
                    else{
                        let currentDate = new Date(queuedPhoto.dataValues.createdAt);
                        let currentDay = currentDate.getDay();
                        let daysUntilNextMonday = (8 - currentDay) % 7;
                        reminderDate = currentDate.setDate(currentDate.getDate() + daysUntilNextMonday);
                    }
                    await this._userModel.update({ reminder: true, reminderDate, queued_count: 4 }, { where: { id: req.userData._id } }); 
                }
                
            }
            else{
                moment_timezone.updateLocale('en', {
                    week: {
                      dow: 1 
                    }
                  });
                  
                  const dayOffsets = {
                    'Monday': 0,
                    'Tuesday': 1,
                    'Wednesday': 2,
                    'Thursday': 3,
                    'Friday': 4,
                    'Saturday': 5,
                    'Sunday': 6
                  };
                  
                  if (dayOffsets.hasOwnProperty(req.body.reminderDay)) {
                        const nextWeekMonday = moment_timezone.tz('America/New_York').add(2, 'week').startOf('week');               
                        let reminderDate = nextWeekMonday.clone().add(dayOffsets[req.body.reminderDay], 'days');
                        const [hour, minute, second] = (moment_timezone.tz('America/New_York').format('HH:mm:ss')).split(':');
                        reminderDate.set({ hour: +hour, minute: +minute, second: +second });             

                        await this._userModel.update(
                            {
                              reminder: true,
                              reminderDate: reminderDate.format('YYYY-MM-DD HH:mm:ss')
                            },
                            {
                              where: { id: req.userData._id }
                            }
                          );
                  }                 
            }
            global.appLogger.info(`[End] Sended Photo Reminder Successfully\n`);
            return {message:"Reminded successfully!"} 
            
        }
        catch(err){
            global.appLogger.error(`[Error] Send Photo Reminder Api Call ${err.message} \n`);
            throw new Error(err.message)
        }   
    }

    async WelcomeUser(req){
        try{
                global.appLogger.info(`\n---- Starting Welcome User Api Call by User with Id ${req.userData._id} ----`);
                let user = await this._userModel.findOne({ 
                    where: { 
                        id: req.body.userID
                    } 
                });

                if (!user) {
                    return undefined;
                }   

                const [welcomeUser, created] = await this._welcomeUserModel.findOrCreate(
                    {
                        where: {
                            welcomed_user_id: req.body.userID,
                            user_id: req.userData._id
                        },
                        defaults: {
                            welcomed_user_id: req.body.userID,
                            user_id: req.userData._id
                        }
                    })

                    
                setTimeout(async () => {      
                    try{         
                        if(created) {                                       
                            let welcomeUserNotification = await this._notificationModel.create({
                                receiver_id: req.body.userID,
                                sender_id: req.userData._id,
                                notification_type: 'welcome_user'
                            });

                            if(welcomeUserNotification){
                                let query = `Select n."id", n."notification_type", n."createdAt", n."updatedAt", n."is_seen",
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
                                            END
                                        ),
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
                                    where n."id"='${welcomeUserNotification.dataValues.id}'`;
                                                                
                                await updateUserNotifications(query, req.body.userID);
                            }
                        }
                    }
                    catch(err){
                        console.log(err.message);
                    }                       
                },0);                            

            global.appLogger.info(`[End] User Welcomed Successfully\n`);
            return 'User Welcomed';
        }
        catch(err){
            global.appLogger.error(`[Error] Welcome User Api Call ${err.message} \n`);
            throw new Error(err.message);
        }
    }

    async AddNewsletterRecipient(req){
        try{
            global.appLogger.info(`\n---- Starting Add NewsLetter Recipient Api Call ----`);

            let user = await this._userModel.findOne(  { 
                attributes: ['id', 'member_id', 'isSubscribed'],
                where: { email: req.body.email} });
                
            const interests = await findOrCreateInterest('BPH Master: User Account Status', 'Newsletter Recipient'); 
            if(!interests){
                return { status: 'Error', message: 'Failed to retrieve interests' };
            }    

            if(user){
                if(user.dataValues.isSubscribed == true){
                    global.appLogger.info(`[End] Already Subscribed by Email ${req.body.email} \n`);
                    return {response:'Already Subscribed!'} 
                }
                else{
                    if(!user.dataValues.member_id){
                        return {status:'Error', message: 'InValid Member'};
                    }
                        
                    let currentInterests = await getMemberProfile(user.dataValues.member_id);
                    if(currentInterests){
                        currentInterests[interests.interestId] = true;
                        await updateMemberProfile(user.dataValues.member_id, {interests: currentInterests});
                        await this._userModel.update({ isSubscribed: true }, { where: { id: user.dataValues.id } })
                    }
                        
                    global.appLogger.info(`[End] User Subscribed Successfully by Existing Email ${req.body.email} \n`);
                    return {response:'Subscribed Successfully!'}  
                }
            }
            else{
                try{
                    const secretKey = await getSecrets();
                    if(secretKey){
                        const listId = secretKey.listId;
                        await mailchimp.lists.addListMember(listId, {
                            email_address: req.body.email,
                            status: 'subscribed',
                            email_type: 'html',
                            interests: {
                                [interests.interestId]: true, 
                            },
                            marketing_permissions:[{
                                marketing_permission_id: "c73a9abd30",
                                enabled: true
                            }]
                        });
                    }
                    global.appLogger.info(`[End] User Subscribed Successfully by Email ${req.body.email} \n`);
                    return {response:'Subscribed Successfully!'} 
                }
                catch(error){
                    global.appLogger.error(`[Error] Adding Member to List with NewsLetter Interest by Email ${req.body.email}  ${error.message}\n`);
                    return {response:'Already Subscribed!'}
                } 
            }
        }
        catch(err){
            global.appLogger.error(`[Error] Adding NewsLetter Recipient by Email ${req.body.email} ${err.message} \n`)
            throw err;
        }
    }


    async weeklyTopTenUsers(req){
        try{
            global.appLogger.info(`\n---- Start Weekly Top Ten Users Api Call by user with Id ${req.userData._id} ----`);

            let where = `(p."createdAt"::timestamp AT TIME ZONE 'America/New_York' >= date_trunc('week', current_date AT TIME ZONE 'America/New_York') 
            - interval '1 week' AND p."createdAt"::timestamp AT TIME ZONE 'America/New_York' <= date_trunc('week', current_date AT TIME ZONE 'America/New_York') - interval '1 microsecond')
            AND (v."createdAt" AT TIME ZONE 'America/New_York' >= date_trunc('week', current_date AT TIME ZONE 'America/New_York') 
            - interval '1 week' AND v."createdAt" AT TIME ZONE 'America/New_York' <= date_trunc('week', current_date AT TIME ZONE 'America/New_York') - interval '1 microsecond')`;
            
            let query=`SELECT p.id, p.user_id, u.name,
            CASE 
            WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
            ELSE u."photo_url"
            END AS user_photo_url, u."compressedProfileId"
            FROM "Photos" p JOIN "Votes" v ON p.id = v.photo_id
            JOIN "Users" u ON p.user_id = u.id
            WHERE  ${where} AND p."isDeleted" = false and v."is_vote"=true
            GROUP BY p.id, u.name, u.photo_url, u."compressedProfilePic", u."compressedProfileId"
            ORDER BY (Select count(*) from "Votes" v inner join "Photos" p1 on p1."id"= v."photo_id"
            where photo_id= p.id and ${where}) DESC, MAX(v."createdAt") DESC
            LIMIT 10`;

          const results = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT
          });

          global.appLogger.info(`[End] Successfully Fetched Weekly Top Ten Users \n`); 
          return results;
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Weekly Top Ten Users ${err.message} \n`); 
            return {status:'Error', message:'Something went wrong'}
        }
    }


    async ContactUs(req){
        try{
            const template={from_email:`${req.email}`, to_email:'support@example.com', subject:'A Question From The Site', body:`<p>${req.name}, ${req.email} <br><br> ${req.message}</p>`}
            const message =  await sendEmail(template);
            return message;
        }
        catch{
            return {status:'Error', message:'Something went wrong while sending email.'}
        }
    }



    async changePassword(userbody) {
        try{
            global.appLogger.info(`\n---- Start Change Password Api Call by user with email ${userbody.email} ----`);
            let user = await this._userModel.findOne({
                attributes: ['id', 'name', 'email', 'createdAt', 'updatedAt'],
                where: { email: userbody.email } 
            })

            if (!user) {
                return undefined;
            }
            else {
                    const hashpass = await hashpassword(userbody.password);
                    const token = await createToken(user);
                    await this._userModel.update({ password: hashpass }, { where: { id: user.id } });
                    global.appLogger.info(`[End] Password Changed Successfully! \n`); 
                    return [user, token];
            }
        }
        catch(err){
            global.appLogger.error(`[Error] Change Password Api ${err.message} \n`); 
            throw new Error(err.message);
        }
    }

    async updateSubscriptionReason(req){
        try{
            global.appLogger.info(`\n---- Start Update Subscription Reason Api Call by user with Id ${req.userData._id} ----`);
            await this._userModel.update({
                subscriptionReason: req.body.subscription_reason
            }, {
                where:{
                    id: req.userData._id
                }
            });

            global.appLogger.info(`[End] Subscription Reason Added Successfully \n`);
            return {message: 'Subscription Reason Added Successfully!'};

        }
        catch(err){
            global.appLogger.error(`[Error] Updating Subscription Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }

    async getTestimonials(){
        try{
            /*const query = `Select "id", "name",  string_to_array("genres_list", ',') AS "genres_list", 
            "compressedProfilePic", "compressedProfileId", "camera_brand", "state"
            from "Users" where "email" IN ('user1@example.com', 'user2@example.com',
             'user3@example.com', 'user4@example.com')`;

            const results = await sequelize.query(query, {   
                type: sequelize.QueryTypes.SELECT
            });*/

            global.appLogger.info(`\n---- Start Fetching Testimonials Api Call ----`);

            const testimonialUsers = [
            { id: "00000000-0000-0000-0000-000000000001", name: "Sample Member One", state: "City, ST, USA", profile_pic: "", camera_brand: "Brand", genres_list: "Portrait, Landscape", quote: "Sample testimonial text." },
            { id: "00000000-0000-0000-0000-000000000002", name: "Sample Member Two", state: "City, ST, USA", profile_pic: "", camera_brand: "Brand", genres_list: "Street, Travel", quote: "Sample testimonial text." },
            { id: "00000000-0000-0000-0000-000000000003", name: "Sample Member Three", state: "City, ST, USA", profile_pic: "", camera_brand: "Brand", genres_list: "Nature, Macro", quote: "Sample testimonial text." }
        ]

        shuffleData(testimonialUsers); 

        const testimonials = testimonialUsers.slice(0, 3);
        global.appLogger.info(`[End] Testimonials Fetched Successfully \n`);
        return testimonials;

           /* results.forEach((obj, index) => {
                if (index < textValues.length) {
                  obj.quote = textValues[index];
                }
            });
            return results;*/
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Testimonials Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }


    async getUserProfile(req){
        try{
               let userId = req.body.userID;
               if(req.body.profile){
                    let user = await UserModel.findOne({
                        where:{
                            profileCode: req.body.profile
                        },
                        attributes:['id']
                    });
                    if(!user){
                        return {status:'Error', message: `User Profile with id ${req.body.profile} does not exist`};
                    }

                    userId = user.dataValues.id;
               }
                global.appLogger.info(`\n---- Start Getting User Profile Api Call by user  ----`);
                const isPhotoSorted = await this._galleryPhotoModel.count({
                    where:{
                    user_id: userId,
                    isVisible: true
                    }
                });
        
                let photoSort = 'order by ("createdAt") ASC';
                if(isPhotoSorted){
                    photoSort = `order by ("isVisible"=true) DESC, ("updatedAt") DESC`
                }
                const query=`SELECT id, name, email, photo_url, about_me, "isPaid", total_hunt_scores,
                CASE WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
                ELSE photo_url
                END AS photo_url,
                "compressedProfileId",
                CASE WHEN LENGTH("compressedCoverPhoto") > 0 THEN "compressedCoverPhoto" 
                    ELSE "compressedCoverPhoto"
                    END AS "compressedCoverPhoto", 
                "compressedCoverPhotoId",
                photograper_type, camera_brand,
                photo_assistance, facebook_link, twitter_link, instagram_link, website, state,
                country, "createdAt", 
                (SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(genres_list, ',')) genre
                ) as genres_list,
                ( SELECT json_object_agg(strength, strength) FROM unnest(string_to_array(strengths, ',')) strength
                ) AS strengths,
                ( SELECT json_object_agg(meet_for, meet_for) FROM unnest(string_to_array(meet_for, ',')) meet_for
                ) AS meet_for,
                ${req.body?.userType === 'user' 
                    ? `(SELECT CASE 
                        WHEN EXISTS (
                            SELECT 1 FROM "Followers" f 
                            WHERE f.user_id = '${req.userData._id}' 
                                AND f.follower_id = :userId
                                AND f."is_active" = true
                            ) THEN TRUE 
                            ELSE FALSE 
                            END
                        ) AS is_follow`
                    : `false AS is_follow`
                },
                COALESCE(
                (SELECT 
                    json_build_object('count', (SELECT count(*)
                    FROM "Followers" f
                    JOIN "Users" u ON u.id = f.follower_id
                    WHERE f.user_id = :userId AND u."isBlocked" = false
                    and f."is_active"=true), 
                    'data', json_agg(json_build_object('photo_url', photo_url, 'name', name,
                    'compressedProfileId', "compressedProfileId")))
                FROM 
                    (
                        SELECT f.*,
                        CASE 
                        WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                        ELSE u."photo_url"
                        END AS "photo_url",
                        u.name, u."compressedProfileId"
                        FROM "Followers" f 
                        JOIN "Users" u ON u.id = f.follower_id
                        WHERE f.user_id =:userId AND u."isBlocked" = false
                        and f."is_active"=true
                        ORDER BY f."updatedAt" DESC
                        LIMIT 3
                    ) f
                GROUP BY 
                    f.user_id
                ORDER BY 
                    MAX(f."updatedAt") DESC
                ),
                json_build_object('count', 0, 'data', '[]'::json)
            ) AS "Following",
            COALESCE(
                (SELECT 
                    json_build_object('count', (SELECT count(*)
                    FROM "Followers" f
                    JOIN "Users" u ON u.id = f.user_id
                    WHERE f.follower_id = :userId
                    and f."is_active"=true
                    AND u."isBlocked" = false), 
                    'data', json_agg(json_build_object('photo_url', photo_url, 'name', name, 
                    'compressedProfileId', "compressedProfileId")))
                FROM 
                    (
                        SELECT f.*,
                        CASE 
                        WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                        ELSE u."photo_url"
                        END AS "photo_url",
                        u.name, u."compressedProfileId"
                        FROM "Followers" f
                        JOIN "Users" u ON u.id = f.user_id
                        WHERE f.follower_id = :userId AND u."isBlocked" = false 
                        and f."is_active"=true
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
                WHERE "user_id" = :userId
                ${photoSort}
                LIMIT 5
            ) gp
            )  
            FROM "Users" 
                    WHERE id = :userId and "isBlocked"=false`;

                const results = await sequelize.query(query, 
                {   type: sequelize.QueryTypes.SELECT,
                replacements: { userId: userId } 
                });

            if(results.length == 0){
                return {status:'Error', message: 'User Profile is Blocked'};
            }

            if(results && results[0]['compressedCoverPhoto'] == null){
                const randomInt = Math.floor(Math.random() * 6) + 1;
                results[0]['compressedCoverPhoto'] = `https://bph051023a.s3.amazonaws.com/cover_photos/cover_img${randomInt}.jpg`
            }

            global.appLogger.info(`[End] Successfully Fetched User Profile \n`);
            return results;
        }
        catch(err){
            global.appLogger.error(`[Error] Getting User Profile Api ${err.message}\n`);
            throw new Error(err.message);
        }
   }

   async getPaymentStatus(req){
        try{
            global.appLogger.info(`\n---- Start Getting payment Status Api Call by user with Id ${req.userData._id} ----`);
            
            const paymentStatus = await this._userModel.findOne({
                attributes: ['email', 'sessionId','subscriptionId', 'isPaid', 'payment_frequency', 'membershipPlan', 'trial_type', 'isWebsiteCompletelyCreated'],
                where: { id: req.userData._id } 
            });

            let templateName = null; let websiteUrl = null;
            const template = await this._personalWebsiteModel.findOne({
                where:{
                    user_id: req.userData._id 
                },
                attributes:['template_name', 'website_url']
            });

            const reportCount = await this._AiReportsModel.count({
                where:{
                    user_id: req.userData._id
                }
            });

            paymentStatus['dataValues']['isReportGenerated'] = reportCount > 0 ? true : false;

            

            if(template){
                templateName = template.template_name;
                websiteUrl = template.website_url;
            }


            if(paymentStatus && paymentStatus.dataValues.payment_frequency == 'first_time:true'){
                if(paymentStatus.dataValues.trial_type){
                    let trialType = {
                        '14-Day Trial': 'Checkout 14 Day Trial',
                        '2-Month Trial': 'Checkout 2 Month Trial',
                        '30-Day Trial': 'Checkout 30 Day Trial'
                    }
                    paymentStatus['dataValues']['membershipPlan'] = trialType[paymentStatus.dataValues.trial_type];
                    
                }
                else{
                    paymentStatus['dataValues']['membershipPlan'] = paymentStatus.dataValues.membershipPlan;
                }

                await this._userModel.update({
                    payment_frequency: 'first_time:false'
                }, 
                {
                    where:{
                        id: req.userData._id
                    }
                });
            }
            else{
                paymentStatus['dataValues']['membershipPlan'] = null;
            }

             paymentStatus['dataValues']['template_name'] = templateName;
             paymentStatus['dataValues']['website_url'] = websiteUrl;
             


            global.appLogger.info(`[End] Successfully Fetched Payment Status \n`);           
            return paymentStatus;
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Payment Status Api ${err.message}\n`);
            throw new Error(err.message);
        }
   }

   async generateInviteLink(req){
        try{
            global.appLogger.info(`\n ------- [Start] Generate Invite Link -----`);
            const invitee = await this._userModel.findOne({
                where:{
                    id: req.userData._id
                },
                attributes:['name']
            });


            let newReferralCode = invitee.dataValues.name.replace(/ /g, '_'); 
            newReferralCode = newReferralCode.replace(/[^a-zA-Z0-9\-_\.]/g, '')           
            await sequelize.transaction(async (t) => {
                let existingReferralCode = await this._invitationLinksModel.findAll({
                    where: {
                        referral_code: {
                            [Op.like]: `${newReferralCode}%`
                        }
                    },
                    order: [[sequelize.literal(`CASE 
                            WHEN "referral_code" ~ CONCAT('^', '${newReferralCode}', '[0-9]+$')  
                            THEN CAST(regexp_replace("referral_code", CONCAT('^', '${newReferralCode}'), '', 'g') AS INTEGER) 
                            ELSE 0 END`), 
                            'DESC']
                    ], 
                    attributes:['referral_code'],
                    limit: 1, 
                    lock: t.LOCK.UPDATE // Apply row-level locking
                });
            
                if (existingReferralCode.length) {
                    const lastCode = existingReferralCode[0].referral_code;
                    const suffix = parseInt(lastCode.replace(newReferralCode, ''), 10) || 0;
                    newReferralCode = `${newReferralCode}${suffix + 1}`;
                }

            
                await this._invitationLinksModel.create({
                    user_id: req.userData._id,
                    referral_code: newReferralCode,
                    link_expiry: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
                    }, { transaction: t }
                );
            });     

            let link = `${Env.Base_Url}?link=${newReferralCode}`;
            global.appLogger.info(`[End] Successfully Generated Link by User ${req.userData._id} \n`);
            return { link: link };
        }
        catch(err){
            global.appLogger.error(`[Error] Generate Invite Link Api ${err.message}\n`);
            return {message: `Something went wrong while generating invitation link`}
        }
   }

   async getAcceptedInvitationsList(req){
        try{
            global.appLogger.info(`\n ------- [Start] Get Accepted User Invitation List -----`);
            let query = `Select u.id, u.name, u."createdAt" as "join_date",
                CASE WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                ELSE u.photo_url END AS photo_url, u."compressedProfileId", 
                (Select count(*) as photo_posted from "Photos" where "user_id"= u."id" and "isDeleted" = false 
                and "isQueued"=false),
                (SELECT EXISTS( SELECT * FROM "Followers" f WHERE f."user_id" = '${req.userData._id}'
                and f.follower_id=u.id and f."is_active"=true)) AS is_follow
                from "Users" u
                where u."inviterId" = '${req.userData._id}'
                order by u."createdAt" DESC
                offset ${req.body.offset}
                limit 10`;

            const results = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT
            });
        
            global.appLogger.info(`[End] Successfully Fetched Accepted Invitation List By user ${req.userData._id} \n`); 
            return results;
        }
        catch(err){
            global.appLogger.error(`[Error] Get Accepted Invitation List Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }

    async getHuntScoreStatus(req){
        try{
            global.appLogger.info(`\n ---- Start Calling Get Hunt Score Status Api For User ${req.userData._id} \n`);
            const data = await this._huntScoreModel.findOne({
                where:{
                    user_id: req.userData._id
                },
                attributes: ['scores']
            });

            const userData = await this._userModel.findOne({
                where: {
                    id: req.userData._id
                },
                attributes: ['total_hunt_scores', 'hunt_score_ranking']
            });

            const huntScoreRanking = userData?.dataValues?.hunt_score_ranking ? parseInt(userData.dataValues.hunt_score_ranking.replace(/[^\d]/g, ''), 10) : null;

            let scores= {
                "upvote_photo": 0,
                "posted_photo": 0, 
                "leave_comment": 0,
                "queued_photo_post": 0,
                "weekly_top_ten": 0,
                "consecutive_photo_post": 0,
                "gallery_photo": 0,
                "invite_new_member": 0
            };
            
            if(data && data.scores){
                Object.keys(scores).forEach((key) => {
                    if (data.scores.hasOwnProperty(key)) {
                      scores[key] = data.scores[key]; 
                    }
                });
            }
                
            global.appLogger.info(`[End] Successfully Fetched Hunt Score Status For User ${req.userData._id} \n`);
            return {scores, total_hunt_scores: userData.dataValues.total_hunt_scores, hunt_score_ranking: huntScoreRanking}             
        }
        catch(err){
            global.appLogger.error(`[Error] Calling Hunt Score Status Api ${err.message} \n`);
            throw new Error(err.message);
        }

    }
}