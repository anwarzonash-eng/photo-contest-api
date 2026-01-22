require("dotenv").config("../.env");

import App from './app.js';
import http from 'http'
const cron = require('node-cron');
import UserModel from "./models/auth.model.js";
import VoteModel from './models/votes.model.js';
import NotificationModel from "./models/notification.model.js";
import PhotoModel from "./models/photo.model.js";
import GalleryPhotoModel from "./models/gallery_photo.model.js";
import FollowersModel from "./models/followers.model.js";
import PhotoNotificationsModel from './models/photo_notifications.model.js';
import { Op, Sequelize } from 'sequelize';
import { sequelize } from './utils/database.js';
import {sendEmail} from "./utils/mailchimp/send_email.js";
import {updateInterestsInProfile, updateMemberProfile, getMemberProfile } from './utils/mailchimp/profile';
import  {findOrCreateMultipleInterests, findOrCreateInterest } from "./utils/mailchimp/interest";
import moment from 'moment';
const moment_timezone = require('moment-timezone');
import { updateHuntScorePoints, incrementHuntScorePoints, updateUserNotifications, generateUniqueShortCode } from './utils/genericFunctions.js';
import { manageTags } from "./utils/mailchimp/tags.js";
import { getSecrets } from './utils/secret-manager.js';
import {Env} from '../src/config';
import {CalculateTop6RankedPhotos } from './utils/genericFunctions.js';


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


const app = new App()
var PORT = process.env.PORT || 3334;
const server = http.createServer(app.app);



async function expireTokens() {
    try{
      const user =  await UserModel.findAll({
        where: {
            token_expiry: {
                [Op.not]: null,
                [Op.lt]: sequelize.literal('CAST(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000 AS BIGINT)')
            }
        }
    });

    for(let i=0; i< user.length; i++){
        await UserModel.update({ token:null, token_expiry:null }, { where: { id: user[i].dataValues.id } });                                    
    }
  }
  catch(err){}
}


cron.schedule('0 22 * * *', () => {
  // run every day at 10 pm
    expireTokens();
   }, {
     scheduled: true,
     timezone: 'America/New_York'
});


async function sendPhotoPostNotification(){
    try{

        global.appLogger.info('\n --------- Start Posting Scheduled Queued Photos ---------');
        let query = `SELECT DISTINCT ON (user_id) "id", "user_id", "createdAt", "weekDay", "isFreezed"
            FROM "Photos"
            WHERE "isQueued"=true AND date("createdAt") = current_date 
            ORDER BY user_id, "createdAt" DESC`;
                      
            
        const userPhotos = await sequelize.query(query, {
              type: sequelize.QueryTypes.SELECT
        });

        for(let i=0; i< userPhotos.length; i++){
          try{
              const user = await UserModel.findOne({
                  where: {
                  id: userPhotos[i].user_id
                  },
                  attributes:['email', 'member_id', 'isPaid', 'subscriptionStatus']
              })

              if(user.dataValues.isPaid == false && userPhotos[i]['isFreezed'] != true)
              {
                  await PhotoModel.update({
                    createdAt: sequelize.literal('CURRENT_TIMESTAMP'),
                    isQueued: false,
                    weekDay: null
                    }, 
                    { where: { user_id: userPhotos[i].user_id, id: userPhotos[i].id } 
                  });  

                  await updateHuntScorePoints(userPhotos[i].user_id, 'posted_photo', 3);
                  await incrementHuntScorePoints(userPhotos[i].user_id, 3);

                  let template = {
                        from_email:'support@example.com', 
                        from_name: "Photo Contest", 
                        to_email: user.dataValues.email,
                        subject: 'Your Queued Photo Is Being Hunted',
                        body:`<p>Hi! <br><br> It’s me, the Photo Contest bot, letting you know that the photo you queued up for this week’s hunt has posted. Swing by example.com to check it out in this week’s feed!
                        <br><br> Also, since your photo posted you can now queue up a photo for next week’s hunt if you’d like. Just click on the Post Photo button and you should be all set.
                        <br><br> If you want to get ahead of future photo hunts our Queue Manager lets you automatically queue up to four weeks of photos at once and pick the exact day of each week that your photo gets hunted (example.com/queue).
                        <br><br> If you have any questions, please email us at support@example.com. 
                        <br><br> Have a great day! 
                        <br><br>The Photo Contest </p>`
                  }          
                  await sendEmail(template);
                  global.appLogger.info(`[End] Successfully Posted Photo and Send Email to Non-Paid User ${user.dataValues.email} \n`);
              }


              if(user.dataValues.isPaid == true && user.dataValues.subscriptionStatus == 'active'){
                  let isFreezed = null;
                  if(userPhotos[i]['isFreezed']){
                    isFreezed = false;
                  }
                  
                  await PhotoModel.update({
                    createdAt: sequelize.literal('CURRENT_TIMESTAMP'),
                    isQueued: false,
                    isComingNext: false,
                    isFreezed: isFreezed,
                    weekDay: null}, 
                    { where: { user_id: userPhotos[i].user_id, id: userPhotos[i].id } });  

                  await updateHuntScorePoints(userPhotos[i].user_id, 'posted_photo', 3);
                  await incrementHuntScorePoints(userPhotos[i].user_id, 3);

                  const isQueuedPhotos = await PhotoModel.findAll({
                    where: {
                      user_id: userPhotos[i].user_id,
                      isQueued: true
                    },
                    attributes:['id', 'weekDay']
                  });

                  for(let j=0; j < isQueuedPhotos.length; j++) {
                      await PhotoModel.update({
                        weekDay: isQueuedPhotos[j].dataValues.weekDay -1 },
                        { where: { id: isQueuedPhotos[j].dataValues.id } 
                      });  
                  }

                  let template = {
                        from_email:'support@example.com', 
                        from_name: "The Photo Contest", 
                        to_email:user.dataValues.email,
                        subject: 'Your queued photo is now being hunted',
                        body:`<p>Hi! 
                        <br><br> It’s me, the Photo Contest bot, letting you know that the photo you queued up in your Queue Manager for this week’s hunt has automatically been posted. Swing by https://example.com to check it out!
                        <br><br> Since your photo posted there’s a spot available on your Queue Manager page. If you have another photo you’d like to be Hunted, you can queue it up now (https://example.com/queue).
                        <br><br> If you have any questions, please email us at support@example.com. 
                        <br><br> Have a great day! 
                        <br><br> The Photo Contest 
                        <br><br>
                        <br><br>
                        <br><br> P.S. Oooh, a reminder: Since you’re a paid member you get access to all the edit and scheduling tools available on the Queue Manager. Feel free to edit your posts and/or change the day that your photos will get hunted. </p>`
                    }     
                  await sendEmail(template);
                  global.appLogger.info(`[End] Successfully Posted Photo and Send Email to Paid User ${user.dataValues.email} \n`);
                }

                setTimeout(async () => {
                    try {
                        let uploadedPhotos = await PhotoModel.count({
                            where: {
                              user_id: userPhotos[i].user_id,
                              isQueued: false
                            }
                          });
            
                        
                          if(uploadedPhotos == 20){
                              global.appLogger.info(`[Start] Adding MailChimp Interest For 20th Scheduled Queued Photo Post of User ${user.dataValues.email}`); 
                              const interests = await findOrCreateInterest('BPH Master: Photo Submitted', '20th Photo');
                              if(interests){
                                  let currentInterests = await getMemberProfile(user.dataValues.member_id);  
                                  if(currentInterests){
                                      currentInterests[interests.interestId] = true;
                                      await updateMemberProfile(user.dataValues.member_id, {interests: currentInterests}); 
                                      global.appLogger.info(`[End] Successfully Added MailChimp Interest For 20th Scheduled Queued Photo Post of User ${user.dataValues.email} \n`);     
                                  }
                              }            
                          }
            
                          if(uploadedPhotos < 5){     
                              global.appLogger.info(`[Start] Adding MailChimp Interest For ${uploadedPhotos} Scheduled Queued Photo Post of User ${user.dataValues.email}`);      
                              const interestList = ['First Photo', 'Second Photo', 'Third Photo', 'Fourth Photo']        
                              const getInterestId = await findOrCreateMultipleInterests('BPH Master: Photo Submitted', interestList);
                              if(getInterestId){
                                await updateInterestsInProfile(getInterestId, uploadedPhotos, user.dataValues.member_id);      
                                global.appLogger.info(`[End] Successfully Added MailChimp Interest For ${uploadedPhotos} Scheduled Queued Photo Post of User ${user.dataValues.email} \n`);   
                              }            
                          }
                    }
                    catch(err){
                        global.appLogger.error(`[Error] Adding MailChimp Interest For Scheduled Queued Photo Post: ${err.message} \n`);  
                    }
                }, 0);    
          }
         catch(err){
            global.appLogger.error(`[Error] Posting Photo & Send Email to User: ${err.message} \n`);  
         }
    }
  }
  catch(err){
    global.appLogger.error(`[Error] Posting Queued Photos Cron Job: ${err.message} \n`);  
  }
}



