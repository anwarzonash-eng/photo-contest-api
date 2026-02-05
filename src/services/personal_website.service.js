import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
const uploadPhoto =require("../utils/aws/s3");
import {photoOptimization, deleteCloudinaryFolder } from "../utils/cloudinary/photo_optimization";
import {v2 as cloudinary} from 'cloudinary';
import { Env } from '../config';
import { Op, literal } from 'sequelize';
import {sendEmail} from "../utils/mailchimp/send_email";
import NotFoundException from '../exceptions/notFound.exception';
import { transactionCommit, transactionRollback } from '../utils/transaction';
import { checkWebsitePublished, deleteInActiveUserPhotos } from '../utils/genericFunctions';
const schedule = require('node-schedule');
const scheduledJobs = new Map();
import { manageTags } from "../utils/mailchimp/tags";
import { getSecrets } from "../utils/secret-manager.js";
const { personalWebsite60MinTagQueue } = require('../utils/jobQueue');



cloudinary.config({ 
  cloud_name:Env.cloudName,
  api_key:Env.cloudinaryApiKey,
  api_secret:Env.cloudinarySecretKey,
  secure: true  
});



export class personalWebsiteService extends baseService {
    async addTemplate(req) {
        const t = await sequelize.transaction();
       try
        {


            let userId = req.userData._id;
            let photoIds = []; 
            let personalPhoto;
            if(req.body.type == 'template_selection'){
                    const isTemplateExist = await this._personalWebsiteModel.findOne({
                        where: {
                            user_id: userId
                        },
                        transaction: t
                    });

                    if(isTemplateExist){
                        await this._personalWebsiteModel.update({
                            template_name: req.body.template_name       
                        }, {
                            where:{
                                user_id: userId
                            }, 
                            transaction: t 
                        });
                    }
                    else{
                        await this._personalWebsiteModel.create({
                            user_id: userId,
                            template_name: req.body.template_name
                        },
                        { transaction: t });
                    }
            }


            if(req.body.type == 'website_purpose'){
                let updateData = {};


                console.log("photo type", req.body.photoType);
                let eventId = req.body.eventId;
                let photoType = req.body?.['photoType'];
                let personalWebsite = await this._personalWebsiteModel.findOne({
                    where: { 
                        user_id: req.userData._id 
                    },
                    attributes: ['id','user_name', 'uploaded_photos', 'selected_photos', 'cover_photo', 'website_url'],
                    transaction: t
                });


                if (!personalWebsite) {
                    await transactionRollback(t);
                   return { status: 'Error', message: 'Personal Website Template Not Found' };
                }

                updateData.template_name = req.body?.template_name || personalWebsite.template_name ;
                updateData.website_purpose = req.body?.website_purpose;
                updateData.subHeadline = `Explore my photos and see the world through my camera's eye.`;
                updateData.user_name = req.body?.user_name || null;

                let userData = await this._userModel.findOne({
                    where: { id: userId },
                    attributes: ['genres_list', 'photo_url', 'compressedProfilePic', 'compressedProfileId', 
                        'facebook_link', 'instagram_link', 'twitter_link', 'about_me', 'member_id']
                });


                updateData.profile_pic = userData?.['dataValues']?.['photo_url'];
                updateData.compressedProfilePic = userData?.['dataValues']?.['compressedProfilePic'];
                updateData.compressedProfileId = userData?.['dataValues']?.['compressedProfileId'];
                updateData.facebook_link = userData?.['dataValues']?.['facebook_link'];
                updateData.instagram_link = userData?.['dataValues']?.['instagram_link'];
                updateData.twitter_link = userData?.['dataValues']?.['twitter_link'];
                updateData.user_bio = userData?.['dataValues']?.['about_me'];
                

                let genres_list = userData?.dataValues?.genres_list;

                let firstGenre = ``;
                if (genres_list && genres_list.trim() !== "") {
                    firstGenre = genres_list.split(",")[0].trim() + " photographer capturing unscripted moments.";
                }
                    
                let nameParts = updateData.user_name.trim().split(/\s+/);
                let firstName = nameParts[0] || "";
                let lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";

               // let headlineParts = [firstName, lastName, firstGenre].filter(Boolean);
               // updateData.headline = headlineParts.join(" , ");

                updateData.headline = [
                        [firstName, lastName].filter(Boolean).join(" "), firstGenre
                    ].filter(Boolean).join(", ");

                let selectedPhotos = req.body?.selected_photos || []; 
                
                let cover_photo;
                let coverPhotoQuery = `SELECT p.id,
                        p.photo_url,
                        p."createdAt",
                        p."compressedImageUrl", 
                        p."compressedImageId",
                        COUNT(v.user_id) AS total_votes
                    FROM "Photos" p
                    LEFT JOIN "Votes" v ON v.photo_id = p.id
                    WHERE p.user_id = '${userId}'
                    and p."isDeleted"=false
                    and v."is_vote"=true
                    GROUP BY p.id, p.user_id, p.photo_url
                    ORDER BY total_votes DESC
                    LIMIT 1`;

                let coverPhotoData = await sequelize.query(coverPhotoQuery, {
                    type: sequelize.QueryTypes.SELECT
                });

                if(coverPhotoData.length > 0){
                    cover_photo = {
                        id: coverPhotoData[0]?.['id'],
                        source: "most_upvoted",
                        createdAt: coverPhotoData[0]?.['createdAt'],
                        photo_url: coverPhotoData[0]?.['photo_url'],
                        compressedImageUrl: coverPhotoData[0]?.['compressedImageUrl'],
                        compressedImageId: coverPhotoData[0]?.['compressedImageId']   
                    }
                }

                for(const photo of selectedPhotos){
                    let personalPhoto = await this._personalPhotoModel.create({
                        user_id: userId,
                        photo_id: photo['id'],
                        photo_url: photo['photo_url'],
                        compressedImageUrl: photo['compressedImageUrl'],
                        compressedImageId: photo['compressedImageId'],
                        source: photo['source'], 
                        isUploaded: false,
                        eventId
                    },
                    {
                        transaction: t 
                    });

                    photoIds.push(personalPhoto['id']);
                      
                    if (!cover_photo) {
                        cover_photo = {
                            id: personalPhoto['id'],
                            source: "selected",
                            createdAt: personalPhoto['createdAt'],
                            photo_url: photo['photo_url'],
                            compressedImageUrl: photo['compressedImageUrl'],
                            compressedImageId: photo['compressedImageId']   
                        }
                    }
                }

                updateData.selected_photos = photoIds;
                updateData.cover_photo = cover_photo;
                
                if(cover_photo){
                    await this._personalPhotoModel.update({
                        is_cover_photo: true
                    }, {
                        where:{
                            [Op.or]: [
                                { photo_id: cover_photo.id },
                                { id: cover_photo.id }
                            ]
                        },
                        transaction: t
                    });
                }

                let websiteUrl = '';
                const parts = req.body?.user_name.trim().split(/\s+/);
                let personalSiteDomain = req.body?.domain || '.photocontest';

                if(personalSiteDomain == 'eldevbph1' || personalSiteDomain == 'elstagebph1'){
                    personalSiteDomain = personalSiteDomain + ".photocontest";
                }

                if (!personalWebsite?.website_url) {
                    if (parts.length === 1) {
                        const single = parts[0];
                        websiteUrl = single.charAt(0).toLowerCase() + single.slice(1).toLowerCase();
                    }
                    else {
                        const firstInitial = parts[0].charAt(0).toLowerCase();

                        // Format remaining words: Capitalize first letter + rest lowercase
                        const remaining = parts.slice(1).map(
                            word => word.charAt(0).toLowerCase() + word.slice(1).toLowerCase()
                        ).join("");

                        websiteUrl = firstInitial + remaining;
                    }

                    let existingWebsiteUrl = await this._personalWebsiteModel.findAll({
                        where: {
                                website_url: {
                                    [Op.like]: `${websiteUrl}%`
                                }
                        },
                       order: [
                        [literal(`
                            CASE 
                            WHEN regexp_replace(
                                "website_url",
                                CASE 
                                WHEN '${personalSiteDomain}' LIKE '%localhost%' 
                                    THEN E'\\\\.' || regexp_replace('${personalSiteDomain}', E'([\\-\\/^$*+?.()|[\\]{}:])', E'\\\\\\1', 'g') || E'$'
                                ELSE E'\\\\.' || regexp_replace('${personalSiteDomain}', E'([\\-\\/^$*+?.()|[\\]{}:])', E'\\\\\\1', 'g') || E'\\.com$'
                                END,
                                ''
                            ) ~ ('^' || '${websiteUrl}' || '[0-9]+$')
                            THEN CAST(
                                regexp_replace(
                                regexp_replace(
                                    "website_url",
                                    CASE 
                                    WHEN '${personalSiteDomain}' LIKE '%localhost%' 
                                        THEN E'\\\\.' || regexp_replace('${personalSiteDomain}', E'([\\-\\/^$*+?.()|[\\]{}:])', E'\\\\\\1', 'g') || E'$'
                                    ELSE E'\\\\.' || regexp_replace('${personalSiteDomain}', E'([\\-\\/^$*+?.()|[\\]{}:])', E'\\\\\\1', 'g') || E'\\.com$'
                                    END,
                                    ''
                                ),
                                '^' || '${websiteUrl}',
                                '',
                                'g'
                                ) AS INTEGER
                            )
                            ELSE 0
                            END
                        `), 'DESC']
                        ],

                        attributes:['website_url'],
                        limit: 1, 
                        lock: t.LOCK.UPDATE, // Apply row-level locking
                        transaction: t 
                    });
                    
                    if (existingWebsiteUrl.length) {
                       
                        let lastCode = existingWebsiteUrl[0].website_url;

                        // Remove domain properly depending on environment
                        if (personalSiteDomain.includes('localhost')) {
                            lastCode = lastCode.replace(`.${personalSiteDomain}`, ""); 
                        } 
                        else {
                            lastCode = lastCode.replace(`${personalSiteDomain}.com`, ""); 
                        }

                        const suffix = parseInt(lastCode.replace(websiteUrl, ''), 10) || 0;
                        websiteUrl = `${websiteUrl}${suffix + 1}`;
                    }
                    

                    personalWebsite.website_url = `${websiteUrl}.${personalSiteDomain}${personalSiteDomain.includes('localhost') ? '' : '.com'}`;
                    personalWebsite.changed('website_url', true);
                    await personalWebsite.save();
                }


                if(req.files && req.files?.photoUrl){             
                    const photosData = await uploadPhoto.uploadTempPhotos(req.files.photoUrl, eventId);              
                    let imageFilePath = req.files.photoUrl['tempFilePath'];
                    const optimizedData = await photoOptimization(imageFilePath, {folder:`${eventId}`, quality:"auto:good"});

                    personalPhoto = await this._personalPhotoModel.create({
                        user_id: userId,
                        photo_url: photosData,
                        compressedImageUrl: optimizedData.compressedImageUrl,
                        compressedImageId: optimizedData.compressedImageId,
                        source: 'uploaded', 
                        isUploaded: true,
                        eventId: eventId
                    },
                    { 
                        transaction: t 
                    });


                     await this._personalWebsiteModel.update(
                     {
                            
                        uploaded_photos: literal(`
                            COALESCE(uploaded_photos, '[]'::jsonb) || jsonb_build_array('${personalPhoto.id}')
                        `),
                        cover_photo: literal(`
                            CASE 
                                WHEN cover_photo IS NULL OR cover_photo = '[]'::jsonb
                                THEN jsonb_build_object(
                                    'id', '${personalPhoto.id}',
                                    'source', 'uploaded',
                                    'createdAt', '${personalPhoto.createdAt}',
                                    'photo_url', '${photosData}',
                                    'compressedImageUrl', '${optimizedData.compressedImageUrl}',
                                    'compressedImageId', '${optimizedData.compressedImageId}'
                                )
                                ELSE cover_photo
                            END
                        `)
                        },
                        { 
                            where: { 
                                user_id: userId 
                            },
                            transaction: t     
                    });
     
                    
                    await this._personalPhotoModel.update(
                        { is_cover_photo: true },
                        { 
                            where: { 
                                id: personalPhoto.id,
                                user_id: userId,
                                [Op.not]: [
                                    literal(`EXISTS (
                                    SELECT 1 FROM "personal_photos"
                                        WHERE user_id = '${userId}' AND is_cover_photo = true
                                    )`)
                                ]   
                            }, 
                            transaction: t 
                     });
                }
            
                
                await this._personalWebsiteModel.update(
                    updateData
                , {
                    where:{
                        user_id: userId
                    },
                    transaction: t
                });

                await this._userModel.update({
                    isWebsiteCompletelyCreated: true
                }, {
                    where:{
                        id: userId
                    },
                    transaction: t 
                });

                let memberId = userData['member_id'];
                const secretKey = await getSecrets();
                if(memberId && secretKey?.listId){
                    await manageTags(memberId, secretKey.listId, 'User_Has_Activated_Personal_Site', 'active');


                    // Schedule Personal_Website_60min_Ready Tag after 56 minutes
                    await personalWebsite60MinTagQueue.add(
                        {
                            memberId: memberId,
                            mailchimplistId: secretKey.listId
                        },
                        {
                            delay: 56 * 60 * 1000, 
                            attempts: 3,
                            backoff: 5000,
                            removeOnComplete: true,
                            removeOnFail: false,
                        }
                    );
                }


                // Schedule to remove photos after 10 minutes
                if (eventId && !scheduledJobs.has(eventId)) {
                    const job = schedule.scheduleJob(new Date(Date.now() + 10 * 60 * 1000), async () => {
                        try {   
                            if(photoType){
                                await deleteInActiveUserPhotos(eventId, photoType);
                            }
                        } 
                        catch (err) {
                            global.appLogger.error(`[Error] Scheduled job for event ${eventId} failed: ${err.message}`);
                                
                        } 
                        finally {                                  
                            // Remove from map after execution
                            scheduledJobs.delete(eventId);
                        }
                    });

                    scheduledJobs.set(eventId, job);
                }                                        
            }

            

            await transactionCommit(t);

            let data = await this._personalWebsiteModel.findOne({
                where: {
                    user_id: userId
                }
            });


             if (req.body.photoType && req.body.photoType == 'uploaded_photos' && personalPhoto) {
                data = { ...data.toJSON(), uploadedPhotoId: personalPhoto.id };
            }

            return { data, photos: photoIds };
           

        }
        catch(err){
            await transactionRollback(t);
            throw new Error(err.message);
        }
    }

        
    async listPhotos(req) {
        try {
            let userId = req.userData._id;
            const userPayment = await this._userModel.findOne({
                where: { id: userId },
                attributes: ['isPaid']
            });
            const isPaid = userPayment.dataValues.isPaid;

            const limit = parseInt(req.body.limit, 10) || 6;   
            const offset = parseInt(req.body.offSet, 10) || 0; 

       
            const totalHunted = await this._photoModel.count({
                where: { 
                    user_id: userId, 
                    isQueued: false, 
                    isDeleted: false 
                }
            });

      
            let photoDisplayFilter = '';
            if (isPaid === false) {
                photoDisplayFilter = ` AND p."photo_display_status" != 'expired'`;
            }

       
            const galleryCountQuery = `SELECT COUNT(*)::int AS cnt
                FROM "gallery_photos" p
                WHERE p."user_id" = '${userId}' ${photoDisplayFilter}`;

            const galleryCountRes = await sequelize.query(galleryCountQuery, 
            { 
                type: sequelize.QueryTypes.SELECT 
            });
        
            const totalGalleryAvailable = parseInt(galleryCountRes[0].cnt, 10);
            const MAX_FREE_GALLERY = 5;
            const totalGalleryAllowed = (isPaid === false) ? Math.min(totalGalleryAvailable, MAX_FREE_GALLERY) : totalGalleryAvailable;

            let huntedLimit = 0;
            let huntedOffset = 0;
            if (offset < totalHunted) {
                huntedOffset = offset;
                huntedLimit = Math.min(limit, totalHunted - offset);
            }

            const remainingHuntedSlots = limit - huntedLimit;
            let galleryOffset = Math.max(0, offset - totalHunted); 
            if (galleryOffset >= totalGalleryAllowed) {
                galleryOffset = totalGalleryAllowed; 
            }

            let galleryLimit = Math.max(0, Math.min(remainingHuntedSlots, totalGalleryAllowed - galleryOffset));

            let huntedPhotos = [];
            //if (huntedLimit > 0) {       
                const huntedPhotosQuery = `SELECT p.id, p.photo_url, 
                        p."compressedImageUrl", p."compressedImageId",
                        COUNT(v.id) FILTER (WHERE v.is_vote = true) AS upvotes,
                        p."createdAt"::timestamptz,'hunted' AS "source"
                    FROM "Photos" p
                    LEFT JOIN "Votes" v ON v.photo_id = p.id
                    WHERE p.user_id = '${userId}' AND p."isQueued" = false AND p."isDeleted" = false
                    GROUP BY p.id
                    ORDER BY upvotes DESC,
                    p."createdAt" DESC`;
                //    LIMIT ${huntedLimit} 
                //    OFFSET ${huntedOffset}`;
            
                huntedPhotos = await sequelize.query(huntedPhotosQuery,
                { 
                    type: sequelize.QueryTypes.SELECT 
                });
            //}


            let galleryPhotos = [];
           // if (galleryLimit > 0) {
                const isPhotoSorted = await this._galleryPhotoModel.count({
                    where: { user_id: userId, isVisible: true }
                });

                const galleryPhotosQuery = `SELECT gp.id, gp.photo_url, gp."compressedImageUrl", 
                    gp."compressedImageId", COALESCE(t.heartedcount, 0) as "upvotes", gp."createdAt", 
                    'gallery' AS "source"
                    FROM gallery_photos gp
                    LEFT JOIN (
                        SELECT lgp.gallery_photo_id, COUNT(*) AS heartedcount
                        FROM like_gallery_photos lgp
                        where lgp."isHearted"=true
                        GROUP BY lgp.gallery_photo_id
                    ) t ON t.gallery_photo_id = gp.id
                    where gp.user_id = '${userId}'
                    ${ isPaid == false 
                        ? `and gp.id IN (
                            SELECT p.id
                            FROM "gallery_photos" p
                            INNER JOIN "Users" u ON u."id" = p."user_id"
                            WHERE p."user_id" = '${userId}' ${photoDisplayFilter}
                            ${isPhotoSorted 
                                ? `ORDER BY (p."isVisible" = true) DESC, p."updatedAt" DESC, p."id" ASC` 
                                : 'ORDER BY p."createdAt" ASC'
                            }
                            LIMIT 5)`
                        : ``
                    }             
                    and gp."isHunted" = false
                    ORDER BY t.heartedcount DESC NULLS LAST, 
                    gp."createdAt" DESC`;
                    //LIMIT ${galleryLimit} 
                    //OFFSET ${galleryOffset}`;


                galleryPhotos = await sequelize.query(galleryPhotosQuery, 
                { 
                    type: sequelize.QueryTypes.SELECT
                });
            //}

            const photos = [...huntedPhotos, ...galleryPhotos];
            return {photos};

        } catch (err) {
            throw new Error(err.message);
        }
    }



