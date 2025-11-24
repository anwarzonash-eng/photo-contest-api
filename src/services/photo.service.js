import baseService from './base.service';
import { sequelize } from '../utils/database';
const uploadPhoto =require("../utils/aws/s3");
import {updateInterestsInProfile, updateMemberProfile, getMemberProfile } from '../utils/mailchimp/profile';
import  {findOrCreateMultipleInterests, findOrCreateInterest, setUserInterest } from "../utils/mailchimp/interest";
import {sendEmail} from "../utils/mailchimp/send_email";
import {photoOptimization} from "../utils/cloudinary/photo_optimization";
import {v2 as cloudinary} from 'cloudinary';
import { Env } from '../config';
import moment from 'moment';
import { Op, Transaction } from 'sequelize';
const moment_timezone = require('moment-timezone');
import { transactionCommit, transactionRollback } from '../utils/transaction';
const schedule = require('node-schedule');
const emailQueue = new Map();
const galleryQueue = new Map();
import { updateHuntScorePoints, updateGalleryHuntScorePoints, scheduledGalleryPhotos, addGalleryPhoto, incrementHuntScorePoints, decrementHuntScorePoint} from '../utils/genericFunctions';
import {notificationQueue} from "../utils/jobQueue";
import {getSecrets} from '../utils/secret-manager';
import {manageTags} from '../utils/mailchimp/tags';
import { UserModel } from '../models';


cloudinary.config({ 
  cloud_name:Env.cloudName,
  api_key:Env.cloudinaryApiKey,
  api_secret:Env.cloudinarySecretKey,
  secure: true  
});

const mailchimp = require("@mailchimp/mailchimp_marketing");
(async () => {
  try{
    let secret_key = await getSecrets();    
    mailchimp.setConfig({
        apiKey: secret_key.MailChimpMarketingApiKey,
        server: Env.MailChimpServerPrefix,
        timeout: 30000
    })
  }
  catch{}
})()


export class photoService extends baseService {

    async addPhoto(req){     
        let errorMessage = '';
        const transaction = await sequelize.transaction();            
        try {     
          global.appLogger.info(`\n---- Starting Upload Photo Api Call ----`);
          let photoReqBody; let photoData;
          let userPhoto = await this._userModel.findOne({
            where:{
              id: req.userData._id
            },
            transaction,
            attributes:['isPhotoInProcess']
          });

          let isPhotoExist = userPhoto['dataValues']['isPhotoInProcess'];
          if(isPhotoExist){
            return {status:'Error', message: 'Photo Already in Process'}
          }

          await this._userModel.update({
            isPhotoInProcess: true
          }, {
            where:{
              id: req.userData._id
            }
          });
          
          if(req.body.photoId){
              global.appLogger.info(`User with id ${req.userData._id} has started uploading a photo from gallery`);
              const photoDetail = await this._galleryPhotoModel.findOne({
                where: {
                  id: req.body.photoId,
                  user_id: req.userData._id
                },
                attributes:['photo_url', 'compressedImageUrl', 'compressedImageId','metadata'],
                transaction
              });

              if(photoDetail){
                  photoReqBody =  {
                      photo_url: photoDetail.dataValues.photo_url,
                      compressedImageUrl: photoDetail.dataValues.compressedImageUrl,
                      compressedImageId: photoDetail.dataValues.compressedImageId,
                      metadata: photoDetail.dataValues.metadata,
                      description: req.body.description,
                      feedback_type: req.body.feedback_type,
                      genres_list: req.body.genres_list,
                      user_id: req.userData._id,
                      isQueued: req.body.isQueued,
                      weekDay: req.body.weekDay,
                      day: req.body.day,
                      boostedWeeklyPhoto: 'Rehunt'
                  }       
              }
              else{
                return {status:'Error', message: 'No Photo Exist'}
              }    
          }
          else{
            global.appLogger.info(`User with id ${req.userData._id} has started uploading a photo from device`);
            photoData = await uploadPhoto.uploadPhoto(req.files.photoUrl);    
            photoReqBody =  {
              photo_url: photoData,
              description: req.body.description,
              feedback_type: req.body.feedback_type,
              metadata: req.body.metadata,
              genres_list: req.body.genres_list,
              user_id: req.userData._id,
              isQueued: req.body.isQueued,
              weekDay: req.body.weekDay,
              day: req.body.day,
              boostedWeeklyPhoto: 'Rehunt'
            }   
          }   

          if (req.body.uploadAt) {
            const preservedDate = moment(req.body.uploadAt).format('YYYY-MM-DD');

            // Get the current time in America/New_York
            const currentTimeNewYork = moment.tz('America/New_York').format('HH:mm:ss.SSSSSS');
        
            // Combine the preserved date with the current time in America/New_York
            photoReqBody.createdAt = (moment.tz(`${preservedDate} ${currentTimeNewYork}`, 'YYYY-MM-DD HH:mm:ss.SSSSSS', 'America/New_York')).format('YYYY-MM-DD HH:mm:ss.SSSSSSZ');
            //photoReqBody.createdAt = moment_timezone.tz(req.body.uploadAt, 'America/New_York').format('YYYY-MM-DD HH:mm:ss.SSSSSS') + moment_timezone.tz(req.body.uploadAt, 'America/New_York').format('Z').slice(0, 3);
              global.appLogger.info("uploadAt" + req.body.uploadAt + "_createdAt" + photoReqBody.createdAt + "isQueued" + req.body.isQueued);
            }

        


          let newPhoto = await this._photoModel.create(photoReqBody, { transaction });
          if(req.body.photoId){
            await this._galleryPhotoModel.update(
              { isHunted: true }, 
              { where: { id: req.body.photoId }, transaction }
            )
          }

          let optimizedData;
          let user = await this._userModel.findOne(  { where: { id: req.userData._id } })    
          try {
              
              if(req.files){
                  global.appLogger.info(`[Start] Optimizing Uploaded Photo`);
                  let imageFilePath = req.files.photoUrl['tempFilePath'];
                  optimizedData = await photoOptimization(imageFilePath, {folder: 'Resized_Photos', quality:"auto:good"});
                  if(optimizedData){
                      await this._photoModel.update({
                        compressedImageUrl: optimizedData.compressedImageUrl,
                        compressedImageId: optimizedData.compressedImageId
                        }, {
                        where:{
                          id: newPhoto.dataValues.id
                        },
                        transaction
                      });

                      global.appLogger.info(`[End] Photo Optimized Successfully`);
                  }
              }     
            }
            catch(err){
              global.appLogger.error(`[Error] Optimizing Uploaded Photo ${err.message}`);
              await transactionRollback(transaction);
              await this._userModel.update({
                  isPhotoInProcess: false
                }, {
                  where:{
                    id: req.userData._id
                  }
                });
              return { status: 'Error', message: "Something went wrong while compressing image"};
            }

          await transactionCommit(transaction);

          
          if(req.body.isQueued=='false' && !errorMessage)
          {  
            setTimeout(async () => {
                let uploadedPhotos;
                try {  
                  var userId =  req.userData._id;          
                  if(user){
                        uploadedPhotos = await this._photoModel.count({
                          where: {
                            user_id: userId,
                            isQueued: false
                          }
                        });
            

                        try{
                          if(uploadedPhotos == 1 && (user.dataValues.photograper_type == "I'm only here supporting a friend" || user.dataValues.photograper_type == "I just like to look")){
                            global.appLogger.info(`[Start] Updating Photographer type for user ${userId}`);
                            let currentInterests = await getMemberProfile(user.dataValues.member_id);  
                            if(currentInterests){
                              const nonPhotographerInterests = await findOrCreateInterest('BPH Master: User Account Status', 'Account Created - Non-Photographer');
                              if(nonPhotographerInterests){
                                global.appLogger.info(`non photo grapher ${nonPhotographerInterests.interestId}`)
                                  currentInterests[nonPhotographerInterests.interestId] = false;
                              }

                              const photographerInterests = await findOrCreateInterest('BPH Master: User Account Status', 'Account Created - Photographer');
                              if(photographerInterests){
                                  global.appLogger.info(`photo grapher ${photographerInterests.interestId}`)
                                  currentInterests[photographerInterests.interestId] = true;
                              }
                              await updateMemberProfile(user.dataValues.member_id, {interests: currentInterests}); 
                              global.appLogger.info(`[End] Successfully Updated Photographer Type for user ${userId} \n`);          
                            }   
                          }
                        }
                        catch(err){
                          global.appLogger.error(`Error Updating Photographer Type For User ${userId} \n ${err.message} \n`)
                        }

                        if(uploadedPhotos == 20){
                          global.appLogger.info(`[Start] Adding Mailchimp Interest for 20th photo upload For Memeber Id ${user.dataValues.member_id}`);
                          const interests = await findOrCreateInterest('BPH Master: Photo Submitted', '20th Photo');
                          if(interests){
                            let currentInterests = await getMemberProfile(user.dataValues.member_id);  
                            if(currentInterests){
                                currentInterests[interests.interestId] = true;
                                await updateMemberProfile(user.dataValues.member_id, {interests: currentInterests}); 
                                global.appLogger.info(`[End] Successfully Added Mailchimp Interest for 20th Photo Upload For Memeber Id ${user.dataValues.member_id} \n`); 
                            }
                          }               
                        }

                        if(uploadedPhotos < 5){   
                          global.appLogger.info(`[Start] Adding Mailchimp Interest for ${uploadedPhotos} Photo Upload For Member Id ${user.dataValues.member_id}`);
                          const interestList = ['First Photo', 'Second Photo', 'Third Photo', 'Fourth Photo']        
                          const getInterestId = await findOrCreateMultipleInterests('BPH Master: Photo Submitted', interestList);
                          if(getInterestId){
                              await updateInterestsInProfile(getInterestId, uploadedPhotos, user.dataValues.member_id);  
                              global.appLogger.info(`[End] Successfully Added Mailchimp Interest for ${uploadedPhotos} Photo Upload For Member Id ${user.dataValues.member_id}\n`);                           
                          }
                        }
                        
                        await this._photoModel.update({ status: true},{ where: { id: newPhoto.dataValues.id}});

                  }
                } 
                catch (err) {            
                    global.appLogger.error(`[Error] Adding Mailchimp Interest for ${uploadedPhotos} Photo Upload: ${err.message}`);  
                    await this._photoModel.update({ status: false},{ where: { id: newPhoto.dataValues.id}});
                    return {status:'Error', message: 'Something went wrong while uploading photo'}
                }

                try {
                  await updateHuntScorePoints(req.userData._id, 'posted_photo', 3);
                  await incrementHuntScorePoints(req.userData._id, 3);
                }
                catch(err){
                    throw err;
                }

                try{
                    const referral_code = user.dataValues.referral_code;
                    if(referral_code){
                        const photoCount = await this._photoModel.count({
                          where:{
                            user_id: req.userData._id
                          }
                        });
                        
                        if(photoCount == 1){
                          await updateHuntScorePoints(user.dataValues.inviterId, 'invite_new_member', 75);
                          await incrementHuntScorePoints(user.dataValues.inviterId, 75);
                        }
                    }
                }
                catch(err){
                    throw err;
                }

                try{
                  if(req.body.isGalleryPhoto == 'true'){
                      let photosCount =  await this._galleryPhotoModel.count({
                        where:{
                            user_id: req.userData._id, 
                            photo_display_status: {
                                [Op.ne]: 'expired'
                            }
                        }
                    });

                    let metaData = req.body.metaData;
                    if(metaData == ''){
                      metaData = null;
                    }
                    await addGalleryPhoto(req.userData._id, photoData, optimizedData, metaData, photosCount, true)

                    
                    try{
                      if(photosCount > 5 && user.dataValues.isPaid == false){
                          await scheduledGalleryPhotos(req.userData._id, galleryQueue);
                      }
                    }
                    catch(err){
                      global.appLogger.error(`[Error] Scheduling Grayed Out Gallery Photos ${err.message}\n`);  
                    }   
                  
                    try {
                        if(user.dataValues.isPaid == true && photosCount >= 10){
                           await updateGalleryHuntScorePoints(req.userData._id);               
                        }
                    }
                    catch(err){
                        throw err;
                    }

                    try{                   
                        global.appLogger.info(`[Start] Adding Gallery Photo Main Feed Mailchimp Interest By User ${req.userData._id} \n`);
                        const currentInterests = await getMemberProfile(user.dataValues.member_id);
                        if(currentInterests){
                            let interests;
                              if(photosCount >= 5 && user.dataValues.isPaid == false){
                                  interests =  await setUserInterest('BPH Master: Photo Submitted', 'Pers_Gallery_Main_Feed_Gallery_Full_NOTPAID', currentInterests,  true );   
                              }
                              else{
                                  interests =  await setUserInterest('BPH Master: Photo Submitted', 'Pers_Gallery_Main_Feed_Gallery_Full_NOTPAID', currentInterests,  false );   
                              }

                              interests = await setUserInterest('BPH Master: Photo Submitted', 'Pers_Gallery_Main_Feed_Checkbox', currentInterests, true);   
                              if(interests){       
                                  await updateMemberProfile(user.dataValues.member_id, { interests: interests });
                                  global.appLogger.info(`[End] Successfully Added Gallery Photo Main Feed Mailchimp Interest By User ${req.userData._id} \n`);
                              }
                        }      
                    }
                    catch(err){
                      global.appLogger.info(`[Error] Gallery Photo Main Feed Mailchimp Interest By User ${req.userData._id} ${err.message} \n`);
                    }
                   
                  }
                }
                catch(err){
                  throw err;
                }
            }, 0);
          }

          if(req.body.isQueued=='true') {   
            try{           
                  await this._userModel.update({
                    queued_count: user.dataValues.queued_count + 1
                  }, {
                      where:{
                        id: req.userData._id
                      }
                  });

                if(user.dataValues.isPaid == false){
                  global.appLogger.info(`[Start] Send Queued photo Email for Non-Paid User`);

                  const template={
                      from_email:'support@example.com', 
                      from_name: "Photo Contest", 
                      to_email: user.dataValues.email, 
                      subject:'Confirmation of Your Queued Photo', 
                      body:`<p>Hi! <br><br> It’s your friendly Photo Contest bot confirming that we’ve queued your photo for next week’s Photo Contest. 
                      We will send you an email to confirm when that happens.
                      <br><br> If you want to make changes to this photo or change which day of the week it will post, check out your Queue Manager at: ${Env.Base_Url}/queue
                      <br><br> Otherwise, it will post at, or soon after 12:15am Monday morning, New York City time (GMT -5).
                      <br><br> BTW: Consider becoming a Pro Member (${Env.Base_Url}/pmupgrade)?
                      <br><br>In addition to helping keep the lights on here (thank you!), you’ll be able to queue up to four weeks of photos and use the Coming Next feature. This lets members get notified the moment your photos drop—so they can the first upvotes.
                      <br><br>Have a great day!
                      <br><br>The Photo Contest</p>`
                  }
                  await sendEmail(template);
                  global.appLogger.info(`[End] Queued Photo Email for Non-Paid User Sended Successfully`);
                }
                else{
                    global.appLogger.info(`[Start] Schedule 10 Minutes Queued Photo Email for Paid User`);
                    const userId = req.userData._id;
                    // Cancel any previously scheduled job for this user
                    if (emailQueue.has(userId)) {
                      const job = emailQueue.get(userId);
                      job.cancel();
                    }

                  // Schedule a new job to send the email in 10 minutes
                  const job = schedule.scheduleJob(new Date(Date.now() + 10 * 60 * 1000), async () => {
                    try{
                        global.appLogger.info(`[Start] Send Scheduled Queued Photo Confirmation Email for Paid User`);
                        const queuedPhotos = await this._photoModel.count({
                          where:{
                            isQueued: true,
                            user_id: userId
                          }
                        }) 
                        const template= {
                          from_email:'support@example.com', 
                          from_name: "The Photo Contest", 
                          to_email: user.dataValues.email, 
                          subject:'Confirmation of Your Queued Photo(s)', 
                          body:`<p>Hi! 
                          <br><br> It’s your friendly Photo Contest bot confirming that we’ve queued your ${queuedPhotos} photo(s) into the Queue Manager
                          (${Env.Base_Url}/queue).
                          <br><br> As a Pro Member (thank you, btw!), the Queue Manager gives you complete control to:
                          <br><br> 1. Queue up to four weeks worth of photos.
                          <br> 2. Plan what day of the week you want your photos hunted.
                          <br> 3. Edit your photos or change your mind and remove them before they hunt.
                          <br> 4. Have your photos automatically hunted first, ahead of all other photos, at 12:05am EST on the day you choose.
                          <br><br> You can also post your photos in our new Coming Next section which will let members get notified the moment your photos drop—so they can be first to upvote.
                          <br><br> This all happens while you sleep. So get some good REM Zzzz’s in – you don’t have to do anything. :-)
                          <br><br>Have a great day!
                          <br><br>The Photo Contest</p>`
                        }
                        await sendEmail(template);
                        global.appLogger.info(`[End] Successfully Sended Scheduled Queued Photo Upload Confirmation Email for Paid User`);
                      } 
                      catch(err) {
                        global.appLogger.error(`[Error] Sending Scheduled Queued Photo Confirmation Email for Paid User ${err.message}`)
                      } 
                      finally {
                        emailQueue.delete(userId);
                      }
                    });

                emailQueue.set(userId, job);
                }


            }
            catch(err){
                global.appLogger.error(`[Error] Queued Photo Upload Confirmation Email ${err.message}`);
            }
          }      
          
          
        
          if(!errorMessage){
            setTimeout(async () => { 
              try{
                if(req.body.isQueued == 'true') {  
                    await updateHuntScorePoints(req.userData._id, 'queued_photo_post', 6);
                    await incrementHuntScorePoints(req.userData._id, 6);
                }
              }
              catch(err){
                  global.appLogger.error(`[Error] Adding Queued Photo Hunt Score By User ${req.userData._id} ${err.message} \n`);
              }


   
              let queuedPhotosCount; 
              try {
                    let queuedPhoto = await this._userModel.findOne({
                      where: {
                        id: req.userData._id
                      },
                      attributes:['queued_count']
                    });             

                    queuedPhotosCount = await queuedPhoto['dataValues']['queued_count'];     


                  if (queuedPhotosCount > 0 && queuedPhotosCount <= 3) {
                        global.appLogger.info(`[Start] Adding Mailchimp Interest for ${queuedPhotosCount} Queued Photo`);
                        let currentInterests = await getMemberProfile(user.dataValues.member_id);  
                        if(currentInterests){   
                              const interestMap = {
                                1: { key: '1st Queued Photo' },
                                2: { key: '2nd Queued Photo' },
                                3: { key: '3rd Queued Photo' }
                              };

                              if (interestMap[queuedPhotosCount]) {   
                                    const { key } = interestMap[queuedPhotosCount];
                                    let queuedPhotoInterest = await setUserInterest('Queued Photos', key, currentInterests, true);
                                    await updateMemberProfile(user.dataValues.member_id, { interests: queuedPhotoInterest });
                                    global.appLogger.info(`[End] Successfully Added Mailchimp Interest for ${queuedPhotosCount} Queued Photo \n`);
                              }
                        }    
                  }
              }
              catch(err){
                  global.appLogger.error(`[Error] Adding Mailchimp Interest for ${queuedPhotosCount} Queued Photo ${err.message} \n`);
              }

              try{
                  // remove tag 6_weeks_no_photo_posts
                  let tagName = '6_weeks_no_photo_posts';
                  const secretKey = await getSecrets();             
                  if(secretKey){       
                        global.appLogger.info(`[Start] Removing 6_weeks_no_photo_posts Tag for user ${user['dataValues']['id']} \n`);                                 
                        const response = await mailchimp.lists.getListMemberTags(secretKey.listId, user['dataValues']['member_id']);
                        const currentTags = response.tags.map(tag => tag.name);
                        if (currentTags.includes(tagName)) {
                              await manageTags(user['dataValues']['member_id'], secretKey.listId, tagName, 'inactive');
                              global.appLogger.info(`[End] Successfully Removed 6_weeks_no_photo_posts Tag for user ${user['dataValues']['id']} \n`);
                        }
                  }
              }
              catch(err){
                    global.appLogger.error(`[Error] Removing 6_weeks_no_photo_posts Tag for user ${user['dataValues']['id']} ${err.message } \n`);
              }                                         
            }, 0);
          }
          
            global.appLogger.info(`[End] User with Id ${req.userData._id} Successfully Uploaded Photo\n`);
            
            await this._userModel.update({
              isPhotoInProcess: false
            }, {
              where:{
                id: req.userData._id
              }
            });

            return {isQueued: newPhoto.dataValues.isQueued};
        }
        catch(error){   
          await transactionRollback(transaction);
           await this._userModel.update({
              isPhotoInProcess: false
            }, {
              where:{
                id: req.userData._id
              }
            });
            global.appLogger.error(`[Error] Uploading Photo By User with Id ${req.userData._id} ${error.message}\n`);
            return { status: 'Error', message: 'Something went wrong while uploading photo. Try Later' };
        }
  };