async function updateBoostedPhoto(){
  try{
        global.appLogger.info('\n --------- Start Expiring Boosted Photo Cron Job ---------');
          let updateRehuntPhotos = await PhotoModel.update(
            { boostedWeeklyPhoto: 'Out of Time' },
            {
                where: {
                    boostedWeeklyPhoto: 'Rehunt',
                    isQueued: false,
                    [Op.and]: [
                      sequelize.where(sequelize.fn('DATE', sequelize.col('createdAt')), '<', sequelize.literal('CURRENT_DATE'))
                    ]
                },
                returning:true
          });
          global.appLogger.info(`[End] Successfully Expired Rehunt Photos ${updateRehuntPhotos} \n`);

          let updatedRehuntedPhotos = await PhotoModel.update(
            { boostedWeeklyPhoto: 'Rehunted_Before' },
            {
                where: {
                    boostedWeeklyPhoto: 'Rehunted',
                    isQueued: false,
                    [Op.and]: [
                      sequelize.where(sequelize.fn('DATE', sequelize.col('createdAt')), '<', sequelize.literal('CURRENT_DATE'))
                    ]
                },
                returning:true
          });

          global.appLogger.info(`[End] Successfully Updated Rehunted_Before Photos ${updatedRehuntedPhotos} \n`);

  }
  catch(err){
    console.log(err.message);
    global.appLogger.error(`[Error] Updating Boosted Photo Cron Job: ${err.message} \n`);  
  }
}

//cron.schedule('*/2 * * * *', () => {
cron.schedule('0 0 * * 1', () => {
  // 12:00 AM GMT-5 run Monday
 updateBoostedPhoto();
}, {
 scheduled: true,
 timezone: 'America/New_York',
});





cron.schedule('15 0 * * *', () => {
     // 12:15 AM GMT-5 run every day
    sendPhotoPostNotification();
  }, {
    scheduled: true,
    timezone: 'America/New_York',
  });



  async function decrementWeekDays(){
    try{
        global.appLogger.info(`\n ----- Start Decrement Week Day -----`)
        moment_timezone.updateLocale('en', {
          week: {
            dow: 1 // Monday as the start of the week
          }
        });
        
        const weekStartDate = moment_timezone.tz('America/New_York').clone().add(1, 'week').startOf('week').format('YYYY-MM-DD');
        const weekEndDate = moment_timezone.tz('America/New_York').clone().add(1, 'week').endOf('week').format('YYYY-MM-DD');
    
        let query = `SELECT p."user_id" FROM "Photos" p
            where "isQueued"= true
            GROUP BY p."user_id"
            HAVING
            SUM(CASE WHEN p."weekDay" IS NOT NULL AND p."weekDay"::integer = 1 THEN 1 ELSE 0 END) = 0
            AND SUM(CASE WHEN p."weekDay" IS NOT NULL 
                  AND p."weekDay"::integer IN (2, 3, 4) 
                  AND DATE(p."createdAt") >= '${weekStartDate}'
                  AND DATE(p."createdAt") <= '${weekEndDate}'
                  THEN 1 ELSE 0 END
            ) > 0`;
 

        const users = await sequelize.query(query, {
              type: sequelize.QueryTypes.SELECT
          });  
          
        for(let i=0; i< users.length; i++){
            global.appLogger.info(`[Start] Decrement Queued Photos Week Day of User ${users[i].user_id}`);
            const isQueuedPhotos = await PhotoModel.findAll({
              where: {
                user_id: users[i].user_id,
                isQueued: true
              },
              attributes:['id', 'weekDay']
            });

            for(let j=0; j < isQueuedPhotos.length; j++) {
                await PhotoModel.update({
                  weekDay: isQueuedPhotos[j].dataValues.weekDay - 1 },
                  {
                    where: { id: isQueuedPhotos[j].dataValues.id 
                  } 
                });  
            }
            global.appLogger.info(`[End] Decrement Queued Photos Week Day of User ${users[i].user_id} \n`);
        }
        global.appLogger.info(`[End] Successfully Decremented Queued Photos \n`);
      }
      catch(err){
          global.appLogger.error(`[Error] Decrementing Queued Photos ${err.message} \n`);
      }

      try{
                  
            let timeZone = moment_timezone.tz('America/New_York');                           
            let startOfWeek = timeZone.clone().startOf('isoWeek').subtract(1, 'week').format('YYYY-MM-DD HH:mm:ssZ');
            let endOfWeek = timeZone.clone().endOf('isoWeek').subtract(1, 'week').format('YYYY-MM-DD HH:mm:ssZ');
        
            let where = `p."createdAt" BETWEEN :startOfWeek AND :endOfWeek
                            AND v."createdAt" BETWEEN :startOfWeek AND :endOfWeek`
        
                       
            let query = `SELECT p.id
              FROM "Photos" p 
              INNER JOIN "Votes" v ON p.id = v.photo_id
              INNER JOIN "Users" u ON u.id = p.user_id AND u."isBlocked" = false
              WHERE  ${where}
              AND p."isDeleted" = false AND p."isQueued" = false
              AND p.user_id NOT IN (
                Select id from "Users" where "email" like '%admin@example.com%'
              )
              GROUP BY p.id
              ORDER BY 
              ( 
                  Select count(*) 
                  from "Votes" v inner join "Photos" p1 
                  on p1."id"= v."photo_id"
                  where photo_id= p.id and ${where}
              ) DESC,
              MAX(v."createdAt") DESC
              LIMIT 10`;
             
              const topTenPhotos = await sequelize.query(query, {
                  type: sequelize.QueryTypes.SELECT,
                  replacements: { startOfWeek, endOfWeek}
              });

             
              const photoIds = topTenPhotos.map(p => p.id);
              if(photoIds){
                      await PhotoModel.update({
                          isWeeklyTopTen: true,                 
                      }, {
                          where:{
                              id: {
                                [Op.in]: photoIds
                              }
                          }
                      });
              }
                    
              global.appLogger.info(`Weekly Top Ten of week ${startOfWeek} updated successfully`);
      }
      catch(err){
          global.appLogger.error(`[Error] Updating Weekly Top Ten ${err.message}`)
      }
  }


  cron.schedule('0 0 * * 1', () => {
    // 12:00 AM GMT-5 run every Monday
    decrementWeekDays();
  }, {
    scheduled: true,
    timezone: 'America/New_York',
  });