    async updatePersonalSite(req){
        try{
                global.appLogger.info(`\n---- Start Updating Personal Website Api Call by user with Id ${req.userData._id} ----`);
                const personalWebsite = await this._personalWebsiteModel.findOne({
                    where: { 
                        user_id: req.userData._id 
                    },
                    attributes: ['id']
                });

                if (!personalWebsite) {
                   return { status: 'Error', message: 'Personal Website Not Found' };
                }
                 
                const updatedPersonalSite = await this._personalWebsiteModel.update({
                   user_name: req.body?.user_name || personalWebsite?.user_name,
                   user_bio: req.body?.user_bio ?? personalWebsite?.user_bio,
                   facebook_link: req.body?.facebook_link || personalWebsite?.facebook_link,
                   twitter_link: req.body?.twitter_link || personalWebsite?.twitter_link,
                   instagram_link: req.body?.instagram_link || personalWebsite?.instagram_link,
                   tiktok: req.body?.tiktok || personalWebsite?.tiktok,
                   linkedIn: req.body?.linkedIn || personalWebsite?.linkedIn,
                }, {
                    where:{
                        user_id: req.userData._id 
                    },
                    returning: true
                });


                global.appLogger.info(`[End] Successfully Updated Personal Website \n`);  
                
                return {personal_site: updatedPersonalSite?.[1][0]?.get()} 

        }
        catch(error){       
            global.appLogger.error(`[Error] Updating Personal Website Api Call ${error.message}\n`);  
            return { status: 'Error', message: 'Something went wrong while updating personal website' };
        }
    }