  async removeUserPhotos(req) {
    const transaction = await sequelize.transaction();
    try {
        global.appLogger.info(`\n---- Start Removing User Photo ${req.body.photoType} of photoId ${req.body.photoId} ----`);
        let photoType = req.body.photoType;
        let photoExist;

        if (photoType === 'hunted') {
            photoExist = await this._photoModel.findOne({
                where: { id: req.body.photoId },
                transaction
            });
        } 
        else {
            photoExist = await this._galleryPhotoModel.findOne({
                where: { id: req.body.photoId },
                transaction
            });
        }

        if (!photoExist) {
            await transaction.rollback();
            global.appLogger.error(`[Error] Photo not found for photoId ${req.body.photoId}`);
            return { status: 'Error', message: 'Photo not found' };
        }

       
        /*if (photoExist.photo_url) {
            await uploadPhoto.deletePhoto(photoExist.photo_url);
        }
        */

        

        if(photoType === 'hunted'){
            await this._photoModel.destroy({
              where:{
                id: req.body.photoId
              },
              transaction
            })

            // remove all photos from notifications 
            let query = `UPDATE "Users"
              SET notifications = (
                SELECT jsonb_agg(
                  CASE
                    WHEN item ? 'regular_notifications' THEN
                      jsonb_set(
                        item,
                        '{regular_notifications}',
                        COALESCE(
                          (SELECT jsonb_agg(e)
                          FROM jsonb_array_elements(item->'regular_notifications') e
                          WHERE COALESCE(e->'message'->>'photo_id','') <> '${req.body.photoId}'
                            AND COALESCE(e->>'photo_id','')        <> '${req.body.photoId}'
                          ), '[]'::jsonb
                        )
                      )
                    WHEN item ? 'photo_notifications' THEN
                      jsonb_set(
                        item,
                        '{photo_notifications}',
                        COALESCE(
                          (SELECT jsonb_agg(e)
                          FROM jsonb_array_elements(item->'photo_notifications') e
                          WHERE COALESCE(e->'message'->>'photo_id','') <> '${req.body.photoId}'
                            AND COALESCE(e->>'photo_id','')        <> '${req.body.photoId}'
                          ), '[]'::jsonb
                        )
                      )
                    ELSE item
                  END
                )
                FROM jsonb_array_elements("Users".notifications) item
              )
              WHERE "Users".notifications::text LIKE '%${req.body.photoId}%'`;

            await sequelize.query(query, {
                type: sequelize.QueryTypes.UPDATE, 
                transaction,
            });

            await this._notificationModel.destroy({
                where:{
                  photo_id: req.body.photoId
                },
                transaction, 
            })
        }
        else{
            await this._galleryPhotoModel.destroy({
                where: { id: req.body.photoId },
                transaction
            });
        }

        await photoExist.save({ transaction });
        await transaction.commit();
        global.appLogger.info(`Successfully removed photo ${photoType} Type with photoId ${req.body.photoId}`);
        return { message: 'Photo Deleted Successfully!' };
    } 
    catch (error) {
        await transaction.rollback();
        global.appLogger.error(`[Error] Removing User Photo: ${error.message}`);
        return { status: 'Error', message: 'Something went wrong while removing user photo' };
    }
}


  /*
  async getQueuedPhotoCount(req){
    try{
        global.appLogger.info(`\n---- Start Queued Photo Count Api Call by User with Id ${req.userData._id} ----`);
        const user = await this._userModel.findOne({
          attributes: ['isPaid', 'queued_count', 'member_id'],
          where: { id: req.userData._id } 
        });

        if(user.dataValues.isPaid == false && user.dataValues.queued_count >= 2){
            setTimeout(async () => {       
              try{
                  global.appLogger.info(`[Start] Adding Mailchimp Interest For 3rd Queued Photo But No`);
                  let currentInterests = await getMemberProfile(user.dataValues.member_id); 
                  if(currentInterests) {
                    const thirdQueuedPhotoInterest = await setUserInterest('Queued Photos', '3rd Queued Photo', currentInterests, false);
                    const thirdQueuedButNotInterest = await setUserInterest('Queued Photos', '3rd Queued But No', currentInterests, true);  
                    let interests = { ...thirdQueuedPhotoInterest, ...thirdQueuedButNotInterest };
                    if(interests){
                      await updateMemberProfile(user.dataValues.member_id, {interests: interests}); 
                      global.appLogger.info(`[End] Successfully Added Mailchimp Interest For 3rd Queued Photo But No \n`);
                    }
                  }
              }
              catch(err){
                  global.appLogger.error(`[Error] Added Mailchimp Interest For 3rd Queued Photo But No ${err.message} \n`);
              }
            }, 0);
            return {message: 'Queued Photo Limit Exceed'}
        }
        global.appLogger.info(`End] Queued Photo Count Api Call ----\n`);

        return {message: 'Photo limit not reached. You can still upload 1 more photo.'}
    }
    catch(err){
        global.appLogger.error(`Error] Queued Photo Count Api ${err.message} \n`);
        return { status: 'Error', message: 'Something went wrong while fetching queued photo count' };
    }
  }
  */

  async getQueuedPhotos(req){
    try{
      global.appLogger.info(`\n---- Start Getting Queued Photos Api Call by user with Id ${req.userData._id} ----`);
      const queuedPhotos = await this._photoModel.findAll({
        attributes:['id', ['compressedImageUrl', 'photo_url'], 'description', 'feedback_type', 'metadata', 'genres_list', 'compressedImageId', 'createdAt', 'weekDay', 'day', 'isComingNext'],
        where:{
          user_id: req.userData._id,
          isQueued: true,
          isFreezed: {
            [Op.or]:{
              [Op.eq]: false,
              [Op.is]: null
            }
          }
        },
        order: [['weekDay', 'ASC']]
      });

      let user = await this._userModel.findOne({
        where:{
          id: req.userData._id
        },
        attributes: ['isPaid']
      });
            
      const weekDayMap = {};
      queuedPhotos.forEach(photo => {
        weekDayMap[photo.weekDay] = photo;
      });

      const result = []; let daysLeft; let day=''; let createdAt;
      for (let weekDay = 1; weekDay <= 4; weekDay++) {
        if (weekDayMap[weekDay]) {
          const photoData = weekDayMap[weekDay]['dataValues'];
          const createdAtDate = new Date(photoData.createdAt);
          const now = new Date();
          day = photoData.day;
          const utcNow = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
          const utcCreatedAt = Date.UTC(createdAtDate.getFullYear(), createdAtDate.getMonth(), createdAtDate.getDate());
          const millisecondsDiff = utcCreatedAt - utcNow;
          daysLeft = Math.ceil(millisecondsDiff / (1000 * 60 * 60 * 24));
          createdAt = (new Date(photoData.createdAt)).toISOString().split('T')[0];
          result.push({
            ...photoData,
            daysLeft: daysLeft,
            createdAt: photoData.createdAt
          });
        } 
        else {
          if(daysLeft == null){
            const today = moment();
            const difference = (weekDay - today.day() + 7) % 7; 
            daysLeft = difference === 0 ? 7 : difference; 
          }
          else{
            const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            let days = (7 - (daysOfWeek.indexOf(day))) % 7;
            if(days === 0) {
              days = 7
            }
            daysLeft = daysLeft + days;
            
          }
          day= 'Monday'
          createdAt = moment(new Date().setDate(new Date().getDate() + daysLeft)).format('YYYY-MM-DD');
          result.push({
            id: null,
            photo_url: null,
            description: null,
            feedback_type: null,
            metadata: null,
            genres_list: null,
            compressedImageId: null,
            createdAt: createdAt,
            weekDay: weekDay.toString(),
            daysLeft: daysLeft,
            day: day
          });
        }

        if(user.dataValues.isPaid == false){
          break;
        }
      }
      global.appLogger.info(`[End] Getting Queued Photos Api Call \n`);
      return {result};
    }
    catch(err){
      global.appLogger.error(`[Error] Getting Queued Photos Api Call ${err.message} \n`);
      return { status: 'Error', message: 'Something went wrong while fetching queued photo' };
    }
  }