async function sendPhotoReminder(){
    try{
        global.appLogger.info(`\n ----- Starting send Photo Reminder Function -----`);
        let query = `Select distinct u.id, u.email from "Users" u join "Photos" p on p.user_id=u.id where u."reminder" = true
        and p."isQueued"=false`;
        let user = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT
          });


        for(let i=0; i< user.length; i++){
          try{
              let isReminder =  await UserModel.findOne({
                    attributes: [
                          [sequelize.literal(
                            ` CASE WHEN date_trunc('week', "reminderDate"::timestamp AT TIME ZONE 'America/New_York') = date_trunc('week', current_timestamp AT TIME ZONE 'America/New_York') THEN 'true' ELSE 'false' END`
                          ),
                          'result'
                          ],
                    ],
                    where: { id: user[i].id },
                  })
            
              if(isReminder.dataValues.result != 'true'){
                  global.appLogger.info(`\n [Start] Send Photo Reminder Email to User ${user[i].email}  -----`);
                  await UserModel.update({ reminder: false, reminderDate: null}, { where: { id: user[i].id} });  
                  const template={
                      from_email:'support@example.com', 
                      from_name: "Photo Contest", 
                      to_email:user[i].email, 
                      subject: 'Your Requested Reminder',
                      body:`<p>Hi! <br><br> As you requested, it’s your friendly Photo Contest bot sending an email to remind you that this week’s Photo Contest has started. <br><br> If you have a photo that you’d like to include, please visit the Photo Contest (example.com) to get hunting! <br><br> If you are a Participating Member you may also want to check your Queue Manager to add an additional photo for the next hunt.<br><br> If you have any questions, please email us at support@example.com. <br><br>Have a great day! <br><br>The Photo Contest</p>`
                  }
                  await sendEmail(template);
                  global.appLogger.info(`[End] Successfully Send Photo Reminder Email to User ${user[i].email} \n`);
              }
          }         
          catch(err){
              global.appLogger.error(`[Error] Sending Photo Reminder Email to User ${user[i].email} \n ${err.message} \n`);
          }
        }
    }
    catch(err){
      global.appLogger.error(`[Error] Sending Photo Reminder Email Cron Job ${err.message} \n`);
    }
}


// 12:30 AM GMT-5 on Mondays
cron.schedule('30 0 * * 1', () => {
        sendPhotoReminder();
      }, {
        scheduled: true,
        timezone: 'America/New_York',
});



async function sendQueuedPhotoReminder(){
      try{
          global.appLogger.info(`\n --- Starting Send Queued Photo Reminder Function -----`);
          let query = `SELECT u.id, u.email, ( 
                SELECT DATE(p."createdAt") 
                FROM "Photos" p
                WHERE p."user_id" = u.id AND p."isQueued" = false
                ORDER BY p."createdAt" DESC
                LIMIT 1
              ) AS "photo_posted_date"
            FROM "Users" u
            WHERE u."reminder" = true 
            and u."reminderDate" IS NOT NULL
            AND date(u."reminderDate") = current_date
            AND u."isPaid" = false
            AND u."isBlocked" = false
            AND EXISTS (
              SELECT 1 FROM "Photos" p 
              WHERE p."user_id" = u.id  
                AND p."isQueued" = FALSE
            )`;
        
          const user = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT
          });
        
          if(user.length > 0){          
            moment_timezone.updateLocale('en', {
              week: {
                dow: 1 // Monday as the start of the week
              }
            });
            
            const weekStartDate = moment_timezone.tz('America/New_York').clone().startOf('week').format('YYYY-MM-DD');
            const weekEndDate = moment_timezone.tz('America/New_York').clone().endOf('week').format('YYYY-MM-DD');  
          
            for(let i=0; i< user.length; i++){
                try{     
                    await UserModel.update({ 
                      reminder: false, 
                      reminderDate: null
                    }, { 
                          where: { 
                            id: user[i].id
                          } 
                    });  
                    
                    if(!(user[i]['photo_posted_date'] >= weekStartDate  && user[i]['photo_posted_date'] <= weekEndDate)){
                        global.appLogger.info(`[Start] Send Queued Photo Reminder for User ${user[i].email}`);                   
                        const template = {
                            from_email:'support@example.com', 
                            from_name: "Photo Contest", 
                            to_email:user[i].email,
                            subject: 'Your Requested Reminder',
                            body:`<p>Hi! <br><br> As you requested, it’s your friendly Photo Contest bot sending you an email to remind you that this week’s Photo Contest has started.
                            <br><br> If you have a photo that you’d like to include, please visit the Photo Contest (example.com) to get hunting!
                            <br><br> Also, as a friendly reminder if you want to get ahead of future photo posts - our Queue Manager (example.com/queue) let’s you queue up to four weeks of photos at any time (and pick the day of the week).
                              <br><br>If you have any questions, please email us at support@example.com.
                              <br><br>Have a great day! 
                              <br><br>The Photo Contest </p>`
                        }
                        await sendEmail(template); 
                        global.appLogger.info(`[End] Successfully Send Queued Photo Reminder for User ${user[i].email} \n`);
                    }
                }
                catch(err){
                    global.appLogger.error(`Error Sending Queued Photo Reminder Email for User ${user[i].email} \n  ${err.message} \n`);
                }
            }
          }
        }
        catch(err){
          global.appLogger.error(`Error Sending Queued Photo Reminder Email Cron Job ${err.message} \n`);
        }

      try{
        const nowInNY = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
        const isMonday = new Date(nowInNY).getDay() === 1; 
        if(isMonday){
          const currentDate = new Date().toISOString().split('T')[0];
          let users = await UserModel.findAll({
            where:{
              isPaid: true,
              [Op.and]: [
                sequelize.where(sequelize.fn('date', sequelize.col('reminderDate')), '=', currentDate),
                { queued_count: 4 }
              ]
            },
            attributes:['id', 'email']
          });

          for(let j=0;j< users.length; j++){
            try{
                  global.appLogger.info(`[Start] Send 4th Queued Photo Reminder for User ${users[j].dataValues.email}`);
                  const template = {
                    from_email:'support@example.com', 
                    from_name: "The Photo Contest", 
                    to_email:users[j].dataValues.email,
                    subject: `Here's the reminder you requested`,
                    body:`<p>Hi! <br><br> As you requested, it’s your friendly Photo Contest bot sending you an email to remind you that a spot has opened up in your Queue Manager.
                    <br><br> You can now add another photo to your queue to be automatically hunted on the day you wish.
                    <br><br> To do this, just visit the Photo Contest Queue Manager (example.com/queue) to get hunting!
                      <br><br>If you have any questions, please email us at support@example.com.
                      <br><br>Have a great day! 
                      <br><br>The Photo Contest </p>`
                }
                await sendEmail(template); 
                // await UserModel.update({ reminder: false, reminderDate: null, queued_count: null}, { where: { id: users[j].dataValues.id} }); 
                await UserModel.update({ reminder: false, reminderDate: null}, { where: { id: users[j].dataValues.id} }); 
                global.appLogger.info(`[End] Successfully Send 4th Queued Photo Reminder for User ${users[j].dataValues.email} \n`);
            }   
            catch(err){
                global.appLogger.error(`[Error] Sending 4th Queued Photo Reminder for User ${users[j].dataValues.email} \n ${err.message}`);
            }
          }
        }
      }
      catch(err){
        global.appLogger.error(`[Error] Sending 4th Queued Photo Reminder Cron Job \n ${err.message} \n`);
      }
}


// 12:45 am GMT -5 every day
cron.schedule('45 0 * * *', () => {
    sendQueuedPhotoReminder();
  }, {
    scheduled: true,
    timezone: 'America/New_York',
});


