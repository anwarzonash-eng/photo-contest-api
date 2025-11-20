import { response } from 'express';
import baseService from './base.service';
import { createToken} from '../utils/jwt';
import { hashpassword, encrypt, decrypt } from '../utils/genericFunctions'
import { Op } from 'sequelize';
import bcrypt from 'bcrypt'
import { sequelize } from '../utils/database';
import  {findOrCreateInterest, getAllInterestCategories, getInterestsInCategory, findCategoryIdByName} from "../utils/mailchimp/interest";
import  {addMemberToList } from "../utils/mailchimp/list";
import axios from 'axios';
import { Env } from '../config';
import {sendEmail} from "../utils/mailchimp/send_email";
import {getMemberProfile, updateMemberProfile } from '../utils/mailchimp/profile';
import {getSecrets} from '../utils/secret-manager';
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
                            //var accountId= await findCategoryIdByName(InterestCategories, "Account Created");
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

                            //interests[accountId] = false;    
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

    async checkUserExistenceByEmail(userEmail, referral_code, userType){
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