  async removeQueuedPhoto(req){
    try{
      const photoExist = await this._photoModel.findOne({
        where:{
          id: req.body.photoID,
          user_id: req.userData._id
        }
      })
      if(photoExist){  
          global.appLogger.info(`\n---- Start Removing Queued Photo Api Call by user with Id ${req.userData._id} ----`);
          const userPhotos = await this._photoModel.findAll({
            where: {
              user_id: req.userData._id,
              isQueued: true,
              weekDay: { [Op.gte]: photoExist.dataValues.weekDay }
            },
            attributes:['id', 'createdAt', 'weekDay','day'],
            order:[['weekDay', 'ASC']]
          });
          
          photoExist.destroy();
          await this._galleryPhotoModel.update({
            isHunted: false
          }, {
            where:{
              photo_url: photoExist.dataValues.photo_url,
              isHunted: true
            }
          })
          
  
          for(let i=0; i< userPhotos.length - 1; i++){
            let weekDay1 = Number(userPhotos[i].dataValues.weekDay) + 1;
            //console.log(weekDay1);
            const currentWeekDay = await this._photoModel.findOne({
              where:{
                weekDay: `${weekDay1}`,
                user_id: req.userData._id,
                isQueued: true,
              },
              attributes:['day']
            })

            let uploadAt; 
            let weekDay;
            let day;

            if(currentWeekDay == null){
              const createdAt = userPhotos[i].dataValues.createdAt;
              const fromDate = new Date(createdAt); 
              const currentDayIndex = fromDate.getDay();
              let daysUntilNextMonday;
              if(currentDayIndex == 1){
                  daysUntilNextMonday = 7;
              }
              else{
                  daysUntilNextMonday = (8 - currentDayIndex) % 7;
              }
              const nextMonday = new Date(fromDate);
              nextMonday.setDate(fromDate.getDate() + daysUntilNextMonday); 
              uploadAt = nextMonday;
              weekDay = userPhotos[i+1].dataValues.weekDay - 1;
              day = 'Monday';
            }
            else{
              uploadAt = userPhotos[i].dataValues.createdAt;
              weekDay = userPhotos[i].dataValues.weekDay;
              day = userPhotos[i].dataValues.day;
            }

            await this._photoModel.update({
              weekDay: weekDay,
              day: day,
              createdAt:  uploadAt
            },
              { where: { id: userPhotos[i+1].dataValues.id } 
            });
          }
          global.appLogger.info(`[End] Successfully Removed Queued Photo by user with Id ${req.userData._id} \n`);

            setTimeout(async () => {
                try{
                  await decrementHuntScorePoint('queued_photo_post', 6, req.userData._id);                    
              }
              catch{}
          },0)

          return {message:'Queued Photo Removed Successfully'}
      }
      else{
        return { status: 'Error', message: 'Photo Mismatch' };
      }
    }
    catch(err){
        global.appLogger.error(`[Error] Removing Queued Photo by user with Id ${req.userData._id} ${err.message}\n`);
        return { status: 'Error', message: 'Something went wrong while removing queued photo' };
    }
  }

  

  async sortQueuedPhotos(req){
    try{
        global.appLogger.info(`\n---- Start Sorting Queued Photo Api Call by user with Id ${req.userData._id} ----`);
        const Transaction = await sequelize.transaction();   
        await Promise.all(req.body.photos.map(async (photo) => {
            if(photo.photoId){
              const uploadAt = moment().tz('America/New_York').add(photo.daysLeft, 'days').format('YYYY-MM-DD HH:mm:ss.SSSSSSZ');
              await this._photoModel.update({
                weekDay: photo.weekDay,
                day: photo.day,
                createdAt: uploadAt
              }, {
                where:{
                  id: photo.photoId
                },
                transaction: Transaction
              })
            }
        }));

        await transactionCommit(Transaction)
        global.appLogger.info(`[End] Successfully Sorted Queued Photo by user with Id ${req.userData._id}\n`);
        return {message:'Photos Sorted Successfully'};
    }
    catch(err){
        await transactionRollback(Transaction);
        global.appLogger.info(`[Error] Sorting Queued Photo by user with Id ${req.userData._id} ${err.message}\n`);
        return { status: 'Error', message: 'Something went wrong while sorting queued photo' };
    }
  }





  async uploadGalleryPhotos(req){
    try {    
        global.appLogger.info(`\n---- Start Uploading Gallery Photo Api Call by user with Id ${req.userData._id} ----`);
        const photosData = await uploadPhoto.uploadPhoto(req.files.photoUrl);              
          try {
                let imageFilePath = req.files.photoUrl['tempFilePath'];
                const optimizedData = await photoOptimization(imageFilePath, {folder:'Resized_Photos', quality:"auto:good"});
                let photosCount =  await this._galleryPhotoModel.count({
                  where:{
                    user_id: req.userData._id, 
                    photo_display_status: {
                      [Op.ne]: 'expired'
                    }
                  }
                });

                await addGalleryPhoto(req.userData._id, photosData, optimizedData, req.body.metadata, photosCount, false)

          
                const user = await this._userModel.findOne({
                  where:{
                    id: req.userData._id
                  },
                  attributes:['member_id', 'isPaid']
                });

              setTimeout(async () => {   
                  try {    
                    photosCount = await this._galleryPhotoModel.count({
                      where:{
                        user_id: req.userData._id, 
                        photo_display_status: {
                          [Op.ne]: 'expired'
                        }
                      }
                    });   
                        const interestMap = {
                          1: { name: 'BPH Master: Photo Submitted', key: 'Pers_Gallery_1st_Photo' },
                          5: { name: 'BPH Master: Photo Submitted', key: 'Pers_Gallery_5th_Photo' },
                          6: { name: 'BPH Master: Photo Submitted', key: 'Pers_Gallery_6th_Photo' }
                        };
                  
                        if (interestMap[photosCount]) {    
                            global.appLogger.info(`[Start] Adding ${photosCount} Gallery Photo Mailchimp Interest`);
                            const currentInterests = await getMemberProfile(user.dataValues.member_id);
                            if(currentInterests){
                                const { name, key } = interestMap[photosCount];
                                let interests = await setUserInterest(name, key, currentInterests, true);   
                                if(interests){       
                                    await updateMemberProfile(user.dataValues.member_id, { interests: interests });
                                    global.appLogger.info(`[End] Successfully Added ${photosCount} Gallery Photo Mailchimp Interest \n`);
                                }
                            }                         
                        }
                  }
                  catch(err){
                      global.appLogger.error(`[Error] Adding ${photosCount} Gallery Photo Mailchimp Interest ${err.message}`);
                  }
                        

                  try{                    
                      if(photosCount > 5 && user.dataValues.isPaid == false){
                          await scheduledGalleryPhotos(req.userData._id, galleryQueue);
                      }
                  }
                  catch(err){
                    global.appLogger.error(`[Error] Scheduling Grayed Out Gallery Photos ${err.message}\n`);  
                  }  
                  
                  
                  
                  try {
                      if(user.dataValues.isPaid == true && photosCount >= 10){
                        await updateGalleryHuntScorePoints(req.userData._id);     
                      }
                  }
                  catch(err){
                      throw err;
                  }
              }, 0);
          }
          catch(err){
            global.appLogger.error(`[Error] Uploading Gallery Photos ${err.message}\n`);  
            return { status: 'Error', message: "Something went wrong while compressing image"};
          }
          
        global.appLogger.info(`[End] Successfully Uploaded Gallery Photos\n`);  
        return {message:'Photos Uploaded Successfully!'};
    }
      catch(error){       
        global.appLogger.error(`[Error] Uploading Gallery Photo Api Call ${error.message}\n`);  
        return { status: 'Error', message: 'Something went wrong while uploading photo.' };
    }
  }

  async deleteGalleryPhotos(req){
    try{
        global.appLogger.info(`\n---- Start Deleting Gallery Photo Api Call by user with Id ${req.userData._id} ----`);
        let photoIds = req.body.photoId;
        for(let i=0; i<photoIds.length; i++){
          await this._galleryPhotoModel.destroy(
          { 
            where: { id: photoIds[i] }
          })
        }
        global.appLogger.info(`[End] Successfully Deleted Gallery Photos\n`);
        return {message:'Gallery Photos Deleted Successfully'};
    }
    catch(error){       
      global.appLogger.error(`[Error] Deleting Gallery Photo Api Call ${error.message}\n`);
      return { status: 'Error', message: 'Something went wrong while removing gallery photos' };
    }
  }

  async viewGalleryPhotos(req){
    try{
      global.appLogger.info(`\n---- Start Fetching Gallery Photo Api Call for Page Type as ${req.body.sortingType} by user with Id ${req.userData._id} ----`);
      let limit = 10; 

      let user_id;
      if(req.body.profile){
          let user = await UserModel.findOne({
                where:{
                    profileCode: req.body.profile
                },
                attributes:['id']
          });
                    
          if(!user){
              return {status:'Error', message: `User with profile ${req.body.profile} does not exist`};
          }

          user_id = user.dataValues.id;
      }
      else{
        user_id = req.body.user_id ? req.body.user_id : req.userData._id;
      }
  
      
      const userPayment = await this._userModel.findOne({
        where:{
          id: user_id
        },
        attributes:['isPaid']
      });
      if(req.body.sortingType != "arranged_photo"){
        const isPaid = userPayment.dataValues.isPaid;
        if(isPaid == false){
          if(req.body.offset > 0 ){
            return [];
          }
          else{
            limit = 5;
          }      
        }

        if(isPaid == true){
          /*if(req.body.offset == 50){
            limit = 5;
          }*/

          if(req.body.offset > 40){
            return [];
          }     
        }
      }
  
      let orderBy = [];
      const isPhotoSorted = await this._galleryPhotoModel.count({
        where:{
          user_id: user_id,
          isVisible: true
        }
      });

      let photoSort = 'order by ("createdAt") ASC';
      if(isPhotoSorted){
        photoSort = `order by ("isVisible"=true) DESC, ("updatedAt") DESC, ("id") ASC`
      }

      let photoDisplay='';
      if(userPayment.dataValues.isPaid == false){
          photoDisplay = ` and p."photo_display_status" !='expired'`;
      }
      let where = `where p."user_id" = '${user_id}' ${photoDisplay}`;
      if (req.body.sortingType === 'arranged_photo') {
        orderBy = `${photoSort}, ("id") ASC, ("photo_display_status" = 'false')`;
      }
      else if(req.body.sortingType === 'gallery_photo'){
          where = `where p."isHunted"= false and p."user_id" = '${user_id}'`;
      } else {
        orderBy =  `${photoSort}`
      }

      let query = `SELECT  p."id", p."compressedImageUrl" AS "photo_url", p."compressedImageId", p."createdAt", 
      p."isHunted", p."isWeeklyTopTen", CASE WHEN p.metadata IS NULL THEN NULL 
      ELSE (p.metadata::jsonb)->>'dateTaken' END AS "dateTaken", p."updatedAt",
      u."name", u."country", u."state", u."id" AS "user_id", u."photo_url" AS "user_photo_url", u."createdAt" as "photo_posted_date", 
      (SELECT EXISTS( SELECT 1  FROM "Followers" f 
      WHERE f.user_id = p."user_id" 
      AND f.follower_id = '${user_id}'
        AND f."is_active" = true
      )) AS "is_follow",
      (SELECT EXISTS( SELECT 1 FROM "like_gallery_photos" gp WHERE gp.user_id = '${req.userData._id}' AND gp."gallery_photo_id" = p."id" 
      AND gp."isHearted" = true)) AS "isHearted",
      (Select count(*) as "heartedCount" from "like_gallery_photos" where "gallery_photo_id"= p."id" and "isHearted" = true)
      FROM "gallery_photos" p INNER JOIN  "Users" u ON u."id" = p."user_id"
      ${where}
      ${orderBy}
      limit ${limit}
      offset ${req.body.offset}`;
      
      const galleryPhotos = await sequelize.query(query, {
        type: sequelize.QueryTypes.SELECT
      });

      global.appLogger.info(`[End] Successfully Fetched Gallery Photos\n`);
      return galleryPhotos;   
         
      }
      catch(err){
        global.appLogger.error(`[Error] Fetching Gallery Photos ${err.message}\n`);
        return { status: 'Error', message: 'Something went wrong while fetching gallery photos' };
      }0
  }