async function AddweeklyTopTenInterest(){
  try{
        let where = `(p."createdAt"::timestamp AT TIME ZONE 'America/New_York' >= date_trunc('week', current_date AT TIME ZONE 'America/New_York') 
        - interval '1 week' AND p."createdAt"::timestamp AT TIME ZONE 'America/New_York' <= date_trunc('week', current_date AT TIME ZONE 'America/New_York') - interval '1 microsecond')
        AND (v."createdAt" AT TIME ZONE 'America/New_York' >= date_trunc('week', current_date AT TIME ZONE 'America/New_York') 
        - interval '1 week' AND v."createdAt" AT TIME ZONE 'America/New_York' <= date_trunc('week', current_date AT TIME ZONE 'America/New_York') - interval '1 microsecond')`;
        
        let query = `SELECT (SELECT jsonb_agg(jsonb_build_object('photo_id', p.id, 
          'user_id', p.user_id, 'photo_url', p.photo_url,'name', u.name, 'member_id', u."member_id", 
          'winner_count',u."winner_count")) as most_upvoted_photos 
          FROM (
            SELECT p.id, p.user_id, p.photo_url, MAX(v."createdAt") as upvoted_date
            FROM "Photos" p JOIN "Votes" v ON p.id = v.photo_id
            WHERE ${where} AND p."isDeleted" = false and p."isQueued" = false
            GROUP BY p.id
            ORDER BY (Select count(*) from "Votes" v inner join "Photos" p1 on p1."id"= v."photo_id"
            where photo_id= p.id and ${where}) DESC, upvoted_date DESC
            LIMIT 10
          ) AS p
          JOIN "Users" u ON u.id = p.user_id
          WHERE u."isBlocked"= false)`;

          global.appLogger.info(`\n ---- Start Executing WeeklyTopTen Interest -----`);
          const user = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT
          });

          const userList = user[0]['most_upvoted_photos'];
          if(userList != null) {
            const adminUser = await UserModel.findOne({
              where:{
                email:'admin@example.com'
              },
              attributes:['id']
            });
            
            const firstWeekTopTenInterest = await findOrCreateInterest('BPH Master: User Profile Completions', 'First_Weekly_Top_Ten');
            const weeklyTopTenInterest = await findOrCreateInterest('BPH Master: User Profile Completions', 'Weekly_Top_Ten');               
            
            for(let i=0;i<userList.length;i++){
              try {
                  global.appLogger.info(`User with member_id ${userList[i].member_id} is in week top ten`);
                  let currentInterests = await getMemberProfile(userList[i].member_id);  
                  if(userList[i].winner_count == 0){
                      currentInterests[firstWeekTopTenInterest.interestId] = true;
                  }

                  await UserModel.update({winner_count: userList[i].winner_count + 1},
                    {
                        where:{
                            id: userList[i].user_id
                        }
                  });
                
              
                try {
                    await updateHuntScorePoints(userList[i].user_id, 'weekly_top_ten', 10);
                    await incrementHuntScorePoints(userList[i].user_id, 10);
                }
                catch(err){
                    throw err;
                }
          
                
                await GalleryPhotoModel.update({
                    isHunted:false,
                    isWeeklyTopTen:true
                  }, 
                  {
                    where:{
                      photo_url:userList[i].photo_url
                    }
                }) 
                    
                
                  
                const createdAt = moment().tz('America/New_York').startOf('day').toDate(); 
                let notification = await NotificationModel.create({
                    receiver_id: userList[i].user_id,
                    notification_type: 'weekly_top_ten',
                    photo_id: userList[i].photo_id,
                    sender_id: userList[i].user_id,
                    createdAt: createdAt, 
                    updatedAt: createdAt
                },{ silent: true });

                try{
                    let query = `Select n."id", n."notification_type", n."is_seen",
                        json_build_object(
                            'id', u."id",
                            'notification_createdAt', TO_CHAR(n."createdAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                            'receiver_id', n."receiver_id",
                            'sender_id', n."sender_id",
                            'photo_owner_id', p."user_id",
                            'login_username', (Select "name" from "Users" u1 where u1."id"='${userList[i].user_id}'),
                            'login_photo_url', (SELECT CASE 
                                WHEN LENGTH(u1."compressedProfilePic") > 0 THEN u1."compressedProfilePic" 
                                ELSE u1."photo_url"  END 
                                FROM "Users" u1 
                                WHERE u1."id"='${userList[i].user_id}'
                            )
                        ) AS message
                        from "notifications" n
                        left join "Users" u on n."sender_id"= u."id"
                        left join "Photos" p on p."id"= n."photo_id"
                        where n."id"='${notification.dataValues.id}'`;
                              
                    await updateUserNotifications(query, userList[i].user_id);
                }
                catch(err){
                  console.log(err.message);
                }
                
                const getAllFollowers = await FollowersModel.findAll({
                  where:{
                    follower_id:userList[i].user_id,
                    is_active:true
                  },
                  attributes:['user_id']
                });

                if(getAllFollowers != null){
                  for(let j=0;j<getAllFollowers.length; j++){
                      try{
                        const follower_id = getAllFollowers[j]['dataValues']['user_id'];
                        if(userList[i].user_id != adminUser.id){
                            let followerNotification = await NotificationModel.create({
                              receiver_id: follower_id,
                              notification_type: 'follower_in_weekly_top_ten',
                              photo_id:userList[i].photo_id,
                              sender_id:userList[i].user_id,
                              createdAt: createdAt, 
                              updatedAt: createdAt
                            }, { silent: true });

                            try{                   
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
                                    'photo_owner_id', p."user_id",
                                    'photo_id', p."id",
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
                                where n."id"='${followerNotification.dataValues.id}'`;

                                await updateUserNotifications(query, follower_id);
                            }
                            catch(err){
                              console.log(err.message);
                            }
                          }
                      }
                      catch(err){
                        console.log(err.message)
                       }
                  }
              }
            
              currentInterests[weeklyTopTenInterest.interestId] = true;
              await updateMemberProfile(userList[i].member_id, {interests: currentInterests});  
              global.appLogger.info(`User with member_id ${userList[i].member_id} has assigned week top ten interest`);
              
                               
            }
            catch(err){
              global.appLogger.error(`[Error] Adding Weekly Top Ten Interest for User ${userList[i].user_id} \n ${ err.message} \n`);
            }       

          
         } 
         global.appLogger.info('[End] Successfully Executed weeklyTopTen Interest \n'); 
         
       } 
    }
    catch(err){
        global.appLogger.error(`[Error] Adding Weekly Top Ten Interest ${err.message } \n`);
    }
}



cron.schedule('5 1 * * 1', () => {
  // run every monday at 1:05 am
  AddweeklyTopTenInterest();
}, {
  scheduled: true,
  timezone: 'America/New_York',
});






async function sendUnviewedNotificationEmail(){
    try{
        let offset = 0; 
        const limit = 500;
        const secretKey = await getSecrets();
        const mailchimpListId = secretKey.listId;

        while (true) {      
          let query = `SELECT DISTINCT u."id", u."member_id"
          FROM "Users" u INNER JOIN "notifications" n ON u."id" = n."receiver_id"
          WHERE 
            (Select count(*) from "notifications" where "text"='regular' and "receiver_id"=u."id" and "is_seen"=false) >=1 
            AND (u."createdAt"::timestamp with time zone < (CURRENT_TIMESTAMP - INTERVAL '2 days')) 
            AND (u."activity_viewed" IS NULL OR (u."activity_viewed"::timestamp with time zone < (CURRENT_TIMESTAMP - INTERVAL '2 days')))
          GROUP BY u.id
          HAVING COUNT(n.id) > 0
          OFFSET ${offset}
          LIMIT ${limit}`;

          const usersList = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT
          });

          if (!usersList.length) {
            global.appLogger.info(`\n ----- [End]  Unviewed Notification Interest No more users found. -----`);
            break;
          }

           global.appLogger.info(`\n ----- Start Unviewed Notification Interest for ${usersList.length} users (offset=${offset}) -----`);

  
            const interests = await findOrCreateInterest('BPH Master: User Profile Completions', 'Activity_Page_Notification');
            if(interests){
              for(let i=0; i< usersList.length; i++){
                  try{
                      let currentInterests = await getMemberProfile(usersList[i].member_id, mailchimpListId);  
                      if(currentInterests && currentInterests[interests.interestId] == false){
                          currentInterests[interests.interestId] = true;
                          await updateMemberProfile(usersList[i].member_id, {interests: currentInterests}, mailchimpListId);   
                          global.appLogger.info(`[End] User with member_id ${usersList[i].member_id} has assigned unviewed notification interest \n`);
                      }
                  }
                  catch(error){
                    global.appLogger.error(`[Error] Assigning Unviewed Notification Interest For MemberId ${usersList[i].member_id} ${error.message } \n`);
                   }
              }
            }

            global.appLogger.info(`[End] Assigning Unviewed Notification Interest at offset ${offset}\n`);

            offset += limit;                 
        }
    }
    catch(err){ 
        global.appLogger.error(`[Error] Assigning Unviewed Notification Interest ${err.message } \n`);
    }
}



cron.schedule('30 12 * * 6', () => {
  // run every Saturday at 12:30 PM UTC
  sendUnviewedNotificationEmail();
}, {
  scheduled: true,
  timezone: "UTC" 
});





async function addUpvotedScoreInterest(){
  try{
    global.appLogger.info(`\n Starting Add Upvoted Score Interest Function ------`); 
    let noOfUpvotesReceived = `(SELECT COUNT(*) FROM "Votes" uv JOIN "Photos" ph ON uv.photo_id = ph.id WHERE ph.user_id = u.id
      and uv."createdAt" >= DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE 'UTC' - INTERVAL '5 hours')
      and uv."is_vote"=true and ph."isQueued"=false)`;
    
    let query = `SELECT u."id", u."name", u."email", u."member_id", u."createdAt",
      ${noOfUpvotesReceived} AS "no. of upvotes received"
      FROM "Users" u
      LEFT JOIN "Photos" p ON u.id = p.user_id AND p."isQueued" = false
      LEFT JOIN "Votes" uv ON p.id = uv.photo_id
      WHERE u."isBlocked" = false
      GROUP BY u.id
      having ${noOfUpvotesReceived} > 0
      order by "no. of upvotes received" DESC`;

    const mostUpvotedUsers = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });


    const totalUsers = mostUpvotedUsers.length;
    const top5Users = Math.round(totalUsers * 0.08);
    const top10Users = Math.round(totalUsers * 0.15);
    const top25Users = Math.round(totalUsers * 0.35);

    if(top5Users > 0){
        let monthlyTop5PercentInterest = await findOrCreateInterest('User Activity Notifications', 'Monthly_Top_5%');
        if(monthlyTop5PercentInterest){
            for(let i=0; i<top5Users; i++){    
                try{
                  let currentInterests = await getMemberProfile(mostUpvotedUsers[i].member_id);  
                  if(currentInterests){
                    currentInterests[monthlyTop5PercentInterest.interestId] = true;
                    await updateMemberProfile(mostUpvotedUsers[i].member_id, {interests: currentInterests});  
                  }
                }
                catch{}
            }
        }
    }

    if (top10Users > 0) {
      const monthlyTop10PercentInterest = await findOrCreateInterest('User Activity Notifications', 'Monthly_Top_10%');     
      if(monthlyTop10PercentInterest){
          for(let i= top5Users; i< top5Users + top10Users; i++) { 
            try{
              let currentInterests = await getMemberProfile(mostUpvotedUsers[i].member_id);  
              if(currentInterests){
                currentInterests[monthlyTop10PercentInterest.interestId] = true;
                await updateMemberProfile(mostUpvotedUsers[i].member_id, {interests: currentInterests}); 
              }
            }
            catch{} 
        }
      }
    }

    if(top25Users > 0){
        const monthlyTop25PercentInterest = await findOrCreateInterest('User Activity Notifications', 'Monthly_Top_25%');    
        if(monthlyTop25PercentInterest){
            for(let i= top5Users + top10Users; i< top5Users + top10Users + top25Users; i++){       
              try{
                let currentInterests = await getMemberProfile(mostUpvotedUsers[i].member_id);  
                if(currentInterests){
                  currentInterests[monthlyTop25PercentInterest.interestId] = true;
                  await updateMemberProfile(mostUpvotedUsers[i].member_id, {interests: currentInterests});  
                }
              }
              catch{}
            }
        }
    }

    global.appLogger.info(`[End] Add Upvoted Score Interest Function \n`); 
  }
  catch(err){
    global.appLogger.error(`[Error] Add Upvoted Score Interest Function ${err.message} \n`); 
  }
}



cron.schedule('0 2 19 * *', () => {
 // run at 19 day at 2am
  addUpvotedScoreInterest();
}, {
  scheduled: true,
  timezone: "America/New_York"
});


async function notifyInactiveUsers(){
      try{
          global.appLogger.info(`\n Starting Notify Inactive Users Function ------`); 
          const cutoffDate = new Date();
          cutoffDate.setDate( new Date().getDate() - 56);

          // Format cutoffDate to a string that PostgreSQL can understand
          const eightWeeksAgo = cutoffDate.toISOString().replace('T', ' ').split('.')[0]; 
        
          global.appLogger.info(`cutOffDate ${eightWeeksAgo}`);
        
          // Query users who have not visited in 56 days       
          let query = `SELECT u.id
            FROM "Users" u
            LEFT JOIN (
              SELECT DISTINCT ON (n."receiver_id") n."receiver_id", n."createdAt"
              FROM "notifications" n
              WHERE n."notification_type" = 'Inactive for 56 days'
              ORDER BY n."receiver_id", n."createdAt" DESC
            ) latest_n
            ON latest_n."receiver_id" = u."id"
            WHERE u."lastVisitTime" < '${eightWeeksAgo}'
            AND (
              latest_n."createdAt" IS NULL 
              OR latest_n."createdAt" < NOW() - INTERVAL '56 days'
            )`;

            const inactiveUsers = await sequelize.query(query, {
              type: sequelize.QueryTypes.SELECT
            });
          
          
          if(inactiveUsers.length) {
              const senderUser = await UserModel.findOne({
                where:{
                  email: 'admin@example.com'
                },
                attributes:['id']
              });
              const senderId = senderUser['dataValues']['id'];
              const notificationInterest = await findOrCreateInterest('BPH Master: User Profile Completions', 'Activity_Page_Notification');
              // Create a notification for each inactive user
              const notifications = [];

              for(let i=0; i< inactiveUsers.length; i++){
                    const user = inactiveUsers[i];          
                    try{
                        global.appLogger.info(`[Start] Adding Unviewed Notification Interest for User Id ${user.id}`)
                        let currentInterests = await getMemberProfile(user.member_id);  
                        if (currentInterests && currentInterests[notificationInterest.interestId] == false){
                            currentInterests[notificationInterest.interestId] = true;
                            await updateMemberProfile(user.member_id, {interests: currentInterests});   
                            global.appLogger.info(`[End] User with member_id ${user.member_id} has assigned Unviewed Notification Interest \n`);                   
                        }

                            notifications.push ({
                              sender_id: senderId,
                              receiver_id: user.id,
                              notification_type: 'Inactive for 56 days',
                              text: 'regular'
                            });
                        
                       
                    }
                    catch(err){
                        global.appLogger.error(`[Error] Adding Unviewed Notification Interest for User Id ${user.id} \n ${err.messsage} \n`); 
                        return null; // Skip this notification
                    }
              }

              // Save notifications in the database
              const validNotifications = (await Promise.all(notifications)).filter(Boolean);
              const createdNotifications = await NotificationModel.bulkCreate(validNotifications, { individualHooks: true, returning: true });
              for (let j = 0; j < createdNotifications.length; j++) {
               try{
                  const query = `Select n."id", n."notification_type", n."createdAt", n."updatedAt", n."is_seen",
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
                              'genres_list', (
                                  SELECT json_object_agg(genre, genre)
                                  FROM unnest(string_to_array(u."genres_list", ',')) AS genre
                              ),
                              'camera_brand', u."camera_brand"
                          ) AS message
                          from "notifications" n
                          left join "Users" u on n."sender_id"= u."id"
                          WHERE n."id" = '${createdNotifications[j].id}'`;
              
                      await updateUserNotifications(query, createdNotifications[j].receiver_id);
                  }
                  catch(err){
                    console.log(err.message);
                  }
              }
          }
          global.appLogger.info(`[End] All Notifications Inserted Successfully \n`)
      }
      catch(err){
          global.appLogger.error(`[Error] Notify Inactive User ${err.message} \n`); 
      }
}




cron.schedule('0 2 * * *', () => {
  //run every day at 2am
 notifyInactiveUsers();
}, {
  scheduled: true,
  timezone: 'America/New_York',
});



async function updateConsecutivePhotoPostHuntScore(){
    try{
          global.appLogger.info(`\n ----- Start Updating Consecutive Photo Post Hunt Scores ----- \n`);
          const startOfLastMonth = moment_timezone.tz('America/New_York').subtract(1, 'month').startOf('month').utc().toDate();
          const endOfLastMonth = moment_timezone.tz('America/New_York').subtract(1, 'month').endOf('month').utc().toDate();
        
          // Query to find users with exactly 4 photos uploaded last month
          const usersWith4Photos = await PhotoModel.findAll({
              where: {
                createdAt: {
                  [Op.gte]: startOfLastMonth,
                  [Op.lt]: endOfLastMonth,
                },
                isQueued:false
              },
              attributes: ['user_id'],
              group: ['user_id'],
              having: sequelize.where(sequelize.fn('COUNT', sequelize.col('id')), 4),
          });
        

          for (const user of usersWith4Photos) {
              try{
                global.appLogger.info(`[Start] Adding Consecutive 4 Weeks Hunt Score for User ${user.user_id}`);
                await updateHuntScorePoints(user.user_id, 'consecutive_photo_post', 15);
                await incrementHuntScorePoints(user.user_id, 15);
                
              }
              catch(err){
                global.appLogger.error(`[Error] Adding Consecutive 4 Weeks Hunt Score for User ${user.user_id} \n  ${err.message} \n`);
              }
          }
          global.appLogger.info(`[End] Successfully Updated Consecutive 4 Weeks Hunt Score For Users \n`);
    }
    catch(err){
      global.appLogger.error(`[Error] Updating Consecutive 4 Weeks Hunt Score ${err.message} \n`);
    }
}



cron.schedule('45 2 1 * *', () => {
    //run 1st day of every month at 2: 45am
    updateConsecutivePhotoPostHuntScore();
  }, {
    scheduled: true,
    timezone: 'America/New_York',
  });



  async function runNoPhotoPostTaggingJob() {
      try{
          global.appLogger.info(`\n ---- Start Executing 6_weeks_no_photo_posts Function-----`);
          const users = await PhotoModel.findAll({
            attributes: ['user_id', [sequelize.col('User.member_id'), 'member_id']],
            where: sequelize.literal(` "Photo"."id" = (
                SELECT p2."id"
                FROM "Photos" p2
                WHERE p2."user_id" = "Photo"."user_id"
                  AND p2."isDeleted" = false
                ORDER BY p2."createdAt" DESC
                LIMIT 1
              )
              and "Photo"."createdAt"::timestamp <= NOW() - INTERVAL '6 weeks'`),
            include: [
              {
                model: UserModel, 
                attributes: [], 
                required: true 
              }
            ],
            raw: true
          });

          if(users.length){
              let tagName = '6_weeks_no_photo_posts';
              const secretKey = await getSecrets();
              if(secretKey){
                  for(let i=0; i<users.length; i++){
                      try{
                            const response = await mailchimp.lists.getListMemberTags(secretKey.listId, users[i]['member_id']);
                            const currentTags = response.tags.map(tag => tag.name);
                            if (!currentTags.includes(tagName)) {
                              await manageTags(users[i]['member_id'], secretKey.listId, tagName, 'active');
                              global.appLogger.info(`Successfully Added 6_weeks_no_photo_posts Tag for userId ${users[i]['user_id']} \n`);
                            }
                      }
                      catch(err){
                          global.appLogger.error(`[Error] Adding 6_weeks_no_photo_posts Tag for userId ${users[i]['user_id']} ${err.message } \n`);
                      }
                  }
                  global.appLogger.info(`[End] Successfully Executed 6_weeks_no_photo_posts Function \n`);
              }
                
          }
      }
    catch(err){
      global.appLogger.error(`[Error] Executing No Photo Post since 6 weeks  ${err.message } \n`);
    }
  }

  cron.schedule('30 3 * * *', () => {
    // run every day at 3:30 am
  runNoPhotoPostTaggingJob();
  }, {
    scheduled: true,
    timezone: 'America/New_York',
  });



  async function updateHuntScoreRankings(){
    try{
        global.appLogger.info(`[Start] Updating Hunt Score Rankings For All Users \n`)

        let query = `WITH thresholds AS (
            SELECT
                PERCENTILE_CONT(0.05) WITHIN GROUP (ORDER BY total_hunt_scores DESC) AS top_5_percent,
                PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY total_hunt_scores DESC) AS top_10_percent,
                PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY total_hunt_scores DESC) AS top_25_percent
            FROM "Users"
            WHERE total_hunt_scores > 0
            )
            UPDATE "Users" SET hunt_score_ranking = CASE
                WHEN total_hunt_scores >= (SELECT top_5_percent FROM thresholds) THEN 'Top 5%'
                WHEN total_hunt_scores >= (SELECT top_10_percent FROM thresholds) THEN 'Top 10%'
                WHEN total_hunt_scores >= (SELECT top_25_percent FROM thresholds) THEN 'Top 25%'
                ELSE NULL
            END
            WHERE total_hunt_scores > 0`;

          await sequelize.query(query, 
          {
                type: sequelize.QueryTypes.SELECT,
          });

          global.appLogger.info(`[End] Successfully Updated Hunt Score Rankings For All Users \n`)
    }
    catch(err){
      global.appLogger.error(`[Error] Updating Hunt Score Rankings ${err.message} \n`)
    }
  }


cron.schedule('30 6 * * *', () => {
    //run every day at 6:30 am
  updateHuntScoreRankings();
  }, {
    scheduled: true,
    timezone: 'America/New_York',
  });




  async function notifyComingNextPhotos(){
    try{
          global.appLogger.info(`--- [Start] Notifying Coming Next Photos Cron Job ---\n`);
          let usersQuery = `SELECT pn.user_id, u.email, u.name,
            json_agg( json_build_object(
                'photo_id', pn.photo_id,
                'photo_member_id', pn.photo_member_id )
            ) AS photos
            FROM photo_notifications pn
            INNER JOIN "Users" u ON u.id = pn.user_id
            WHERE u."isBlocked" = false AND pn.is_notify = true 
              AND pn.photo_id = ( SELECT id FROM "Photos" p
                WHERE p."isQueued" = false AND p."user_id" = pn.photo_member_id
                ORDER BY p."createdAt" DESC 
                LIMIT 1
              )
            GROUP BY pn.user_id, u.email, u.name`;
      
          const usersList = await sequelize.query(usersQuery, {
              type: sequelize.QueryTypes.SELECT
          });

          if(usersList.length){    
              for (let i=0; i<usersList.length; i++){
                  try{
                    global.appLogger.info(`[Start] Notifying Coming Next Photo to User ${usersList[i]['user_id']}`)
                
                    let userProfile = '';
                    let userPhotos = usersList[i]['photos'];
                    for(let j=0; j<userPhotos.length; j++){
                        let user = await UserModel.findOne({
                            where:{
                              id: userPhotos[j]['photo_member_id']
                            },
                            attributes:['id', 'name', 'profileCode']
                        });

                        let userProfileUrl;
                        if(user){
                          if(usersList[i]['user_id'] == userPhotos[j]['photo_member_id']){
                              userProfileUrl = `${Env.Base_Url}/profile`;
                          }
                          else{
                              let profileCode = user.dataValues.profileCode;
                              if(!profileCode){
                                  profileCode = await generateUniqueShortCode();
                                  await UserModel.update(
                                    { profileCode: profileCode },
                                    { where: { 
                                      id: user.dataValues.id } 
                                    }
                                  );
                              }
                              userProfileUrl = `${Env.Base_Url}/otherusers-profile?profile=${profileCode}`;
                          }
                          userProfile += `• <a href="${userProfileUrl}" target="_blank">${user.dataValues.name}</a><br>`;

                          await PhotoNotificationsModel.update({
                            is_notify: false
                          }, {
                            where:{
                              user_id: usersList[i]['user_id'],
                              photo_id: userPhotos[j]['photo_id']
                            }
                          });
                      }
                    }
     
                    let firstName = usersList[i]['name'].split(' ')[0];
                    const template={
                        from_email:'support@example.com', 
                        from_name: "Photo Contest", 
                        to_email: usersList[i]['email'], 
                        subject:'They’re up! The photos you were waiting for.', 
                        body:`<p>Hi ${firstName} —
                        <br><br> Happy Monday! I’m your friendly Photo Contest bot here with an update.
                        <br><br> You asked to be notified when certain photos from the <b>Coming Up </b> feed went live - well, they just landed in this week’s hunt.
                        <br><br> Here are the photographers you were watching:
                        <br><br> ${userProfile}
                        <br> Go give their photos a look - and maybe an upvote or better, a comment. I know they’d love to hear from you.
                        <br><br>Enjoy,
                        <br>The Photo Contest Bot</p>`
                    }
                    await sendEmail(template);
                    global.appLogger.info(`[End] Successfully Notifying Coming Next Photo to User ${usersList[i]['user_id']}`)
                }
                catch(err){
                  global.appLogger.info(`[Error] Notifying Coming Next Photo to User ${usersList[i]['user_id']} ${err.message} \n`)
                }            
              }

              global.appLogger.info(`[End] Successfully Notifying Coming Next Photos to All Users \n`);
          }
    }
    catch(err){
      global.appLogger.error(`[Error] Notifying Coming Next Photos Cron Job ${err.message} \n`)
    }
  }


// run every Monday at UTC 7PM
cron.schedule('0 19 * * 1', () => {
  notifyComingNextPhotos();
}, {
scheduled: true,
timezone: 'UTC' 
});


async function bottom50PercentUpvotesTaggingJob(){
  try{
        global.appLogger.info(`\n ---- Start Executing Bottom 50 Percent Upvotes Tagging Job -----`);

        moment_timezone.updateLocale('en', {
            week: {
                  dow: 1 // Monday as the start of the week
            }
        });
        
        const lastWeek = moment_timezone.tz('America/New_York').subtract(1, 'week');

        const weekStartDate = lastWeek.clone().startOf('week').startOf('day').toDate();;
        const weekEndDate   = lastWeek.clone().endOf('week').endOf('day').toDate();


        const photos = await PhotoModel.findAll({
          attributes: [
            'id',
            'user_id',
            [Sequelize.fn('COUNT', Sequelize.col('Votes.id')), 'voteCount'],
          ],
          include: [
            {
              model: VoteModel,
              attributes: [],
              required: false,
              where: { is_vote: true },   
            },
            {
              model: UserModel,
              attributes: [],
              required: true,              
              where: { isBlocked: false }, 
            },
          ],
          where: {
            isQueued: false,            
            isDeleted: false,           
            createdAt: { [Op.between]: [weekStartDate, weekEndDate] },
          },
          group: ['Photo.id'],
          order: [[Sequelize.literal('"voteCount"'), 'ASC'],
                  ['createdAt', 'ASC']
          ],
          raw: true,
        });


        if (photos.length === 0) {
          global.appLogger.info('No photos found for last week.');
          return;
        }

        // 2. Get bottom 50% photos
        const halfIndex = Math.ceil(photos.length / 2);
        const bottomPhotos = photos.slice(0, halfIndex);

        // 3. Get distinct user IDs
        const userIds = [...new Set(bottomPhotos.map(p => p.user_id))];
        if (userIds.length === 0) {
          global.appLogger.info('No users found in bottom 50%.');
          return;
        }

        // 4. Get users with emails
        const users = await UserModel.findAll({
          where: { id: userIds },
          attributes: ['id', 'member_id', 'email'],
          raw: true,
        });

        let secretKey = await getSecrets();
        if(!secretKey){
          global.appLogger.error('Mailchimp Secret Key or List ID not found. Exiting job.');
          return;
        }

        // 5. Tag users in Mailchimp
        for (const user of users) {
          try{
              global.appLogger.info(`[Start] Adding Bottom50%Upvotes Tag to User ${user.email}`);
              await manageTags(user.member_id, secretKey.listId, 'Weekly_Bottom_50%', 'active');
              global.appLogger.info(`[End] Successfully Added Bottom50%Upvotes Tag to User ${user.email}`);
          }
          catch(err){
            global.appLogger.error(`[Error] Adding Bottom50%Upvotes Tag to User ${user.email} \n ${err.message } \n`);
          }
        }

        global.appLogger.info(`[End] Succesfully Added Bottom50%Upvotes Tag to All Users \n`);

    }
    catch(err){
      global.appLogger.error(`[Error] Executing Bottom 50 Percent Upvotes Tagging Job \n ${err.message } \n`);
    }
}


//cron.schedule('*/1 * * * *', () => {
// run every Monday at UTC 11am

 cron.schedule('0 11 * * 1', () => {
  bottom50PercentUpvotesTaggingJob();
}, {
scheduled: true,
timezone: 'UTC' 
});


async function sendVaultMonthlyAuditEmail() {
  try{

        const query = `WITH user_photo_stats AS (
            SELECT pw.user_id, usr.email, pw.user_name, split_part(pw.user_name, ' ', 1) AS first_name,
                  SUM(
                    CASE 
                      WHEN p."actionType" = 'Upload' THEN p."fileCount" 
                      ELSE 0 
                    END
                  ) AS total_photos_stored,
                  SUM(
                    CASE 
                      WHEN p."actionType" = 'Upload'
                      AND DATE_TRUNC('month', p."createdAt") = DATE_TRUNC('month', CURRENT_DATE)
                      THEN p."fileCount"
                      ELSE 0
                    END
                  ) AS photos_uploaded_this_month,
                  SUM(
                    CASE 
                      WHEN p."actionType" = 'Upload'
                      AND DATE_TRUNC('month', p."createdAt") = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                      THEN p."fileCount"
                      ELSE 0
                    END
                  ) AS photos_uploaded_last_month,
                  SUM(
                    CASE 
                      WHEN p."actionType" = 'Download'
                      AND DATE_TRUNC('month', p."createdAt") = DATE_TRUNC('month', CURRENT_DATE)
                      THEN p."fileCount"
                      ELSE 0
                    END
                  ) AS photos_downloaded_this_month,
                  COUNT(
                    CASE 
                      WHEN p."actionType" = 'Deleted'
                      AND DATE_TRUNC('month', p."createdAt") = DATE_TRUNC('month', CURRENT_DATE)
                      THEN 1 
                    END
                  ) AS photos_deleted_this_month,
                  TO_CHAR(
                      MAX(
                        CASE 
                          WHEN p."actionType" = 'Upload' THEN p."createdAt"
                          ELSE NULL
                        END
                      ),
                      'MM-DD-YYYY HH24:MI'
                  ) AS last_uploaded_date,
                  TO_CHAR(
                    MAX(
                      CASE 
                        WHEN p."actionType" = 'Download' THEN p."createdAt"
                        ELSE NULL
                      END
                    ),
                    'MM-DD-YYYY HH24:MI'
                  ) AS last_downloaded_date,
                  MIN(
                      CASE 
                        WHEN p."actionType" = 'Upload' THEN p."createdAt"
                      END
                  ) AS first_upload_date
              FROM "Personal_Websites" pw
              INNER JOIN "Users" usr ON pw.user_id = usr.id
              INNER JOIN "photo_vault_logs" p ON pw.user_id = p.user_id
              WHERE pw.is_monthly_file_audit_email = true
              GROUP BY pw.user_id, usr.email, pw.user_name
              HAVING SUM(
                  CASE WHEN p."actionType" = 'Upload' THEN p."fileCount" ELSE 0 END
              ) >= 25
          )
              


          SELECT *, (photos_uploaded_this_month - photos_uploaded_last_month) AS change_from_last_month,
           TRIM(
              CASE
                WHEN DATE_PART('year', AGE(NOW(), first_upload_date)) >= 1 THEN
                  DATE_PART('year', AGE(NOW(), first_upload_date))::int || ' year' ||
                    CASE WHEN DATE_PART('year', AGE(NOW(), first_upload_date))::int > 1 THEN 's ' ELSE ' ' END ||
                  DATE_PART('month', AGE(NOW(), first_upload_date))::int || ' month' ||
                    CASE WHEN DATE_PART('month', AGE(NOW(), first_upload_date))::int > 1 THEN 's' ELSE '' END

                WHEN DATE_PART('month', AGE(NOW(), first_upload_date)) >= 1 THEN
                  DATE_PART('month', AGE(NOW(), first_upload_date))::int || ' month' ||
                    CASE WHEN DATE_PART('month', AGE(NOW(), first_upload_date))::int > 1 THEN 's' ELSE '' END

                WHEN DATE_PART('day', AGE(NOW(), first_upload_date)) >= 1 THEN
                  DATE_PART('day', AGE(NOW(), first_upload_date))::int || ' day' ||
                    CASE WHEN DATE_PART('day', AGE(NOW(), first_upload_date))::int > 1 THEN 's' ELSE '' END

                WHEN DATE_PART('hour', AGE(NOW(), first_upload_date)) >= 1 THEN
                  DATE_PART('hour', AGE(NOW(), first_upload_date))::int || ' hour' ||
                    CASE WHEN DATE_PART('hour', AGE(NOW(), first_upload_date))::int > 1 THEN 's' ELSE '' END

                ELSE
                  'less than an hour'
              END
            ) AS vault_usage_duration
          FROM user_photo_stats`;

        const users = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT,
        });

        for(const user of users){
             const template= {
                from_email:'support@example.com', 
                from_name: "Photo Contest Vault", 
                to_name: `${user.user_name}`,
                to_email:  `${user.email}`,
                subject:'VAULT - Monthly Audit Email', 
                body:`<p>Hi ${user.first_name} —
                        <br><br> Each month, we send you this Photo Contest Vault Audit — a quick snapshot of the photos you have 
                                stored in the Vault so you can stay confident knowing your photos 
                                are safe and sound in the cloud.
                        <br><br> (Just a reminder: you can turn these emails on or off anytime in your [Vault settings].)
                        <br><br> You've been using the Vault for ${user.vault_usage_duration}. Here's your current status:
                        <br> &bull;  Total Photos Stored: ${user.total_photos_stored}
                        <br> &bull; Change from Last Month: ${user.change_from_last_month}
                        <br> &bull; Photos Uploaded This Month: ${user.photos_uploaded_this_month}
                        <br> &bull; Photos Downloaded This Month: ${user.photos_downloaded_this_month}
                        <br> &bull; Photos Deleted This Month: ${user.photos_deleted_this_month}
                        <br> &bull; Last Upload: ${user.last_uploaded_date}
                        <br> &bull; Last Download: ${user.last_downloaded_date}
                        <br><br> All of your photos are secure and fully backed up in the Photo Contest Vault. 
                            No action is needed.
                        <br><br> It's always smart to keep an off-site backup. If you've taken new shots you're proud of, 
                            now's a great time to upload and keep your archive up to date.
                        <br><br> 👉 [Add More Photos to Your Vault]
                        <br><br> We 'll send your next audit in a month. If you'd rather not receive these, you can toggle them off in your [Vault settings].
                        <br><br> Thanks for being part of the Photo Contest!
                        <br> — The Photo Contest Gang
                      </p>`
              }
              await sendEmail(template);
              global.appLogger.info(`Successfully Send Monthly Audit Email To User ${user.user_id} \n`);
        }

        global.appLogger.info(`[End] Successfully Send Monthly Audit Email To All Users.`);

  }
  catch(err){
      global.appLogger.error(`[Error] Sending Vault Monthly Audit Email \n ${err.message} \n`)
  }
  
}

// runs at every friday at 1am UTC
cron.schedule('0 1 * * 5', async () => {

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();

    // Calculate the last Friday of the current month
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)); // last day of current month
    const dayOfWeek = lastDayOfMonth.getUTCDay(); // 0 = Sun, 5 = Fri
    const offset = (dayOfWeek >= 5) ? dayOfWeek - 5 : dayOfWeek + 2; // days to subtract
    const lastFriday = new Date(lastDayOfMonth);
    lastFriday.setUTCDate(lastDayOfMonth.getUTCDate() - offset);

    // Check if today is that last Friday
    const isLastFriday =
      now.getUTCDate() === lastFriday.getUTCDate() &&
      now.getUTCMonth() === lastFriday.getUTCMonth();

  if (isLastFriday) {
      global.appLogger.info(`[Start] Running Monthly Audit Email Job on ${now.toUTCString()}`);
    try {
        await sendVaultMonthlyAuditEmail();
    } 
    catch (err) {
        global.appLogger.error(`[Error] Monthly Audit Email \n ${err.message} \n`);
    }
  }
}, {
  scheduled: true,
  timezone: 'UTC',
});


   async function CalculateTopRankedPhotos(){
      try{
         global.appLogger.info(`[Start] Calculating Top Ranked Photos of Paid Members`);

         await CalculateTop6RankedPhotos();

         global.appLogger.info(`[End] Successfully Calculated Top Ranked Photos of Paid Members`);
      }
      catch(err){
          global.appLogger.error(`[Error] Calculating Top Ranked Photos of Paid Members ${err.message}`);
      }
   }


  cron.schedule('5 0 * * 1', () => {
    CalculateTopRankedPhotos();
  }, {
    scheduled: true,
    timezone: 'America/New_York',
});
  



server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    
});




// Handle uncaught exceptions 
process.on('uncaughtException', (err) => {
  console.log(err.message)
  global.appLogger.error(`Uncaught Exception! Shutting down the server...\nError message: ${err.message}\nStack trace: ${err.stack}\n`);
  
  server.close(() => {
    process.exit(1); // Exit the process after shutting down the server
  });
});


process.on('unhandledRejection', (err) => {
  global.appLogger.error(`Unhandled Promise Rejection! Shutting down the server...\nError details: ${err.message}\nStack trace: ${err.stack}\n`);
  
  server.close(() => {
    process.exit(1); // Exit after the server is closed
  });
});


// Capture and log Node.js warnings
process.on('warning', (warning) => {
  global.appLogger.warn(`Warning: ${warning.name} - ${warning.message}\n${warning.stack}`);
});