    async updatePersonalWebsite(req){
        try{
            let userId = req.userData._id;

            global.appLogger.info(`\n---- Start Updating Personal Site Api Call by user with Id ${userId} ----`);
            const personalWebsite = await this._personalWebsiteModel.findOne({
                where: { 
                    user_id: userId
                },
                attributes: ['id']
            });

            if (!personalWebsite) {
                return { status: 'Error', message: 'Personal Website Not Found' };
            }

            let data = req.body;

            const updateFields = {};
            if (data.facebook_link) updateFields.facebook_link = data.facebook_link;
            if (data.instagram_link) updateFields.instagram_link = data.instagram_link;
            if (data.twitter_link) updateFields.twitter_link = data.twitter_link;

            if (Object.keys(updateFields).length > 0) {
                await this._userModel.update(updateFields, {
                    where: { id: userId }
                });
            }


            let response = {};
           

            if(req.files && req.files?.profile_pic){                 
                const photosData = await uploadPhoto.uploadPhoto(req.files.profile_pic);              
                let imageFilePath = req.files.profile_pic['tempFilePath'];
                const optimizedData = await photoOptimization(imageFilePath, {folder:'Resized_Photos', quality:"auto:good"}); 
                data['profile_pic'] = photosData;
                data['compressedProfilePic'] = optimizedData?.['compressedImageUrl'];
                data['compressedProfileId'] = optimizedData?.['compressedImageId']

                response = {
                    compressedProfilePic: data['compressedProfilePic'],
                    compressedProfileId: data['compressedProfileId']
                }
            }

            await this._personalWebsiteModel.update( data, {
                where:{
                    user_id: userId
                },
            });

        
            return {
                personalWebsite: response
            }
        }
        catch(err){
            global.appLogger.error(`[Error] Updating Personal Site Api Call ${err.message}\n`);  
            return { status: 'Error', message: 'Something went wrong while updating personal website' };
        }
    }
    async fetchPersonalWebsite(req){
        try{
            let personalWebsite;
           
            let userId;
            let domain = req.body?.domain;
            let is_follow_btn = true;
            if(domain){
                personalWebsite =  await this._personalWebsiteModel.findOne({
                    where: { 
                        website_url: domain
                    }
                }); 

                if(personalWebsite == null){
                    throw new NotFoundException("Personal Website");
                }
                userId = personalWebsite.user_id;
                
                if(req?.userData?._id && userId && req?.userData?._id == userId){
                    is_follow_btn = false;
                }
            }
            else{
                userId = req.userData._id; 
            }
              
            

            global.appLogger.info(`\n---- Start Fetching Personal Website Api Call by user with Id ${userId} ----`);

           

            const user = await this._userModel.findOne({        
                where:{
                    id: userId
                },
                attributes:['email', 'website', 'genres_list', 'isWebsiteCompletelyCreated']
            });

            personalWebsite = await this._personalWebsiteModel.findOne({
                where: { 
                    user_id: userId
                }
            }); 

            const isWebsiteCompletelyPublished = await checkWebsitePublished(personalWebsite?.createdAt);
            if(domain && user?.isWebsiteCompletelyCreated == true && ! isWebsiteCompletelyPublished.published){
          
                if (isWebsiteCompletelyPublished.minutesLeft > 0) {
                    return { status: 'Error', remainingTime: `${isWebsiteCompletelyPublished.minutesLeft}m ${isWebsiteCompletelyPublished.secondsLeft}s.`,  message: `Website will be published after ${isWebsiteCompletelyPublished.minutesLeft}m ${isWebsiteCompletelyPublished.secondsLeft}s.`, statusCode: 400}          
                } 
                else {
                    return {status: 'Error', remainingTime: `${isWebsiteCompletelyPublished.secondsLeft}s`, message: `Website will be published after ${isWebsiteCompletelyPublished.secondsLeft}s.`, statusCode: 400};
                }
            }

            let data = {}; let is_follow = false;
            if (personalWebsite) {
                if(req.body.userType != 'all'){
                    const isFollow = await this._personalPageFollowRelationModel.findOne({
                        where: {
                            user_id: req.userData._id,
                            follower_id: userId,
                            is_follow: true
                        },
                        attributes: ['id'], 
                    });

                    is_follow = !!isFollow;
                }



                    
                // Get arrays of IDs (handle null/empty cases safely)
                const selectedPhotoIds = personalWebsite.selected_photos || [];
                const uploadedPhotoIds = personalWebsite.uploaded_photos || [];

                // Merge all IDs into one unique set
                const allPhotoIds = [...new Set([...selectedPhotoIds, ...uploadedPhotoIds])];

                let photosMap = {};
                if (allPhotoIds.length > 0) {
                    const photos = await this._personalPhotoModel.findAll({
                        where: { id: allPhotoIds },
                        attributes: ['id', 'photo_url', 'compressedImageUrl']
                    });

                    // Create a map for quick lookup
                    if(photos){
                        photosMap = photos.reduce((acc, photo) => {
                            acc[photo.id] = {
                                photo_url: photo.photo_url,
                                compressedImageUrl: photo.compressedImageUrl,
                                compressedImageId: photo.compressedImageId
                            };
                            return acc;
                        }, {});
                    }
                }

                data = {
                    ...personalWebsite.dataValues,
                    user_photo_url: personalWebsite.compressedProfilePic,
                    compressedImageId: personalWebsite.compressedProfileId,
                    user_bio: personalWebsite.user_bio,
                    facebook_link: personalWebsite.facebook_link,
                    instagram_link: personalWebsite.instagram_link,
                    twitter_link: personalWebsite.twitter_link,
                    genres_list: user?.genres_list,
                    email: user.email,
                    website_url: personalWebsite.website_url || null,
                    selected_photos: selectedPhotoIds.map(id => (
                        {
                            id,
                            photo_url: photosMap[id]?.photo_url || null,
                            compressedImageUrl: photosMap[id]?.compressedImageUrl || null
                        })
                    ),
                    uploaded_photos: uploadedPhotoIds.map(id => (
                        {
                            id,
                            photo_url: photosMap[id]?.photo_url || null,
                            compressedImageUrl: photosMap[id]?.compressedImageUrl || null
                        })
                    ),
                    is_follow,
                    is_follow_btn
                };
            }

            
            return data;
        }
        catch(error){
            let message = 'Something went wrong while fetching Personal Website';
            let statusCode = 400;
            if(error.status =='404'){
                message = error.message;
                statusCode = 404;
            }
            global.appLogger.error(`[Error] Fetching Personal Website Api Call ${error.message}\n`);  
            return { status: 'Error', message, statusCode };
        }
    }