  async manageGalleryPhotos(req){
      try{
          global.appLogger.info(`\n---- Start Managing Gallery Photo Api Call by user with Id ${req.userData._id} ----`);
          let photoIds = req.body.photoId;
          await this._galleryPhotoModel.update(
            { isVisible: false },
            { where: { user_id: req.userData._id }
          })

          for(let i = photoIds.length - 1; i >= 0; i--) {
            try{
                const isUserPhoto = await this._galleryPhotoModel.findOne({
                  where:{
                    user_id: req.userData._id,
                    id: photoIds[i]
                  },
                  attributes:['id']
                })

                if(isUserPhoto){
                  await this._galleryPhotoModel.update(
                    { isVisible: true },
                    { where: { id: photoIds[i] }
                  }) 
                } 
            }
            catch(err){
              global.appLogger.error(`[Error] Managing Gallery Photos ${err.message}\n`);
            }
          }
          global.appLogger.info(`[End] Successfully Managed Gallery Photos\n`);
          return {message:'Gallery Photos Managed Successfully'};
      }
      catch(err){
        global.appLogger.error(`[Error] Managing Gallery Photo Api Call ${err.message}\n`);
        return { status: 'Error', message: 'Something went wrong while managing gallery photos' };
      }
  }

    async getPhotoPerWeek(req){
      try{
        global.appLogger.info(`\n---- Start GetPhotoPerWeek Api Call by user with Id ${req.userData._id} ----`);
        if(req.body.isGallery == true){
          const photo_count = await this._galleryPhotoModel.count({
            where:{
              user_id: req.userData._id,
              photo_display_status: {
                [Op.ne]: 'expired'
              }
            }
          });
          global.appLogger.info(`[End] Successfully Get Gallery Photo Count By PhotoPerWeek Api Call \n`);
          return {photo_count};
        }    
      
        moment_timezone.updateLocale('en', {
          week: {
            dow: 1 // Monday as the start of the week
          }
        });
        
        const weekStartDate = moment_timezone.tz('America/New_York').clone().startOf('week').format('YYYY-MM-DD');
        const weekEndDate = moment_timezone.tz('America/New_York').clone().endOf('week').format('YYYY-MM-DD');

        let query=`Select
        (SELECT Exists(SELECT 1 FROM "Photos" p WHERE p.user_id = '${req.userData._id}'
        AND p."isDeleted" = false
        AND (p."isFreezed" IS NULL OR p."isFreezed" = false)
        AND p."createdAt"::date BETWEEN '${weekStartDate}' AND '${weekEndDate}'
        ) as photoExists),
        (Select count(*)::integer as "isQueued" FROM "Photos" p join "Users" u on u.id = p.user_id 
          WHERE user_id = '${req.userData._id}' and u."isBlocked"=false and p."isDeleted"=false 
          and p."isQueued"=true and ((p."isFreezed" IS NULL) OR p."isFreezed" = false))AS "isQueued",
        (Select "isPaid" FROM "Users" WHERE id='${req.userData._id}') as "isPaid"`;

        let results = await sequelize.query(query, {
          type: sequelize.QueryTypes.SELECT
        });
        
        global.appLogger.info(`Week Start Date ${weekStartDate} + _Week End Date ${weekEndDate} + _query as ${query} \n`);
        global.appLogger.info(`Photo Exists as ${results[0]["photoexists"]} \n`)

        global.appLogger.info(`Week Start Date ${weekStartDate} + _Week End Date ${weekEndDate} + _query as ${query} \n`);
        global.appLogger.info(`Photo Exists as ${results[0]["photoexists"]} \n`)
        
        if(results && results[0]["photoexists"] == true ){
          if(results[0]['isPaid'] == false){
              /* 
              if(results[0]["queued_count"] == 2 && results[0]["isQueued"] == 0){
                global.appLogger.info(`[End] Successfully Show Msg Non Paid User Queued Photo Limit Exceed By Get Photo Per Week Api \n`);
                return {message: 'Non Paid User Queued Photo Limit Exceed'}
              }
              
              */
          
              if(results[0]["isQueued"] == 0 && req.body.isQueued == false){
                global.appLogger.info(`[End] Successfully Show Msg Photo Limit Exceed By Get Photo Per Week Api \n`);
                return { message: 'Photo limit exceed', isPaid: results[0]["isPaid"]};
              }
          }


          if(req.body.isQueued == true){
            if(results && results[0]["isQueued"] >= 4 ){
              global.appLogger.info(`[End] Successfully Show Msg 4 Photos alreay in a queue By Get Photo Per Week Api \n`);
              return { message: 'Four Photos already in a queue',  isPaid: results[0]["isPaid"] };
            }
            else{
              global.appLogger.info(`[End] Successfully Show Msg In Queue By Get Photo Per Week Api \n`);
              return { message: 'In Queue',  isPaid: results[0]["isPaid"] };
            }  
          }
          else{
            if(results[0]["isPaid"] == true ){
              if(results && results[0]["isQueued"] >= 4 ){
                global.appLogger.info(`[End] Successfully Show Msg 4 Photos alreay in a queue for Paid User By Get Photo Per Week Api \n`);
                return { message: 'Four Photos already in a queue',  isPaid: results[0]["isPaid"] };
              }
              else{
                const allWeekDays = ['1', '2', '3', '4'];
                const userWeekDays = await this._photoModel.findAll({
                  where: { user_id: req.userData._id, isQueued: true },
                  attributes: ['weekDay', 'createdAt'],
                  group: ['weekDay', 'createdAt'],
                  order:[['weekDay', 'ASC']],
                  raw: true
                });    
                

                if(userWeekDays.length == 0){
                  global.appLogger.info(`[End] Successfully get 1st week Day for Paid User Queued Photo By Get Photo Per Week Api \n`);
                  return { weekDay:1 };
                }

                const usedWeekDays = userWeekDays.map(entry => entry.weekDay);
                const remainingWeekDays = allWeekDays.filter(day => !usedWeekDays.includes(day));
                const weekDay = remainingWeekDays.length > 0 ? remainingWeekDays[0] : null;
                let createdAt = userWeekDays[0]['createdAt'];
                if(weekDay == '1'){            
                    createdAt = moment_timezone.tz('America/New_York').clone().add(`${weekDay}`, 'week').startOf('week').format('YYYY-MM-DD');
                }
                
                global.appLogger.info(`[End] Successfully get week Days for Paid User Queued Photo By Get Photo Per Week Api \n`);
                return {weekDay, createdAt: createdAt};
              }
            }

            if(results && results[0]["isQueued"] >= 1 ){ 
              global.appLogger.info(`[End] Successfully get Message Photo is already in a queue By Get Photo Per Week Api \n`);
              return { message: 'Photo is already in a queue', isPaid: results[0]["isPaid"] };
            }
          }
          
        }
        else{
            global.appLogger.info(`[End] Successfully Show No Photo Exist Msg By Get Photo Per Week Api \n`);
            return { message: 'No Photo Exist',  isPaid: results[0]["isPaid"] };
        }
      }
      catch(err){
        global.appLogger.error(`[Error] Get Photo Per Week Api ${err.message}\n`);
        return { status: 'Error', message: 'Something went wrong while fetching photos per week' };
      }
    }

    async editPhoto(req){
      try{     
        global.appLogger.info(`\n---- Start Edit Photo Api Call by user with Id ${req.userData._id} ----`);
         var photoExist = await this._photoModel.findOne({
            where: {
              id: req.body.photo_id,
              user_id: req.userData._id
            }
         })

         if(photoExist){        
            const daysOfWeek = {
              Monday: 0,
              Tuesday: 1,
              Wednesday: 2,
              Thursday: 3,
              Friday: 4,
              Saturday: 5,
              Sunday: 6
            };

            let uploadAt;
            const currentDayIndex = daysOfWeek[photoExist.dataValues.day];
            const newDayIndex = daysOfWeek[req.body.day];

            let dayOffset;
            if (currentDayIndex < newDayIndex) {
              dayOffset = newDayIndex - currentDayIndex
            } if (currentDayIndex > newDayIndex) {
              dayOffset = newDayIndex - currentDayIndex
            }
              
            const currentDate = moment(photoExist.dataValues.createdAt).tz('America/New_York');
            uploadAt = currentDate.add(dayOffset, 'days').format('YYYY-MM-DD HH:mm:ss.SSSSSSZ');  

            const photo = await this._photoModel.update(
                  { description: req.body.description, feedback_type: req.body.feedback_type, genres_list: req.body.genres_list, day: req.body.day,
                    createdAt: uploadAt
                   }, 
                  { returning:true,where: { id: req.body.photo_id } 
            });
            global.appLogger.info(`[End] Successfully Edited Queued Photo \n`);          
            return photo[1][0].get();           
         }
         else{
            return {status:"Error", message:"Photo Mismatch"}
         }
      }
      catch(err){
        global.appLogger.error(`[Error] Editing Queued Photo ${err.message} \n`);          
        throw new Error(err.message);
      }
    }

  
    async listPhotoForLanding(req){  
      try{ 
        global.appLogger.info(`\n---- Start Fetching Photo Feed Api Call For Landing Page ----`);

        let query = `SELECT _photos.id, _photos.user_id, _photos."photo_url" as "original_photo_url", _photos."compressedImageId", _photos."compressedImageUrl" as "photo_url", _photos."createdAt" AS photo_posted_date,
        _photos.description, (SELECT json_object_agg(feedback_type, feedback_type) from unnest(string_to_array(_photos.feedback_type, ',')) feedback_type   
        ) AS feedback_type, _photos.metadata, _users.name, 
        CASE 
        WHEN LENGTH(_users."compressedProfilePic") > 0 THEN "compressedProfilePic" 
        ELSE _users.photo_url
        END AS user_photo_url, _users."compressedProfileId", _users.state, _users.country,
        (SELECT COUNT(*) FROM "Votes" AS _votes JOIN "Users" _user on _user.id=_votes.user_id WHERE _votes.photo_id = _photos.id and _user."isBlocked"=false and _votes."is_vote"=true) AS total_votes,
        (SELECT COUNT(*) FROM "Comments" AS _comments JOIN "Users" _user on _user.id=_comments.user_id WHERE _comments.photo_id = _photos.id and _comments."isDeleted"=false and _user."isBlocked"=false and _comments.top_comment_id='00000000-0000-0000-0000-000000000000') AS total_comments,
        false AS is_Vote, false As is_follow
        FROM "Photos" AS _photos JOIN "Users" AS _users ON _photos.user_id = _users.id
        ${req.body.sortingType === 'by_recent_users' ? 'JOIN ( SELECT user_id, MAX("createdAt") AS max_createdAt FROM "Photos" where "isDeleted"=false and "isQueued"=false GROUP BY user_id) AS latest_photos ON _photos.user_id = latest_photos.user_id AND _photos."createdAt" = latest_photos.max_createdAt':''}
        ${req.body.sortingType == 'this_week' ? `where date_trunc('week', _photos."createdAt"::timestamp AT TIME ZONE 'America/New_York') = date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')`: ''}
        ${req.body.sortingType == 'last_week' ? `where _photos."createdAt"::timestamp >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') - interval '1 week' 
        and _photos."createdAt"::timestamp <= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')`: ''}
        and _users."isBlocked"=false and _photos."isDeleted"=false and _photos."isQueued"=false
        ORDER BY 
        ${req.body.sortingType === 'by_recent_users' ? '_users."createdAt" DESC,':''}
        ${req.body.sortingType === 'by_recent_photos' ? '_photos."createdAt" DESC,':''}
        ${req.body.sortingType === 'leader_board' || req.body.sortingType === 'this_week' || req.body.sortingType === 'last_week' ? 'total_votes DESC,' : ''}
        _photos.id
        LIMIT 10 OFFSET :offSet`;
      
        const results = await sequelize.query(query, {
          type: sequelize.QueryTypes.SELECT,
          replacements: { offSet:req.body.offSet}
        });

        global.appLogger.info(`[End] Successfully Fetched Photo Feed For Landing\n`);          
        return {results};
      }
      catch(err){
        global.appLogger.error(`[Error] Fetching Photo Feed For Landing ${err.message}\n`);    
        throw new Error(err.message);
      }
    }
 
    async listPhoto(req, userId) {
        try{
          global.appLogger.info(`\n---- Start Fetching Photo Feed with sortingType as ${req.body.sortingType} Api Call by User with Id ${req.userData._id} ----`);
          let isRehuntedPhotoExist;
          if(req.body.rehuntedPhoto){
              isRehuntedPhotoExist = await this._photoModel.findOne({
                where:{
                  id: req.body.rehuntedPhoto['id'],
                  boostedWeeklyPhoto: 'Rehunted'
                },             
              });
          }

          let query;
          if(req.body.sortingType == 'coming_next_photos'){
                moment_timezone.updateLocale('en', {
                  week: {
                    dow: 1 // Monday as the start of the week
                  }
                });

                // Get the start of the next Monday
                const nextMondayDate = moment_timezone.tz('America/New_York').startOf('week').add(1, 'weeks').format('YYYY-MM-DD');
                
                // Get the start of the next next Monday
                const nextNextMondayDate = moment_timezone.tz('America/New_York').startOf('week').add(2, 'weeks').format('YYYY-MM-DD');

           
                
                query = `Select _photos.id, _photos."user_id", _user."name", _photos."photo_url" as "original_photo_url", 
                  _photos."compressedImageId", _photos."compressedImageUrl" as "photo_url", _photos."createdAt" AS photo_posted_date, 
                  _photos."comingNextAt",
                  _photos.description, (SELECT json_object_agg(feedback_type, feedback_type) from 
                  unnest(string_to_array(_photos.feedback_type, ',')) feedback_type) AS feedback_type, _photos.metadata, 
                  CASE WHEN LENGTH(_user."compressedProfilePic") > 0 THEN "compressedProfilePic" ELSE _user.photo_url 
                      END AS user_photo_url, 
                  _user."compressedProfileId", _user.state,
                  (SELECT EXISTS( SELECT * FROM "Votes" v WHERE photo_id = _photos.id and v.user_id= '${req.userData._id}' and v."is_vote"=true) ) AS is_vote,
                  (SELECT EXISTS( SELECT * FROM "photo_notifications" n WHERE photo_id = _photos.id and n.user_id= '${req.userData._id}' and n."is_notify"=true) ) AS is_notify,
                  (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id=_photos.user_id and f."is_active"=true) ) AS is_follow,  
                  (SELECT count(*) FROM "Votes" as _votes JOIN "Users" _user on _user.id=_votes.user_id
                      WHERE _votes.photo_id = _photos.id and _user."isBlocked"=false and _votes."is_vote"=true) AS total_votes, 
                  (SELECT COUNT(*) FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                      WHERE photo_id = _photos.id AND "Comments"."isDeleted" = false AND "Users"."isBlocked" = false 
                      and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000' 
                  ) as total_comments,  
                  ( Select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'user_profile_pic', user_profile_pic,
                  'username', username, 'photo_id', photo_id, 'comment_text', comment_text, 
                  'createdAt', "createdAt", 'updatedAt', "updatedAt", 'total_replies', total_replies, 'is_vote', is_vote, 
                  'total_votes', total_votes, 'is_follow', is_follow,
                  'compressedProfileId', "compressedProfileId"))  
                  from
                        (SELECT "Comments".id, user_id, photo_id, comment_text, "Comments"."createdAt", "Comments"."updatedAt", 
                          "Users".name AS username, CASE WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
                            ELSE photo_url END AS user_profile_pic, "compressedProfileId",
                        (SELECT COUNT(*) FROM "Comments" c join "Users" u on u.id= c.user_id
                            WHERE c.top_comment_id = "Comments".id and c."photo_id"= photo_id 
                            AND c."isDeleted" = false and u."isBlocked"=false
                        ) as total_replies,
                      (SELECT EXISTS( SELECT * FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote,
                      (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' 
                      and f.follower_id= "Comments".User_ID and f."is_active"=true) AS is_follow),
                      (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
                        WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false
                      ) AS total_votes
                      FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                      WHERE "Comments".photo_id = _photos.id and 
                      "Comments"."isDeleted"=false and "Users"."isBlocked"=false
                      and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000'
                      ORDER BY "Comments"."createdAt" DESC, "Comments".id
                      LIMIT 1) as comments
                  ) as comments  
                  FROM "Photos" _photos join "Users" _user on _user.id = _photos.user_id 
                      WHERE _user."isBlocked"= false and _photos."isDeleted"=false and _photos."isQueued"= true 
                      and _photos."isComingNext"= true
                      AND date(_photos."createdAt") >= '${nextMondayDate}' 
                      AND date(_photos."createdAt") < '${nextNextMondayDate}' 
                      and ((_photos."isFreezed" IS NULL) OR (_photos."isFreezed" = false))
                  order by _photos."comingNextAt" DESC, _photos.id
                  limit 10 offSet :offSet`;
          }
          else{
              
                query=`Select _photos."boostedWeeklyPhoto",
                _photos."boostedTime", _photos.id, _photos.user_id, _photos."photo_url" as "original_photo_url", _photos."compressedImageId",  _photos."compressedImageUrl" as "photo_url", _photos."createdAt" as 
                photo_posted_date, _photos.description, (SELECT json_object_agg(feedback_type, feedback_type) from 
                unnest(string_to_array(_photos.feedback_type, ',')) feedback_type) AS feedback_type, _photos.metadata, 
                _users.name, 
                CASE 
                WHEN LENGTH(_users."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                ELSE _users.photo_url
                END AS user_photo_url,
                _users."compressedProfileId", _users.state, _users.country,
                (SELECT EXISTS( SELECT * FROM "Votes" v WHERE photo_id = _photos.id and v.user_id=:userId and v."is_vote"=true) ) AS is_vote,
                (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = :userId and f.follower_id=_photos.user_id and f."is_active"=true) ) AS is_follow,  
                (SELECT count(*) FROM "Votes" as _votes JOIN "Users" _user on _user.id=_votes.user_id
                WHERE _votes.photo_id = _photos.id and _user."isBlocked"=false and _votes."is_vote"=true) AS total_votes, 
                (SELECT COUNT(*) FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                WHERE photo_id = _photos.id AND "Comments"."isDeleted" = false AND "Users"."isBlocked" = false 
                and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000' 
                )as total_comments,  
                ( Select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'user_profile_pic', user_profile_pic,
                'username', username, 'photo_id', photo_id, 'comment_text', comment_text, 
                'createdAt', "createdAt", 'updatedAt', "updatedAt", 'total_replies', total_replies, 'is_vote', is_vote, 
                'total_votes', total_votes, 'is_follow', is_follow,
                'compressedProfileId', "compressedProfileId"))  
                from
                (SELECT "Comments".id, user_id, 
                photo_id, 
                comment_text, "Comments"."createdAt", "Comments"."updatedAt", "Users".name AS username, 
                CASE 
                  WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
                  ELSE photo_url
                  END AS user_profile_pic, "compressedProfileId",
                (SELECT COUNT(*) FROM "Comments" c join "Users" u on u.id= c.user_id
                WHERE c.top_comment_id = "Comments".id and c."photo_id"= photo_id 
                AND c."isDeleted" = false and u."isBlocked"=false
                ) as total_replies,
              (SELECT EXISTS( SELECT * FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote,
              (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' 
              and f.follower_id= "Comments".User_ID and f."is_active"=true) AS is_follow),
              (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
              WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false) AS total_votes
              FROM "Comments"
              JOIN "Users" ON "Comments".User_ID = "Users".ID
              WHERE "Comments".photo_id = _photos.id and 
              "Comments"."isDeleted"=false and "Users"."isBlocked"=false
              and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000'
              ORDER BY "Comments"."createdAt" DESC, "Comments".id
              LIMIT 1) as comments) as comments                       
              from  "Photos" as _photos join "Users" as _users on _photos.user_id = _users.id 
              ${req.body.sortingType == 'new_to_you' ? `LEFT JOIN "Views" v ON _photos.id = v.photo_id AND v.user_id = '${req.userData._id}'
              LEFT JOIN "Votes" vt ON _photos.id = vt.photo_id AND vt.user_id = '${req.userData._id}' AND vt.is_vote = true
              LEFT JOIN "Comments" c ON _photos.id = c.photo_id AND c.user_id = '${req.userData._id}'`:''}
              ${req.body.sortingType == 'participating_members' ? `where _users."isPaid" = true`:''}
              ${req.body.sortingType == 'by_recent_users' ? 'JOIN ( SELECT user_id, MAX("createdAt") AS max_createdAt FROM "Photos" where "isDeleted"=false and "isQueued"=false GROUP BY user_id) AS latest_photos ON _photos.user_id = latest_photos.user_id AND _photos."createdAt" = latest_photos.max_createdAt':''}
              ${req.body.sortingType == 'this_week' ? `where date_trunc('week', _photos."createdAt"::timestamp AT TIME ZONE 'America/New_York') 
              = date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')`: ''}
              ${req.body.sortingType == 'last_week' ? `where _photos."createdAt"::timestamp >= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') - interval '1 week' 
              and _photos."createdAt"::timestamp <= date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')`: ''}
              ${req.body.sortingType == 'following' ? `inner join "Followers" f on f."follower_id"= _users."id"
              where f.user_id='${req.userData._id}' and _photos."user_id"= f."follower_id" and f."is_active"=true`: ''}  
              ${req.body.userType == 'by_user' ?'where _photos.user_id = :authId': ''}
              ${req.body.sortingType == 'new_to_you' ? `where v.id IS NULL AND vt.user_id IS NULL AND c.user_id IS NULL AND _photos."user_id" != '${req.userData._id}'`:''}
              and _users."isBlocked"=false and _photos."isDeleted" =false and _photos."isQueued"=false
              ${isRehuntedPhotoExist ? `and _photos.id != '${req.body.rehuntedPhoto['id']}'`: ''}
              order by  
                ${req.body.sortingType === 'following' || req.body.sortingType === 'new_to_you'
                ||  req.body.sortingType === 'participating_members' ? `_photos."createdAt" DESC,  _photos.id`:''}

                ${req.body.sortingType === 'by_recent_photos' ? `
                  CASE 

                WHEN _photos.user_id = '${req.userData._id}' and
                (SELECT "lastVisitTime" FROM "Users" WHERE id = '${req.userData._id}')
                < (SELECT MAX("createdAt") FROM "Photos" WHERE user_id = '${req.userData._id}' 
                and "isDeleted" = false
                and "isQueued"= false)
                Then 2    

                  WHEN (
                          SELECT "lastVisitTime"
                          FROM "Users"
                          WHERE id = '${req.userData._id}'
                        ) IS NOT NULL 
                        AND _photos."boostedWeeklyPhoto" = 'Rehunted'
                        AND _photos."createdAt" <  (SELECT "lastVisitTime" FROM "Users" WHERE id = '${req.userData._id}')
                          AND EXISTS (
                  SELECT 1
                  FROM "Views"
                  WHERE user_id = '${req.userData._id}'
                    AND photo_id = _photos.id
                    AND "boostedView" = false
                )
                  AND NOT EXISTS (
                    SELECT 1 FROM "Votes" WHERE user_id = '${req.userData._id}' AND photo_id = _photos.id
                  )
                THEN 1

                ELSE 0
              END DESC,
              _photos."createdAt" DESC` : ''}

              ${req.body.sortingType === 'by_recent_users' ? '_users."createdAt" DESC,  _photos.id':''}
              ${req.body.sortingType === 'leader_board' || req.body.sortingType === 'last_week'
              || req.body.sortingType === 'this_week' ? 'total_votes DESC, _photos.id' : ''}
              limit 10 offSet :offSet`;

          }
                

        const results = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT,
            replacements: { offSet:req.body.offSet, userId:userId,  authId: req.userData._id }
        });
        
        if(isRehuntedPhotoExist){
            results.unshift(req.body.rehuntedPhoto);
        }
        

        
        setTimeout(async () => {
          try {
                if(req.body.sortingType != 'coming_next_photos'){
                  const lastVisitTime = moment_timezone().tz('America/New_York').format('YYYY-MM-DD HH:mm:ss.SSSZ');
                    await this._userModel.update({ 
                      lastVisitTime: lastVisitTime }, 
                      { where: { id: req.userData._id } 
                    });
                }
          } 
          catch(err) {
            console.log(err.message);
          }

          try{
            if(req.body.offSet == 0 && req.body.sortingType == 'by_recent_photos'){
              global.appLogger.info(`Adding notificationQueue for user ${userId}`);
              await notificationQueue.add({ userId });    
            }  
          }
          catch(err){
            console.log(err.message);
          }
        }, 0)

        

        
        
        global.appLogger.info(`[End] Successfully Fetched Photo Feed\n`);          
        return {results};
      }
      catch(err){
          global.appLogger.error(`[Error] Fetching Photo Feed Api Call ${err.message}\n`);   
          throw new Error(err.message);
      }
    }

    async updateViewedPhoto(req){
      try{
        const photoDataArray = req.body.photoID; 
    
        const photoIds = photoDataArray.map(photo => photo.photoId);
    
        const existingViews = await this._photoViewsModel.findAll({
          attributes: ['photo_id', 'boostedStatus', 'boostedView'],
          where: {
            user_id: req.userData._id,
            photo_id: {
              [Op.in]: photoIds
            }
          }
        });
    
        const existingViewsMap = new Map();
        existingViews.forEach(view => {
          existingViewsMap.set(view.photo_id, {
            boostedStatus: view.boostedStatus,
            boostedView: view.boostedView
          });
        });
        
        const newViews = [];
        const updates = [];
        
        for (const { photoId, status} of photoDataArray) {
          if (!existingViewsMap.has(photoId)) {
            newViews.push({
              user_id: req.userData._id,
              photo_id: photoId,
              boostedStatus: status,
              boostedView: false
            });
          } else {
            const existing = existingViewsMap.get(photoId);
        
            if (existing.boostedStatus !== status || existing.boostedView == false) {
              updates.push({ photoId, boostedStatus: status, boostedView: true });
            }
          }
        }
        
    
        if (newViews.length > 0) {
          await this._photoViewsModel.bulkCreate(newViews);
        }
    
        for (const { photoId, boostedStatus, boostedView } of updates) {
          await this._photoViewsModel.update(
            { boostedStatus, boostedView },
            {
              where: {
                user_id: req.userData._id,
                photo_id: photoId
              }
            }
          );
        }
      }
      catch(err){
        throw new Error(err.message);
      }
    }


    async listParticipatingMemberPhotos(req){
      try{
        global.appLogger.info(`\n---- Start Fetching Participating Member Api Call by user with Id ${req.userData._id} ----`);
        
        let query=`Select _photos.id, _photos.user_id, _photos."photo_url" as "original_photo_url", _photos."compressedImageId", 
         _photos."compressedImageUrl" as "photo_url", _photos."createdAt" as photo_posted_date,
        _photos.description, (SELECT json_object_agg(feedback_type, feedback_type) from 
        unnest(string_to_array(_photos.feedback_type, ',')) feedback_type) AS feedback_type, _photos.metadata, 
        _users.name, _users.state, _users.camera_brand, _users."subscription_start_date" as "member_since", _users."photo_assistance",
        ( SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(_users.genres_list, ',')) genre) AS genres_list, 
        CASE WHEN LENGTH(_users."compressedProfilePic") > 0 THEN "compressedProfilePic" 
        ELSE _users.photo_url END AS user_photo_url, _users."compressedProfileId", 
         COALESCE(
            ( SELECT json_build_object( 'count', (SELECT count(*)
              FROM "Followers" f JOIN "Users" u ON u.id = f.follower_id
              WHERE f.user_id = _photos.user_id AND f."is_active"=true AND u."isBlocked" = false),
              'data', json_agg(json_build_object('photo_url', photo_url, 'name', name, 
              'compressedProfileId', "compressedProfileId"))
            )
            FROM (
                  SELECT f.*, CASE WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                  ELSE u."photo_url" END AS "photo_url", u.name, u."compressedProfileId"
                  FROM "Followers" f JOIN "Users" u ON u.id = f.follower_id
                  WHERE f.user_id = _photos.user_id AND f."is_active"=true AND u."isBlocked" = false
                  ORDER BY f."updatedAt" DESC
                  LIMIT 4
                ) f
                GROUP BY f.user_id
                ORDER BY MAX(f."updatedAt") DESC
              ),
              json_build_object('count', 0, 'data', '[]'::json)) AS "Following",
              COALESCE(
                (SELECT json_build_object('count', (SELECT count(*) FROM "Followers" f 
                      JOIN "Users" u ON u.id = f.follower_id
                      WHERE f.follower_id = _photos."user_id" AND f."is_active"=true
                      AND u."isBlocked" = false),
                      'data', json_agg(json_build_object('photo_url', photo_url, 'name', name,
                      'compressedProfileId', "compressedProfileId"))
                    )
                    FROM (
                        SELECT f.*,
                        CASE WHEN LENGTH(u."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                        ELSE u."photo_url"  END AS "photo_url", u."compressedProfileId", u.name
                        FROM "Followers" f JOIN "Users" u ON u.id = f.user_id
                        WHERE f.follower_id = _photos."user_id" AND f."is_active"=true
                        AND u."isBlocked" = false
                        ORDER BY f."updatedAt" DESC
                        LIMIT 4
                    ) f1
                    GROUP BY f1.follower_id
                    ORDER BY MAX(f1."updatedAt") DESC
                ),
                json_build_object('count', 0, 'data', '[]'::json)) AS "Followers",
              (SELECT json_agg( json_build_object( 'compressedImageUrl', gp."compressedImageUrl",
                  'compressedImageId', gp."compressedImageId")
              ) AS "gallery_photos"
              FROM (
                SELECT "compressedImageUrl", "compressedImageId"
                FROM "gallery_photos"
                WHERE "user_id" = _photos."user_id"
                ORDER BY ("isVisible" = true) DESC, "updatedAt" DESC
                LIMIT 4
          ) gp),  
        (SELECT EXISTS( SELECT * FROM "Votes" v WHERE photo_id = _photos.id and v.user_id='${req.userData._id}' and v."is_vote"=true) ) AS is_vote,
        (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id=_photos.user_id and f."is_active"=true) ) AS is_follow,  
        (SELECT count(*) FROM "Votes" as _votes JOIN "Users" _user on _user.id=_votes.user_id
        WHERE _votes.photo_id = _photos.id and _user."isBlocked"=false and _votes."is_vote"=true) AS total_votes, 
        (SELECT COUNT(*) FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
        WHERE photo_id = _photos.id AND "Comments"."isDeleted" = false AND "Users"."isBlocked" = false 
        and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000' 
        )as total_comments,  
        ( Select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'user_profile_pic', user_profile_pic,
        'username', username, 'photo_id', photo_id, 'comment_text', comment_text, 
        'createdAt', "createdAt", 'updatedAt', "updatedAt", 'total_replies', total_replies, 'is_vote', is_vote, 
        'total_votes', total_votes, 'is_follow', is_follow,
        'compressedProfileId', "compressedProfileId"))  
        from
         (SELECT "Comments".id, user_id, photo_id, comment_text, "Comments"."createdAt", 
         "Comments"."updatedAt", "Users".name AS username, CASE 
          WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
          ELSE photo_url END AS user_profile_pic, "compressedProfileId",
         (SELECT COUNT(*) FROM "Comments" c join "Users" u on u.id= c.user_id
         WHERE c.top_comment_id = "Comments".id and c."photo_id"= photo_id 
         AND c."isDeleted" = false and u."isBlocked"=false
        ) as total_replies,
       (SELECT EXISTS( SELECT * FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote,
       (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' 
       and f.follower_id= "Comments".User_ID and f."is_active"=true) AS is_follow),
       (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
          WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false) AS total_votes
          FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
          WHERE "Comments".photo_id = _photos.id and 
          "Comments"."isDeleted"=false and "Users"."isBlocked"=false
          and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000'
          ORDER BY "Comments"."createdAt" DESC, "Comments".id
          LIMIT 1) as comments
        ) as comments                       
      from "Photos" as _photos join "Users" as _users on _photos.user_id = _users.id 
      where _users."isPaid" = true and _users."isBlocked"=false and 
      _photos."isDeleted" = false and _photos."isQueued"=false
      AND _photos."createdAt" = (SELECT MAX("createdAt") 
          FROM "Photos" p 
          WHERE p.user_id = _photos.user_id
          AND p."isDeleted" = false 
          AND p."isQueued" = false
      )
      order by _photos."createdAt" DESC, _photos.id
      limit 10 offSet :offSet`;

      const results = await sequelize.query(query, {
          type: sequelize.QueryTypes.SELECT,
          replacements: { offSet:req.body.offSet}
      });

      global.appLogger.info(`[End] Successfully Fetched Participating Members List\n`);      
      return {results};
      }
      catch(err){
        global.appLogger.error(`[Error] Fetching Participating Members List Api Call ${err.message}\n`);   
        throw new Error(err.message);
      }
    }


    async listPhotoForNewMembers(req, userId){ 
      try{
        global.appLogger.info(`\n---- Start Fetching List Photo For New Members Api Call ----`);
        let query = `SELECT "id", "name", 
        CASE 
        WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
        ELSE photo_url
        END AS profile_pic, "compressedProfileId", "state", "country", 
        ( SELECT json_object_agg(genre, genre) FROM unnest(string_to_array(genres_list, ',')) genre
        ) AS genres_list, "camera_brand",
        ${req.userType === 'by_user' ? `(SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = :userId and f.follower_id="Users".id and f."is_active"=true) ) AS is_follow` : `false AS is_follow`},
        ${req.userType === 'by_user' ? `(SELECT EXISTS( SELECT * FROM "welcome_users" u WHERE user_id = :userId and u.welcomed_user_id="Users".id) ) AS is_welcome` : `false AS is_welcome`}  
        FROM "Users"
        WHERE "createdAt" >= CURRENT_DATE - INTERVAL '30 days' and "isBlocked"=false AND "photo_url" IS NOT NULL AND LENGTH("photo_url") > 0 AND ("photograper_type" = 'A professional' 
        OR "photograper_type" = 'A hobbyist having fun' OR "photograper_type" = 'I am still learning' OR "photograper_type" = 'I post on social media only')
        ORDER BY "createdAt" DESC
        LIMIT 10 OFFSET :offSet`;

        const results = await sequelize.query(query, {
          type: sequelize.QueryTypes.SELECT,
          replacements: { offSet: req.offSet, userId:userId }
        });

        global.appLogger.info(`[End] Successfully Fetched List Photo For New Members\n`);      
        return results;
      }
      catch(err){
          global.appLogger.error(`[Error] Fetching List Photo For New Members Api Call ${err.message}\n`);  
          throw new Error(err.message);
      }
    } 

    async listUpvotedPhotos(req){
      try{
          global.appLogger.info(`\n---- Start Fetching List Upvoted Photos Api Call by user with Id ${req.userData._id} ----`);
          let query=`SELECT v.id, v.photo_id, _users.id as user_id, _photos."photo_url" as "original_photo_url", _photos."compressedImageId", _photos."compressedImageUrl" as "photo_url", _photos."createdAt" 
                as photo_posted_date, _photos.description, (SELECT json_object_agg(feedback_type, feedback_type) from 
                unnest(string_to_array(_photos.feedback_type, ',')) feedback_type   
                ) AS feedback_type, _photos.metadata, _users.name, 
                 _users."compressedProfileId",
                 CASE 
                  WHEN LENGTH(_users."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                  ELSE _users.photo_url
                  END AS user_photo_url, _users.state, _users.country, true as is_vote,
                (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id =:authId and f.follower_id=_users.id and f."is_active"=true) ) AS is_follow,  
                (SELECT count(*) FROM "Votes" as _votes JOIN "Users" _user on _user.id=_votes.user_id WHERE _votes.photo_id = _photos.id and _user."isBlocked"=false and _votes."is_vote"=true) AS total_votes, 
                (SELECT count(*) FROM "Comments" as _comments JOIN "Users" _user on _user.id=_comments.user_id WHERE _comments.photo_id = _photos.id
                and _comments."isDeleted"=false and _user."isBlocked"=false and _comments.top_comment_id='00000000-0000-0000-0000-000000000000'
                ) AS total_comments,
                ( Select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'user_profile_pic', user_profile_pic,
                'username', username, 'photo_id', photo_id, 'comment_text', comment_text, 
                'createdAt', "createdAt", 'updatedAt', "updatedAt", 'total_replies', total_replies, 'is_vote', is_vote,
                'is_follow', is_follow, 'total_votes', total_votes, 'compressedProfileId', "compressedProfileId"))  
                from
                (SELECT "Comments".id, user_id, 
                CASE 
                WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
                ELSE photo_url
                END AS user_profile_pic, photo_id, comment_text, "Comments"."createdAt", 
                "Comments"."updatedAt", "Users".name AS username, "compressedProfileId",
                (SELECT COUNT(*) FROM "Comments" c join "Users" u on u.id= c.user_id
                WHERE c.top_comment_id = "Comments".id and c."photo_id"= photo_id 
                AND c."isDeleted" = false and u."isBlocked"=false
                ) as total_replies,
                (SELECT EXISTS( SELECT * FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote,  
                (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id="Users".id and f."is_active"=true) ) AS is_follow,
                (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
                WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false) AS total_votes
                FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                WHERE "Comments".photo_id = _photos.id and 
                "Comments"."isDeleted"=false and "Users"."isBlocked"=false
                and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000'
                ORDER BY "Comments"."createdAt" DESC, "Comments".id
                LIMIT 1) as comments) as comments 
                FROM public."Votes" v 
                join "Photos" _photos on _photos.id = v."photo_id" 
                join "Users" _users on _photos.user_id = _users.id
                where v."user_id"= :authId 
                ${req.body.sortingType === 'by_recent_users' ? `AND v."updatedAt" = (SELECT MAX(v2."updatedAt") FROM public."Votes" v2 JOIN "Photos" _photos2 ON _photos2.id = v2.photo_id WHERE _photos2.user_id = _users.id and v2.user_id = :authId  and _photos2."isDeleted"=false)` : 'and _photos."isDeleted"=false'}                     
                and _users."isBlocked"=false and _photos."isQueued"=false and v."is_vote"=true
                order by 
                ${req.body.sortingType === 'by_recent_users' ? '_users."createdAt" DESC,':''}
                ${req.body.sortingType === 'by_recent_photos' ? '_photos."createdAt" DESC,':''}
                ${req.body.sortingType === 'leader_board' ? 'total_votes DESC,' : ''}
                v.id
                limit 10 offSet :offSet`;
                
            const results = await sequelize.query(query, {
                  type: sequelize.QueryTypes.SELECT,
                  replacements: { offSet: req.body.offSet, authId:req.userData._id }
            });
            global.appLogger.info(`[End] Successfully Fetched List Upvoted Photos\n`);  
            return {results};
        }
        catch(err){
          global.appLogger.error(`[Error] Fetching List Upvoted Photos Api Call ${err.message}\n`);  
          throw new Error(err.message);
        }
    }

    async getPastUpvotedWeeks(){
      try{
        global.appLogger.info(`\n---- Start Getting Past Upvoted Weeks Api Call ----`);
        let query=`SELECT json_agg(past_weeks) AS past_weeks FROM (
          SELECT past_weeks FROM (
              SELECT DISTINCT TO_CHAR(DATE(date_trunc('week', "createdAt"::date)), 'MM.DD.YYYY') AS past_weeks
              FROM "Votes" where "is_vote"=true
              UNION
              SELECT TO_CHAR(DATE(date_trunc('week', current_date AT TIME ZONE 'America/New_York')), 'MM.DD.YYYY') AS past_weeks
          ) AS weeks
          ORDER BY past_weeks::date DESC
     
          ) AS past_weeks`;

          //     LIMIT 10

        const results = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT,
        });
  
        global.appLogger.info(`[End] Successfully Get Past Upvoted Weeks \n`);  
        return results;             
      }
      catch(err){
        global.appLogger.error(`[Error] Getting Past Upvoted Weeks Api Call ${err.message} \n`);  
        throw new Error(err.message);
      }
    }

    async listWeeklyUpvotedPhotos(req){
      try{
        global.appLogger.info(`\n---- Start List Weekly Upvoted Photos Api Call ----`);
 
        let startOfWeek, endOfWeek, timeZone;
        if(req.body.sortingType === 'recent_user' || req.body.sortingType === 'upvoted_photo'){
            timeZone = moment_timezone.tz('America/New_York');
        }
        else if(req.body.sortingType === 'by_week'){
            timeZone = moment_timezone.tz(req.body.weekDate, 'MM.DD.YYYY', 'America/New_York');
        }

        startOfWeek = timeZone.clone().startOf('isoWeek').subtract(1, 'week').format('YYYY-MM-DD HH:mm:ssZ');
        endOfWeek = timeZone.clone().endOf('isoWeek').subtract(1, 'week').format('YYYY-MM-DD HH:mm:ssZ');

        let where = `p."createdAt" BETWEEN :startOfWeek AND :endOfWeek
                    AND v."createdAt" BETWEEN :startOfWeek AND :endOfWeek`

        
        let query = `SELECT
        (SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'description', p.description, 'feedback_type', p.feedback_type,'metadata', p.metadata, 'user_id', p.user_id, 'compressedImageId', p."compressedImageId", 'photo_url', p."compressedImageUrl",
        'original_photo_url', p."photo_url", 'photo_posted_date', p.photo_posted_date,
        'name', u.name, 'compressedProfileId', "compressedProfileId",
        'user_photo_url', u."compressedProfilePic",
        'state', u.state,'country', u.country, 
        'total_votes', p.total_votes, 'is_vote', p.is_vote, 'is_follow', p.is_follow, 'is_congrat', p.is_congrat, 'total_comments', p.total_comments, 'comments', p.comments)
        ) as most_upvoted_photos 
        FROM (
          SELECT p.id, p.description, (SELECT json_object_agg(feedback_type, feedback_type) from 
          unnest(string_to_array(p.feedback_type, ',')) feedback_type   
          ) AS feedback_type, p.metadata, p.user_id, p."photo_url", p."compressedImageId", p."compressedImageUrl", (Select count(*) from "Votes" v1 inner join "Users" u1 on u1."id"=v1."user_id"  where "photo_id"=p."id" and "is_vote"=true and u1."isBlocked"=false) AS total_votes, 
          MAX(v."createdAt") as upvoted_date, p."createdAt" as photo_posted_date,
               ${req.body.userType == 'by_user' ? `(SELECT EXISTS(SELECT 1 FROM "Votes" v WHERE photo_id = p.id and v.user_id='${req.userData._id}' and v."is_vote"=true )) AS is_vote`:'false as is_vote'},
               ${req.body.userType == 'by_user' ?`(SELECT EXISTS( Select 1 from "notifications" where "notification_type"='congratulate_weekly_toptenuser'
               and "sender_id"='${req.userData._id}' and "receiver_id"=p."user_id" and "photo_id"=p.id) ) AS is_congrat` : `false AS is_congrat`}, 
               ${req.body.userType == 'by_user' ?`(SELECT EXISTS( SELECT 1 FROM "Followers" f WHERE user_id ='${req.userData._id}' and f.follower_id=p.user_id and f."is_active"=true) ) AS is_follow` : `false AS is_follow`},  
              (SELECT count(*) FROM "Comments" as _comments JOIN "Users" _user on _user.id=_comments.user_id 
                  WHERE _comments.photo_id = p.id and _comments."isDeleted"=false and _user."isBlocked"=false and _comments.top_comment_id='00000000-0000-0000-0000-000000000000'
              ) AS total_comments,
              ( Select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'user_profile_pic', user_profile_pic,
              'username', username, 'photo_id', photo_id, 'comment_text', comment_text, 'createdAt', "createdAt", 
              'updatedAt', "updatedAt", 'total_replies', total_replies, 'is_vote', is_vote, 'is_follow', is_follow, 'total_votes', total_votes,
              'compressedProfileId', "compressedProfileId"
              ))  
              from
              (SELECT "Comments".id, user_id, photo_id, comment_text, "Comments"."createdAt", 
              "Comments"."updatedAt", "Users".name AS username, 
              "compressedProfilePic" AS user_profile_pic,
              "compressedProfileId",
              (SELECT COUNT(*) FROM "Comments" c join "Users" u on u.id= c.user_id
              WHERE c.top_comment_id = "Comments".id and c."photo_id"= photo_id 
              AND c."isDeleted" = false and u."isBlocked"=false
              ) as total_replies,
              ${req.body.userType == 'by_user' ? `(SELECT EXISTS( SELECT 1 FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote`: `false as is_vote`},
              ${req.body.userType == 'by_user' ? `(SELECT EXISTS( SELECT 1 FROM "Followers" f WHERE f.user_id = '${req.userData._id}' and f.follower_id="Users".id and f."is_active"=true) ) AS is_follow`: `false as is_follow`},
              (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
              WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false) AS total_votes
              FROM "Comments"
              JOIN "Users" ON "Comments".User_ID = "Users".ID
              WHERE "Comments".photo_id = p.id and 
              "Comments"."isDeleted"=false and "Users"."isBlocked"=false
              and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000'
              ORDER BY "Comments"."createdAt" DESC, "Comments".id
              LIMIT 1) as comments) as comments  
          FROM "Photos" p JOIN "Votes" v ON p.id = v.photo_id
          ${req.body.sortingType === 'recent_user' ? `JOIN "Users" u ON u.id = p.user_id`: ''} 
          WHERE 
            ${where}
            AND p."isDeleted" = false and p."isQueued" = false
            and p.user_id NOT IN ('00000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000099')
          GROUP BY p.id
          ${req.body.sortingType === 'recent_user' ? `ORDER BY MAX(u."createdAt") DESC`:
          `ORDER BY (Select count(*) from "Votes" v inner join "Photos" p1 on p1."id"= v."photo_id"
          where photo_id= p.id and ${where}) DESC, 
          upvoted_date DESC`}
          LIMIT 10
      ) AS p
      JOIN "Users" u ON u.id = p.user_id
      WHERE u."isBlocked"= false)`;
    
      const results = await sequelize.query(query, {
        type: sequelize.QueryTypes.SELECT,
        replacements: { weekDate: req.body.weekDate, startOfWeek, endOfWeek}
      });

      global.appLogger.info(`[End] Successfully Fetched Weekly Upvoted Photos List\n`);  

      return {results};
    }
    catch(err){
      global.appLogger.error(`[Error] Fetching Weekly Upvoted Photos Api Call ${err.message}\n`); 
      throw new Error(err.message);
    }
  }

    async getPhotoById(req, user){  
      try{
        global.appLogger.info(`\n---- Start Get Photo By Id Api Call ----`);
        let query = `SELECT _photos.id, _photos.user_id, _photos."compressedImageUrl" as photo_url, 
                  _photos."photo_url" as "original_photo_url", _photos."compressedImageId", _photos."createdAt" 
                  AS photo_posted_date, _photos.description, 
                  (SELECT json_object_agg(feedback_type, feedback_type) from 
                  unnest(string_to_array(_photos.feedback_type, ',')) feedback_type   
                  ) AS feedback_type,
                  ${req.body.userType === 'by_user' ?`(SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id =:userId and f.follower_id=_photos.user_id and f."is_active"=true) ) AS is_follow`: `false AS is_follow`},
                   _photos.metadata, _users.name, 
                   CASE 
                    WHEN LENGTH(_users."compressedProfilePic") > 0 THEN "compressedProfilePic" 
                    ELSE _users.photo_url
                    END AS user_photo_url, _users."compressedProfileId", _users.state, 
                  _users.country,  (SELECT COUNT(*) FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                  WHERE photo_id = _photos.id AND "Comments"."isDeleted" = false AND "Users"."isBlocked" = false 
                  and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000' 
                  )as total_comments, 
                  ${req.body.userType === 'by_user' ?
                  `(SELECT EXISTS( SELECT * FROM "Votes" v WHERE photo_id = _photos."id" and v.user_id= :userId and v."is_vote"=true) ) AS is_vote` : 'false as is_vote'},
                  (SELECT COUNT(*) FROM "Votes" AS _votes JOIN "Users" _user on _user.id=_votes.user_id WHERE _votes.photo_id = _photos.id and _user."isBlocked"=false and _votes."is_vote"=true) AS total_votes,
                  ( Select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'user_profile_pic', user_profile_pic,'username', username, 'photo_id', photo_id, 'comment_text', comment_text, 
                  'createdAt', "createdAt", 'updatedAt', "updatedAt", 'total_replies', total_replies, 'is_vote', is_vote, 'is_follow', is_follow, 'total_votes', total_votes,
                  'compressedProfileId', "compressedProfileId"))  
                  from
                  (SELECT "Comments".id, user_id, 
                  CASE 
                  WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
                  ELSE photo_url
                  END AS user_profile_pic, "compressedProfileId", photo_id, comment_text, "Comments"."createdAt", "Comments"."updatedAt", "Users".name AS username,
                  (SELECT COUNT(*) FROM "Comments" c join "Users" u on u.id= c.user_id WHERE c.top_comment_id = "Comments".id
                  and c."photo_id"= photo_id AND c."isDeleted" = false and u."isBlocked"=false) as total_replies,
                  ${req.body.userType == 'by_user' ? `(SELECT EXISTS( SELECT * FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote`:`false as is_vote`},
                  ${req.body.userType == 'by_user' ? `(SELECT EXISTS( SELECT * FROM "Followers" f WHERE f.user_id = '${req.userData._id}' and f.follower_id="Users".id and f."is_active"=true) ) AS is_follow`:`false as is_follow`},
                  (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
                  WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false) AS total_votes
                  FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                  WHERE "Comments".photo_id = _photos.id and 
                  "Comments"."isDeleted"=false and "Users"."isBlocked"=false
                  and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000'
                  ORDER BY "Comments"."createdAt" DESC, "Comments".id
                  LIMIT 1) as comments) as comments  
                  FROM "Photos" AS _photos JOIN "Users" AS _users ON _photos.user_id = _users.id 
                  where _photos.id= :photoId`;

        const results = await sequelize.query(query, {
          type: sequelize.QueryTypes.SELECT,
          replacements: { photoId:req.body.photo_id, userId: user }
        });

        global.appLogger.info(`[End] Successfully Fetched Photo By Id\n`);  
        return results;
      }
      catch(err){
          global.appLogger.error(`[Error] Fetching Photo By Id Api Call ${err.message}\n`); 
          throw new Error(err.message);
      }
    }


    
    async getUserPhotos(req){
      try{   
        global.appLogger.info(`\n---- Start Fetching User Photos Api Call by user ----`);
        let query;  
          let userId = req.body.user_id;

          let batchId = req.body?.batchId;

              if(req.body.profile){
                  let user = await UserModel.findOne({
                        where:{
                            profileCode: req.body.profile
                        },
                        attributes:['id']
                  });
                            
                  if(!user){
                      return {status:'Error', message: `User with profile ${req.body.profile} does not exist`};
                  }
        
                  userId = user.dataValues.id;
              }


        let userPhotos = `SELECT _photos.id, _photos.user_id, _photos."boostedWeeklyPhoto",
                _photos."compressedImageId", _photos."photo_url" AS "original_photo_url",
                _photos."compressedImageUrl" AS "photo_url", _photos."createdAt" AS photo_posted_date,
                _photos.description, 
                (SELECT json_object_agg(feedback_type, feedback_type) 
                 FROM unnest(string_to_array(_photos.feedback_type, ',')) feedback_type   
                ) AS feedback_type, 
                _photos.metadata, _users.name,  
                CASE 
                  WHEN LENGTH(_users."compressedProfilePic") > 0 THEN _users."compressedProfilePic" 
                  ELSE _users.photo_url END AS user_photo_url,
                _users."compressedProfileId", _users.state, _users.country,
                (SELECT COUNT(*) 
                 FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                 WHERE photo_id = _photos.id AND "Comments"."isDeleted" = false 
                   AND "Users"."isBlocked" = false AND "Comments".top_comment_id = '00000000-0000-0000-0000-000000000000'
                ) AS total_comments, 
                (SELECT COUNT(*) FROM "Votes" AS _votes JOIN "Users" u ON u.id = _votes.user_id  
                 WHERE _votes.photo_id = _photos.id AND u."isBlocked" = false 
                   AND _votes."is_vote" = true) AS total_votes,
                ${ req.body?.userType === 'user' ? `(SELECT EXISTS (
                          SELECT 1
                          FROM "Votes" v
                          WHERE photo_id = _photos.id
                            AND v.user_id = '${req.userData._id}'
                            AND v."is_vote" = true
                        ))`
                    : batchId
                      ? `(SELECT EXISTS (
                            SELECT 1
                            FROM temporary_user_actions tua
                            WHERE tua.batch_id = '${batchId}'
                              AND tua.action_type = 'upvote_photo'
                              AND (tua.data->>'photoID') = _photos.id::text
                          ))`
                      : `false`
                } AS is_vote,
                ${req.body?.userType === 'user' ? `(SELECT EXISTS( SELECT * FROM "Followers" f 
                   WHERE user_id = '${req.userData._id}'
                     AND f.follower_id = _photos.user_id AND f."is_active" = true
                )) AS is_follow`: `false as is_follow`},
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', id, 'user_id', user_id, 'user_profile_pic', user_profile_pic,
                    'username', username, 'photo_id', photo_id, 'comment_text', comment_text, 
                    'createdAt', "createdAt", 'updatedAt', "updatedAt", 
                    'total_replies', total_replies, 'is_vote', is_vote, 'is_follow', is_follow,
                    'compressedProfileId', "compressedProfileId", 'total_votes', total_votes
                  )) 
                 FROM ( SELECT "Comments".id, user_id, 
                     CASE 
                       WHEN LENGTH("Users"."compressedProfilePic") > 0 THEN "Users"."compressedProfilePic" 
                       ELSE "Users".photo_url END AS user_profile_pic, 
                     "Users"."compressedProfileId", photo_id, comment_text, 
                     "Comments"."createdAt", "Comments"."updatedAt", "Users".name AS username,
                     (SELECT COUNT(*) FROM "Comments" c JOIN "Users" u ON u.id = c.user_id
                      WHERE c.top_comment_id = "Comments".id AND c.photo_id = photo_id 
                        AND c."isDeleted" = false AND u."isBlocked" = false
                     ) AS total_replies,
                     ${req.body?.userType === 'user' ? `(SELECT EXISTS( 
                        SELECT * FROM "like_comments" v 
                        WHERE comment_id = "Comments".id AND v.user_id = '${req.userData._id}'
                     )) AS is_vote`: `false as is_vote`},
                      ${req.body?.userType === 'user' ? `(SELECT EXISTS
                        ( 
                          SELECT * FROM "Followers" f 
                          WHERE user_id = '${req.userData._id}' AND f.follower_id = "Users".id 
                            AND f."is_active" = true
                        )
                      ) AS is_follow`: `false as is_follow`},
                     (SELECT COUNT(*) FROM "like_comments" AS _votes 
                      JOIN "Users" _user ON _user.id = _votes.user_id
                      WHERE _votes.comment_id = "Comments".id AND _user."isBlocked" = false
                     ) AS total_votes
                   FROM "Comments"
                   JOIN "Users" ON "Comments".User_ID = "Users".ID
                   WHERE "Comments".photo_id = _photos.id AND "Comments"."isDeleted" = false 
                     AND "Users"."isBlocked" = false AND "Comments".top_comment_id = '00000000-0000-0000-0000-000000000000'
                   ORDER BY "Comments"."createdAt" DESC, "Comments".id
                   LIMIT 1
                 ) AS comments
                ) AS comments            
              FROM "Photos" AS _photos 
              JOIN "Users" AS _users ON _photos.user_id = _users.id 
              where _photos."isDeleted" = false 
              AND _users."isBlocked" = false AND _photos."isQueued" = false AND `; 
        if (req.body.photo_id  && req.body.offset == 0) {
            query = `SELECT * FROM (
                  ${userPhotos} 
                  _photos.id = '${req.body.photo_id}'
                ) as photos
                UNION ALL
                (${userPhotos}
                  _photos.user_id = :userId AND _photos.id != '${req.body.photo_id}'
                  ORDER BY _photos."createdAt" DESC, _photos.id
                  LIMIT 9 
                  OFFSET :Offset)`;
          } 
          else {
            query = `${userPhotos} 
              _photos.user_id=:userId
              order by _photos."createdAt" desc, _photos.id
              LIMIT 10 OFFSET :Offset`;
        }
        
          const results = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT,
            replacements: { Offset:req.body.offset, userId: userId}
          });

      
          setTimeout(async () => {
            try {
              const Transaction = await sequelize.transaction();
              const insertData = results.map(photo => ({
                  user_id: req.userData._id,
                  photo_id: photo.id
              }));
      
              await this._photoViewsModel.bulkCreate(insertData, {
                  ignoreDuplicates: true,
                  transaction: Transaction
              });
      
              await transactionCommit(Transaction);
            } 
            catch {
              await transactionRollback(Transaction);
            }
          }, 0)
          
          global.appLogger.info(`[End] Successfully Fetched User Photos\n`);  
          return {results}; 
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching User Photos Api Call ${err.message}\n`); 
            throw new Error(err.message);
        }
   }

    async getPhotosCount(req){
      try{
        global.appLogger.info(`\n---- Start Getting Photos Count Api Call by user with Id ${req.userData._id} ----`);
        let query=`SELECT
        (SELECT COUNT(*) FROM "Photos" WHERE "user_id"=:authId and "isDeleted"=false and "isQueued"=false) AS photo_count,
        (SELECT COUNT(*) AS upvote_count FROM "Votes" join "Photos" on "Votes".photo_id = "Photos".id 
        join "Users" _user on _user.id = "Photos".user_id
        WHERE "Votes"."user_id"= :authId and "Photos"."isDeleted"=false
        and "Votes"."is_vote"=true
        and "Photos"."isQueued"=false
         and _user."isBlocked"=false)`;
        
        const results = await sequelize.query(query, {
          type: sequelize.QueryTypes.SELECT,
          replacements: { authId: req.userData._id }
        });
          
        global.appLogger.info(`[End] Successfully Fetched Photos Count\n`);  
        return results; 
      }
      catch(err){
          global.appLogger.error(`[Error] Fetching Photos Count Api Call ${err.message}\n`); 
          throw new Error(err.message);
      }
    }


    async photo_clicked(req){
        try{
          global.appLogger.info(`\n---- Start Photo Clicked Api Call ----`);
          const [photo_clicked, created] = await this._photoClickedModel.findOrCreate({
          where: {
            photo_id: req.photoID,
            source: req.source
          },
          defaults: {
            photo_id: req.photoID,
            source: req.source,
            total_count: 1 // Initial count value when creating a new row
          }
        });
        if (!created) {
          // Row already exists, increment the count value by 1
          await photo_clicked.increment('total_count', { by: 1 });
        }

        global.appLogger.info(`[End] Successfully Added Photo Clicked Count\n`);  
        return photo_clicked;
      }
      catch(err){
          global.appLogger.error(`[Error] Adding Photo Clicked Count Api Call ${err.message}\n`); 
          throw new Error(err.message);
      }
    }

     async heartedGalleryPhoto(req){
        try{
          global.appLogger.info(`[Start] Hearted Gallery Photo By User ${req.userData._id} \n`); 
      
          const isGalleryPhotoExist = await this._galleryPhotoModel.findOne({
            where:{
              id: req.body.galleryPhotoId
            },
            attributes:['id']
          });

          if(!isGalleryPhotoExist){
            return {status:'Error', message:'Gallery Photo does not exist'}
          }
          
          let response;
            if (req.body.isHearted == true) {
                  const [heartedPhoto, created] = await this._likeGalleryPhotoModel.findOrCreate({
                      where: {
                            gallery_photo_id: req.body.galleryPhotoId,
                            user_id: req.userData._id,
                      },
                      defaults: {
                          gallery_photo_id: req.body.galleryPhotoId,
                          user_id: req.userData._id,
                          isHearted: true
                      }
                  });
                    
                  if (created) {
                      response = {message:'Gallery Photo Clicked Successfully!'};
                  } 
                  else {
                      await this._likeGalleryPhotoModel.update({
                        isHearted: true
                      },{
                          where:{
                              gallery_photo_id: req.body.galleryPhotoId,
                              user_id: req.userData._id
                          }
                      })
                      response = {message:'Gallery Photo Clicked Successfully!'};
                  }
                  global.appLogger.info(`[End] Successfully Hearted Gallery Photo By User ${req.userData._id} \n`); 
            }
            else{
                await this._likeGalleryPhotoModel.update({
                    isHearted: false
                },{
                    where:{
                        gallery_photo_id: req.body.galleryPhotoId,
                        user_id: req.userData._id
                    }
                });
                response = {message:'Gallery Photo UnClicked Successfully!'};
            }
            return response;
        }
        catch(err){
          global.appLogger.error(`[Error] Hearted Gallery Photo Api Call ${err.message}\n`); 
          throw new Error(err.message);
        }
     }

     async updateComingNextPhoto(req){
        try{
          global.appLogger.error(`[Start] Updating Coming Next Photo By User ${req.userData._id} \n`); 
          
          await this._photoModel.update({
              isComingNext: req.body.isComingNext,
              comingNextAt: sequelize.fn('NOW')
          }, {
            where:{
              id: req.body.photoId,
            }
          });

          global.appLogger.error(`[End] Successfully Updated Coming Next Photo By User ${req.userData._id} \n`);  
          return {message: 'Coming Next Photo Updated Successfully!'}
        }
        catch(err){
          global.appLogger.error(`[Error] Update Coming Next Photo By User ${req.userData._id} ${err.message} \n`); 
          throw new Error(err.message);
        }
     }

    async listComingNextPhotos(req){
        try{
            global.appLogger.info(`[Start] List Coming Next Photos Api By User ${req.userData._id} \n`); 
            moment_timezone.updateLocale('en', {
              week: {
                dow: 1 // Monday as the start of the week
              }
            });

            // Get the start of the next Monday
            const nextMondayDate = moment_timezone.tz('America/New_York').startOf('week').add(1, 'weeks').format('YYYY-MM-DD');
            
            // Get the start of the next next Monday
            const nextNextMondayDate = moment_timezone.tz('America/New_York').startOf('week').add(2, 'weeks').format('YYYY-MM-DD');

            // Get the start of the next next Monday
            //const nextNextMondayDate = moment_timezone.tz('America/New_York').startOf('week').add(2, 'weeks').format('YYYY-MM-DD');
            
            const query = `Select _photos.id, _photos."user_id", _user."name", _photos."photo_url" as "original_photo_url", 
              _photos."compressedImageId", _photos."compressedImageUrl" as "photo_url", _photos."createdAt" AS photo_posted_date, 
              _photos."comingNextAt",
              _photos.description, (SELECT json_object_agg(feedback_type, feedback_type) from 
              unnest(string_to_array(_photos.feedback_type, ',')) feedback_type) AS feedback_type, _photos.metadata, 
              CASE WHEN LENGTH(_user."compressedProfilePic") > 0 THEN "compressedProfilePic" ELSE _user.photo_url 
                  END AS user_photo_url, 
              _user."compressedProfileId", _user.state,
              (SELECT EXISTS( SELECT * FROM "Votes" v WHERE photo_id = _photos.id and v.user_id= '${req.userData._id}' and v."is_vote"=true) ) AS is_vote,
              (SELECT EXISTS( SELECT * FROM "photo_notifications" n WHERE photo_id = _photos.id and n.user_id= '${req.userData._id}' and n."is_notify"=true) ) AS is_notify,
              (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' and f.follower_id=_photos.user_id and f."is_active"=true) ) AS is_follow,  
              (SELECT count(*) FROM "Votes" as _votes JOIN "Users" _user on _user.id=_votes.user_id
                  WHERE _votes.photo_id = _photos.id and _user."isBlocked"=false and _votes."is_vote"=true) AS total_votes, 
              (SELECT COUNT(*) FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                  WHERE photo_id = _photos.id AND "Comments"."isDeleted" = false AND "Users"."isBlocked" = false 
                  and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000' 
              ) as total_comments,  
              ( Select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'user_profile_pic', user_profile_pic,
              'username', username, 'photo_id', photo_id, 'comment_text', comment_text, 
              'createdAt', "createdAt", 'updatedAt', "updatedAt", 'total_replies', total_replies, 'is_vote', is_vote, 
              'total_votes', total_votes, 'is_follow', is_follow,
              'compressedProfileId', "compressedProfileId"))  
              from
                    (SELECT "Comments".id, user_id, photo_id, comment_text, "Comments"."createdAt", "Comments"."updatedAt", 
                      "Users".name AS username, CASE WHEN LENGTH("compressedProfilePic") > 0 THEN "compressedProfilePic" 
                        ELSE photo_url END AS user_profile_pic, "compressedProfileId",
                    (SELECT COUNT(*) FROM "Comments" c join "Users" u on u.id= c.user_id
                        WHERE c.top_comment_id = "Comments".id and c."photo_id"= photo_id 
                        AND c."isDeleted" = false and u."isBlocked"=false
                    ) as total_replies,
                  (SELECT EXISTS( SELECT * FROM "like_comments" v WHERE comment_id = "Comments".id and v.user_id='${req.userData._id}') ) as is_vote,
                  (SELECT EXISTS( SELECT * FROM "Followers" f WHERE user_id = '${req.userData._id}' 
                  and f.follower_id= "Comments".User_ID and f."is_active"=true) AS is_follow),
                  (SELECT count(*) FROM "like_comments" as _votes JOIN "Users" _user on _user.id=_votes.user_id
                    WHERE _votes.comment_id = "Comments".id and _user."isBlocked"=false
                  ) AS total_votes
                  FROM "Comments" JOIN "Users" ON "Comments".User_ID = "Users".ID
                  WHERE "Comments".photo_id = _photos.id and 
                  "Comments"."isDeleted"=false and "Users"."isBlocked"=false
                  and "Comments".top_comment_id='00000000-0000-0000-0000-000000000000'
                  ORDER BY "Comments"."createdAt" DESC, "Comments".id
                  LIMIT 1) as comments
              ) as comments  
              FROM "Photos" _photos join "Users" _user on _user.id = _photos.user_id 
                  WHERE _user."isBlocked"= false and _photos."isDeleted"=false and _photos."isQueued"= true 
                  and _photos."isComingNext"= true
                  AND date(_photos."createdAt") >= '${nextMondayDate}' 
                  AND date(_photos."createdAt") < '${nextNextMondayDate}' 
                  and ((_photos."isFreezed" IS NULL) OR (_photos."isFreezed" = false))
              order by _photos."comingNextAt" DESC, _photos.id
              limit 10 offSet ${req.body.offset}`;

            
            const photos = await sequelize.query(query, {
              type: sequelize.QueryTypes.SELECT
            });

            global.appLogger.info(`[End] Successfully Fetched List of Coming Next Photos By User ${req.userData._id} \n`); 
            return {results: photos};
        }
        catch(err){
          global.appLogger.error(`[Error] List Coming Next Photos By User ${req.userData._id} ${err.message} \n`); 
          throw new Error(err.message);
        }
    }

    async boostWeeklyPhotos(req){
        try{
            global.appLogger.info(`[Start] Boost Weekly Photo Api By User ${req.userData._id} \n`);
            const photoData = await this._photoModel.findOne({
              where:{
                id: req.body.photoId
              },
              attributes:['boostedWeeklyPhoto']
            });


            moment_timezone.updateLocale('en', {
              week: {
                dow: 1 
              }
            });
            
            const weekStartDate = moment_timezone.tz('America/New_York').clone().startOf('week').format('YYYY-MM-DD');
            const weekEndDate = moment_timezone.tz('America/New_York').clone().endOf('week').format('YYYY-MM-DD');

            if((req.body.postedDate >= weekStartDate && req.body.postedDate <= weekEndDate) && photoData['dataValues']['boostedWeeklyPhoto'] == 'Rehunt'){       
                  await this._photoModel.update({
                    boostedWeeklyPhoto: 'Rehunted',
                    boostedTime: sequelize.fn('NOW')
                  }, {
                    where:{
                        id: req.body.photoId
                    }
                  });
                  global.appLogger.info(`[End] Successfully Boosted Weekly Photo By User ${req.userData._id} \n`); 
                  return {boostedWeeklyPhoto: 'Rehunted'} 
            } 
            else{
                return {status: 'Error', message:'Boosted Time Limit Expired'}
            }   
      }
      catch(err){
        global.appLogger.error(`[Error] Boost Weekly Photo Api Call ${err.message}\n`); 
        throw new Error(err.message);
      }
    }
}