    async fetchPersonalPhotos(req){
        try{
               let personalWebsite = await this._personalWebsiteModel.findOne({
                    where:{
                        website_url: req.body.domain
                    },
                    attributes:['user_id']
                });

                if(personalWebsite == null){
                    throw new NotFoundException("Personal Website");
                }

                let userId = req.userData?._id || null;
                let photoUserId = personalWebsite?.['dataValues']?.['user_id'];

                global.appLogger.info(`\n---- Start Fetching Personal Photos Api Call by user with Id ${userId} ----`);

                let query = `SELECT _photos.id, _photos.user_id, _photos."photo_url" AS "original_photo_url", 
                        _photos."compressedImageId", _photos."compressedImageUrl" AS "photo_url", 
                        _photos."createdAt" AS photo_posted_date, _photos.source, _photos."isUploaded",
                        _photos."is_cover_photo",
                        COALESCE(personal_votes.total_personal_photo_votes, 0) AS total_personal_photo_votes,
                        COALESCE(gallery_votes.total_gallery_votes, 0) AS total_gallery_votes,
                        (   COALESCE(personal_votes.total_personal_photo_votes, 0) +
                            COALESCE(gallery_votes.total_gallery_votes, 0)
                        ) AS total_votes,
                          CASE 
                            WHEN :userId IS NOT NULL THEN
                                EXISTS (
                                    SELECT 1 
                                    FROM "personal_photo_upvotes" v 
                                    WHERE v.photo_id = _photos.id 
                                    AND v.user_id = :userId 
                                    AND v."is_vote" = true
                                )
                            ELSE false
                        END AS is_vote
                    FROM "personal_photos" AS _photos
                    LEFT JOIN LATERAL (
                        SELECT COUNT(*) AS total_personal_photo_votes
                        FROM "personal_photo_upvotes" AS _votes
                        JOIN "Users" u ON u.id = _votes.user_id
                        WHERE _votes.photo_id = _photos.id
                        AND u."isBlocked" = false
                        AND _votes."is_vote" = true
                    ) personal_votes ON TRUE

                    LEFT JOIN LATERAL (
                        SELECT COUNT(*) AS total_gallery_votes
                        FROM "like_gallery_photos" AS _photo_upvotes
                        WHERE _photo_upvotes.gallery_photo_id = (
                            SELECT gp.id
                            FROM "gallery_photos" gp
                            WHERE gp."photo_url" = _photos."photo_url"
                            LIMIT 1
                        )
                        AND _photo_upvotes."isHearted" = true
                    ) gallery_votes ON TRUE

                    WHERE _photos."isDeleted" = false
                    AND _photos.user_id = '${photoUserId}'
                    ORDER BY 
                        CASE 
                            WHEN _photos.sort_order IS NOT NULL THEN 0 
                            ELSE 1 
                        END,
                        _photos.sort_order ASC,
                        _photos."createdAt" ASC,
                        _photos.id ASC
                    LIMIT 10
                    OFFSET :offSet`;
                
                    //LEAST(25 - :offSet, 10)
                const photoCount = await this._personalPhotoModel.count({
                    where:{
                        user_id: photoUserId
                    }
                });

                const photos = await sequelize.query(query, {
                    type: sequelize.QueryTypes.SELECT,
                    replacements: { userId, offSet:req.body.offSet}
                });

                return {photos, recordsCount: photoCount};
        }
        catch(error){
            let message = 'Something went wrong while fetching Personal Photos';
             let statusCode = 400;
            if(error.status =='404'){
                message = error.message;
                statusCode = 404;
            }
            global.appLogger.error(`[Error] Fetching Personal Photos Api Call ${error.message}\n`);  
            return { status: 'Error', message, statusCode };
        }
    }


    async CreatePersonalGallery(req){
        try{

            let userId = req.userData?._id
            global.appLogger.info(`\n---- Start Creating Personal Gallery Api Call by user with Id ${userId} ----`);

            const newGallery =await this._personalGalleriesModel.create({
                user_id: userId,
                name: req.body.galleryName,
            }); 
            
            global.appLogger.info(`\n---- End Creating Personal Gallery Api Call by user with Id ${userId} ----`);
                
            return { gallery: newGallery};

           

        }
        catch(err){
            global.appLogger.error(`[Error] Creating Personal Gallery Api Call ${err.message}\n`);  
            return { status: 'Error', message: 'Something went wrong while creating personal gallery.' };
        }
    }


    
    async ListPersonalGallery(req){
        try{

                let userId = req.userData?._id
                global.appLogger.info(`\n---- Fetch Personal Gallery Api Call by user with Id ${userId} ----`);

                const gallery = await this._personalGalleriesModel.findAll({
                    where:{
                        user_id: userId,
                        isDeleted: false
                    },
                    order:[['createdAt', 'DESC']],
                    attributes:['id', 'name']
                }); 
                
                global.appLogger.info(`\n---- End Fetching Personal Gallery Api Call by user with Id ${userId} ----`);
                    
                return { gallery };

        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Personal Gallery Api Call ${err.message}\n`);  
            return { status: 'Error', message: 'Something went wrong while fetching personal gallery.' };
        }
    }

       async uploadPhotos(req){
        try {    
                let userId = req.userData._id;  
                
                global.appLogger.info(`\n---- Start Uploading Personal Website Photo Api Call by user with Id ${userId} ----`);
                
                const personalWebsite = await this._personalWebsiteModel.findOne({
                    where: { 
                        user_id: userId
                    },
                    attributes: ['id', 'uploaded_photos']
                });

                if (!personalWebsite){
                    return { status: 'Error', message: 'Personal Website Not Found' };
                }  
                
                if(req.files && req.files?.photoUrl){                 
                    const photosData = await uploadPhoto.uploadTempPhotos(req.files.photoUrl, req.body.eventId);              
                    let imageFilePath = req.files.photoUrl['tempFilePath'];
                    const optimizedData = await photoOptimization(imageFilePath, {folder:`${req.body.eventId}`, quality:"auto:good"});

                    const personalPhoto = await this._personalPhotoModel.create({
                        eventId: req.body.eventId,
                        user_id: userId,
                        photo_url: photosData,
                        compressedImageUrl: optimizedData.compressedImageUrl,
                        compressedImageId: optimizedData.compressedImageId,
                        source: 'uploaded', 
                        isUploaded: true,
                    });
                    
            
                    await this._personalWebsiteModel.update({
                        uploaded_photos: literal(`"uploaded_photos" || '${JSON.stringify([personalPhoto.id])}'::jsonb`)
                    }, 
                    {
                        where: {
                            user_id: userId
                        }
                    });
    
                    global.appLogger.info(`[End] Successfully Uploaded Personal Website Photos\n`);  


                    let eventId = req.body.eventId;
                    
                    // Schedule to remove photos after 10 minutes
                    if (!scheduledJobs.has(eventId)) {
                        const job = schedule.scheduleJob(new Date(Date.now() + 10 * 60 * 1000), async () => {
                            try {                                                 
                                await deleteInActiveUserPhotos(eventId, 'uploaded_photos');
                            } 
                            catch (err) {
                                global.appLogger.error(`[Error] Scheduled job for event ${eventId} failed: ${err.message}`);
                                
                            } 
                            finally {                                  
                                // Remove from map after execution
                                scheduledJobs.delete(eventId);
                            }
                        });

                        scheduledJobs.set(eventId, job);
                    }
                                                
                    
                    return { photo: personalPhoto };
                }
        }
        catch(error){       
            global.appLogger.error(`[Error] Uploading Personal Website Photo Api Call ${error.message}\n`);  
            return { status: 'Error', message: 'Something went wrong while uploading photo.' };
        }
    }


    async confirmUploadedPhotos(req){
        try{
              global.appLogger.info(`\n---- Start Confirming Uploaded Photos Api Call by user with id ${req.userData._id} ----`);
              let photoIds = req.body.photoIds;

              await this._personalPhotoModel.update({
                isActive: true
              }, {
                where:{
                    id: {
                        [Op.in]: photoIds
                    }
                }
              })

              return { message: 'Photos Confirmed Successfully'}
        }
        catch(err){
            return {status: 'Error', message: 'Something went wrong while confirming user photos'}
        }
    }


    async ContactUs(req){
        try{
               global.appLogger.info(`\n---- Start Personal Website ContactUs Api Call ----`);
               const isSite = await this._personalWebsiteModel.findOne({
                    where: {
                        website_url: req.body.domain
                    },
                    attributes: ['user_id', 'user_name', 'website_url']
               });

               if(!isSite){
                    return {status: 'Error', message: 'Personal Site Not Found'}
               }

               const receiverData = await this._userModel.findOne({
                    where: {
                        id: isSite?.['dataValues']['user_id']
                    },
                    attributes:['email', 'name']
               });



               const siteUserName = isSite?.['dataValues']?.['user_name'];
               let photoContestMemberName = receiverData?.['dataValues']?.['name'].split(' ');
               const senderEmailTemplate = {
                      from_email:'support@example.com', 
                      from_name: "[The Photo Contest]", 
                      to_email: req.body.email, 
                      subject:`Thanks For Your Message to ${photoContestMemberName[0]}.`, 
                      body:`
                      <p>Hi there, 
                      <br><br> Just a quick note to let you know that we sent your message to ${receiverData?.['dataValues']?.['name']}.
                      <br><br> The email address you submitted is included so they can reply to you directly.
                      <br><br> If we can answer any questions, please reply to this email.
                      <br><br> Best,
                      <br> Ken-Bot (I'm a bot, but I'm a darn good one!)
                      <br><br> BTW: Get your own, free personal photography website at the
                        <a href="${Env.Base_Url}"> Photo Contest </a> while you wait!
                      </p>`
                }
                await sendEmail(senderEmailTemplate);

                if(receiverData){
                    const receiverEmailTemplate = {
                        from_email:'support@example.com', 
                        from_name: "[Ken-Bot | Photo Contest]", 
                        to_email: `${receiverData?.['dataValues']?.['email']}`,
                        to_name: `${receiverData?.['dataValues']?.['name']}`, 
                        subject:`Someone Just Emailed You From Your Website`, 
                        body:`<p>Hi ${photoContestMemberName[0]} -
                        <br><br> It's Ken-Bot (like Ken, but a bot 🤖). 
                        <br><br> Someone just sent you a message through the contact form on your
                        <a href="${isSite?.['dataValues']?.['website_url']}">${isSite?.['dataValues']?.['website_url']}</a>
                        <br><br> Their message is below.
                        <br><br>Happy day!
                        <br><br>:-) Ken-Bot (like Ken, but a bot 🤖)
                        <br><br>Photo Contest
                        <br><br> P.S. Reply directly to the person reaching out to you, not this email address. 
                        Of course if you have any problems, just reply to this email so we can look into it.
                        <br><br> 
                        <br><br> From: ${req.body.name}
                        <br> Email Address for reply: ${req.body.email}
                        <br><br> Message: ${req.body.message}
                        </p>`
                    }
                    await sendEmail(receiverEmailTemplate);
                }

                return {message: 'Mail Sent Successfully!'}
        }
        catch(error){       
            global.appLogger.error(`[Error] Personal Website Contact Us Api Call ${error.message}\n`);  
            return { status: 'Error', message: 'Something went wrong' };
        }
    }


    async getPersonalWebsite(req){
        try{
             global.appLogger.info(`\n---- Start Fetching Personal Website Api Call ----`);

             let userId = req.userData._id

             let personalWebsite = await this._personalWebsiteModel.findOne({
                where:{
                    user_id: userId
                },
                attributes:['id', 'user_id', 'website_url', 'user_name', 'user_bio', 'headline', 'subHeadline', 
                    'facebook_link', 'twitter_link', 'instagram_link', 'tiktok', 'linkedIn', 'template_name', 
                    'isHearted', 'isTopTenPhoto', 'followMe', 'show_big_photo_hunt_profile', 'big_photo_hunt_branding', 
                    'update_my_followers', 'profile_pic',  'compressedProfilePic', 'compressedProfileId'
                ]
             });


             if(!personalWebsite){
                return { message: 'Personal Website does not exist'}
             }

             const personalPhotos = await this._personalPhotoModel.findAll({
                where: {
                    isDeleted: false,
                    user_id: userId,
                },
                attributes: [
                    'id',
                    'compressedImageId',
                    ['compressedImageUrl', 'photo_url'],
                    'createdAt',
                ],
                order: [
                    [literal(`CASE WHEN "sort_order" IS NOT NULL THEN 0 ELSE 1 END`), 'ASC'],
                    ['sort_order', 'ASC'],
                    ['createdAt', 'ASC'],
                    ['id', 'ASC'],
                ],
                limit: 15,
                offset: 0
            });

            const gallery = await this._personalGalleriesModel.findAll({
                where: {
                    user_id: userId,
                    isDeleted: false,
                },
                attributes: ['id', 'name', 'createdAt'],
                order: [['createdAt', 'DESC']],
                limit: 10,
                offset: 0
            });

            personalWebsite['dataValues']['personalPhotos'] = personalPhotos;
            personalWebsite['dataValues']['gallery'] = gallery;


            return { personalWebsite};
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Personal Website Api Call ${err.message}\n`);  
            return { status: 'Error', message: 'Something went wrong while fetching personal website detail' };
        }
    }


    async deletePersonalPhotos(req){
        try{

            let userId = req.userData._id;
            
            global.appLogger.info(`\n---- Start Deleting Personal Photos Api Call By User with id ${userId} ----`);
                
            let photoIds = req.body.photoId;

            await this._personalPhotoModel.destroy({
                where: { 
                    id: { 
                        [Op.in]: photoIds 
                    }
                }
            });

          
            let personalWebsite = await this._personalWebsiteModel.findOne({
                where: { 
                    user_id: userId 
                },
                attributes: ['id', 'uploaded_photos', 'selected_photos']
            });

            
            if(!personalWebsite){
                return { message: 'Personal Website does not exist'}
            }


            let { uploaded_photos = [], selected_photos = [] } = personalWebsite;

            uploaded_photos = uploaded_photos.filter(
                (id) => !photoIds.includes(id)
            );

               
            selected_photos = selected_photos.filter(
                (id) => !photoIds.includes(id)
            );

           
            await this._personalWebsiteModel.update(
            {
                uploaded_photos,
                selected_photos
            },
            {
                where: { 
                    user_id: userId 
                } 
            });
            
            
            global.appLogger.info(`[End] Successfully Deleted Personal Photos \n`);
            return {message:'Personal Photos Deleted Successfully'};
        }
        catch(err){
            global.appLogger.error(`[Error] Delete Personal Photo Api Call ${err.message}\n`);  
            return { status: 'Error', message: 'Something went wrong while deleting personal photos' };
        }
    }


    async managePersonalPhotos(req){
        try{
            let userId = req.userData._id;     
            global.appLogger.info(`\n---- Start Manage Personal Photos Api Call By User with id ${userId} ----`);

            const photoIds = req.body.photoIds;

            if(photoIds && photoIds.length > 0){
                const cases = photoIds.map((id, index) => `WHEN '${id}' THEN ${index}`).join(" ");

                await sequelize.query(`UPDATE personal_photos
                    SET sort_order = CASE id ${cases}
                    END
                    WHERE id IN (${photoIds.map(id => `'${id}'`).join(",")})
                    and user_id = '${userId}'
                `);

            }

            global.appLogger.info(`[End] Successfully Managed Personal Photos \n`);
            return { message: 'Personal Photos Managed Successfully' };

        }
        catch(err){
            global.appLogger.error(`[Error] Manage Personal Photos Api Call ${err.message}\n`);  
            return { status: 'Error', message: 'Something went wrong while managing personal photos' };
        }
    }

}
