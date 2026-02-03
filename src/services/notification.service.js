import baseService from './base.service';
import { sequelize } from '../utils/database';
import {getUserRegularNotifications, getUserPhotoNotifications, updateUserNotifications, 
    getActiveAdminNotifications
} from '../utils/genericFunctions';
import { literal } from 'sequelize';  

export class notificationService extends baseService {

    
    async viewAllNotifications(req){
        try{       
            global.appLogger.info(`\n ---- Start Fetching User Activity Api Call by User with Id ${req.userData._id} ----`);

            const { newAdminNotifs, regularAdminNotifs } = await getActiveAdminNotifications(req.userData._id);

            const pageOffset = req.body.offset || 0;
            let notificationResults = [];
            let photoIndex = 0;
            let textCounter = 0;
            let remainingOffset = pageOffset;
            let notificationSet = req.body?.notificationSet  ?? false;
            

            let RegularNotificationResult = [];
            let PhotoNotificationResult = [];
            let regular_notifications = [];
            let photo_notifications = [];
        

            let newAdminSlice = [];
            if (newAdminNotifs.length > 0) {
                if (remainingOffset < newAdminNotifs.length) {
                    newAdminSlice = newAdminNotifs.slice(remainingOffset, remainingOffset + 10);
                }
            }

            const user = await this._userModel.findOne({
                    where:{
                        id: req.userData._id
                    },
                    attributes:['notifications']
            });
                
            
            let notifications = user?.dataValues?.notifications || [];
            let TotalUserRegularNotifications = notifications[0]?.regular_notifications?.length ?? 0;
            let TotalUserPhotoNotifications = notifications[1]?.photo_notifications?.length  ?? 0;
            let UserRegularNotifications =   notifications[0]?.regular_notifications;
            let UserPhotoNotifications =  notifications[1]?.photo_notifications;
            let userPhotoNotifStartIndex = req.body.userPhotoNotifStartIndex ?? 0;
            let userPhotoNotifEndIndex;
            let regularNotifStartIndex = req.body.regularNotifStartIndex ?? 0;
            const pageLimit = 10;
            let photoLimit = 2;
            let photoOffset = pageOffset > 0 ? Math.floor(remainingOffset / pageLimit) * photoLimit : 0;

             if(newAdminSlice.length > 0 && newAdminSlice.length < 10 && TotalUserRegularNotifications > 0 ){
                let regularNotificationRequired = 10 - newAdminSlice.length;
                let regularUserNotif =  UserRegularNotifications.slice(0, regularNotificationRequired);     
                RegularNotificationResult = regularUserNotif;
                notificationSet = false;
                regularNotifStartIndex = regularNotificationRequired;
             }
             else if(newAdminSlice.length == 0 && TotalUserRegularNotifications > 0 && req.body.notificationSet == false) {   
                let regularNotifEndIndex = regularNotifStartIndex + 10;
                    RegularNotificationResult =  UserRegularNotifications.slice(regularNotifStartIndex, regularNotifEndIndex);     
                    let RegularNotificationLength = RegularNotificationResult.length;
                    if(RegularNotificationLength < 10){
                        let regularNotificationRequired = 10 - RegularNotificationLength;
                        RegularNotificationResult = await getUserRegularNotifications(req.userData._id, TotalUserRegularNotifications, regularNotificationRequired); 
                        regularNotifStartIndex = regularNotificationRequired;
                        notificationSet = true;
                    }
                    else if(TotalUserRegularNotifications > regularNotifEndIndex){
                        notificationSet = false;
                        regularNotifStartIndex = regularNotifEndIndex;
                    }
                    else if(TotalUserRegularNotifications == regularNotifEndIndex){
                        notificationSet = true;
                        regularNotifStartIndex = regularNotifEndIndex;
                    }
            }
            else if (notificationSet == true){
                let regularNotifEndIndex = regularNotifStartIndex + 10;
                RegularNotificationResult = await getUserRegularNotifications(req.userData._id, regularNotifStartIndex, 10);
                notificationSet = true;       
                regularNotifStartIndex = regularNotifEndIndex;
                /*if(RegularNotificationResult.length < 10){
                      RegularNotificationResult.push(
                        ...regularAdminNotifs.map(n => ({ 
                            ...n, 
                            notification_type: "admin_regular" 
                        }))
                    );
                }
                    */
       
             }

             if(PhotoNotificationResult.length == 0 && (newAdminSlice.length > 0 || RegularNotificationResult.length >= 5 )){
                userPhotoNotifEndIndex = userPhotoNotifStartIndex + 2;
                let photoLimit = 2;
                if(TotalUserPhotoNotifications >= userPhotoNotifEndIndex){
                    PhotoNotificationResult = UserPhotoNotifications.slice(userPhotoNotifStartIndex, userPhotoNotifEndIndex); 
                }
                else{
                    if(RegularNotificationResult.length < 10){
                        photoLimit = 1;
                    }
                    PhotoNotificationResult = await getUserPhotoNotifications(req.userData._id, userPhotoNotifStartIndex, photoLimit);
                }
             }

            const allTextNotifications = [
                ...newAdminSlice.map(n => ({ ...n, notification_type: "admin_new" })),
                ...RegularNotificationResult, 
            ];

          
            for (const notif of allTextNotifications) {
                notificationResults.push(notif);
                textCounter++;

                if (textCounter % 5 === 0 && photoIndex < PhotoNotificationResult.length) {
                    notificationResults.push(PhotoNotificationResult[photoIndex]);
                    photoIndex++;
                }
            }

          
            while (photoIndex < PhotoNotificationResult.length) {
                notificationResults.push(PhotoNotificationResult[photoIndex]);
                photoIndex++;
            }

           
            const paginatedResults = notificationResults.slice(0, pageLimit + photoLimit);
            
            const member = await this._userModel.findOne({
                where:{
                    id:req.userData._id
                },
                attributes:['createdAt']
            });
            const memberSince = member.dataValues.createdAt;

            const total_notifications = await this._notificationModel.count({
                where:{
                    receiver_id: req.userData._id,
                    is_seen: false,
                    text:'regular'
                }
            });
          
            setTimeout(async () => {
                 try{
                   if (newAdminNotifs && newAdminNotifs.length > 0) {
                        for (const notif of newAdminNotifs) {
                            const templateId = notif.template_id; 
                            if (templateId) {
                            const existingView = await this._userNotificationStatusModel.findOne({
                                where: {
                                user_id: req.userData._id,
                                template_id: templateId
                                }
                            });

                            if (existingView) {
                                await this._userNotificationStatusModel.update(
                                { viewed_count: existingView.viewed_count + 1 },
                                {
                                    where: {
                                    user_id: req.userData._id,
                                    template_id: templateId
                                    }
                                }
                                );
                            } else {
                                await this._userNotificationStatusModel.create({
                                    user_id: req.userData._id,
                                    template_id: templateId,
                                    viewed_count: 1,
                                });
                            }
                            }
                        }
                    }

                }
                catch(err){
                    console.log(err.message);
                }

                
                
                try {

                    
                    await this._notificationModel.update({
                        is_seen: true
                    }, {
                        where:{
                            receiver_id: req.userData._id
                        }
                    });
        
                    let updateData = {
                        activity_viewed: sequelize.fn('NOW')
                    };
                    
                    if (notifications == null) {
                        notifications = [
                            {
                                notification_type: 'regular',
                                regular_notifications: regular_notifications
                            },
                            {
                                notification_type: 'posted_photo',
                                photo_notifications
                            }
                        ];
                        updateData.notifications = notifications;
                    }
                    else{              
                            const updatedNotifications = notifications.map(notification => {
                              if (
                                notification.notification_type === 'regular' &&
                                Array.isArray(notification.regular_notifications)
                              ) {
                                notification.regular_notifications = notification.regular_notifications.map(item => ({
                                  ...item,
                                  is_seen: true,
                                }));
                              }
                          
                              if (
                                notification.notification_type === 'posted_photo' &&
                                Array.isArray(notification.photo_notifications)
                              ) {
                                notification.photo_notifications = notification.photo_notifications.map(item => ({
                                  ...item,
                                  is_seen: true,
                                }));
                              }
                          
                              return notification;
                            });
                          
                            updateData = {notifications: updatedNotifications};
                    }

                    await this._userModel.update(updateData,{
                        where:{
                            id: req.userData._id
                        }
                    })     
                }
                catch(err){
                    console.log(err);
                }
            },0);


            global.appLogger.info(`[End] Notifications Fetched Successfully \n`);

            return {notifications: paginatedResults, memberSince, total_notifications, notificationSet, regularNotifStartIndex, userPhotoNotifStartIndex: userPhotoNotifEndIndex};
           
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching View All Notification Api ${err.message} \n`);
            throw new Error(err.message);
        }
          
           
    }
  
    async AddNotificationViewCount(req){
        try{       

            let userId = req.userData._id;
            global.appLogger.info(`\n ---- Start Adding Notification View Count Api Call by User with Id ${userId} ----`);
            
            await this._userNotificationStatusModel.upsert({
                user_id: userId,
                template_id: req.body.notificationId,
                viewed_count: literal('COALESCE(viewed_count, 0) + 1')
            });

            global.appLogger.info(`[End] Notification View Count Added Successfully \n`);
            return {message: 'Notification View Count Added Successfully'};
        }
        catch(err){
            global.appLogger.error(`[Error] Add Notification View Count Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }


    async getNotification(req){
        try{
            global.appLogger.info(`\n---- Starting Notifications Api Call by User with Id ${req.userData._id} ----`);
            let query = `Select 
            (Select Exists(Select * from "notifications" 
            where "receiver_id"='${req.userData._id}' and "is_seen"=false) is_notification),
            (Select "isPaid" from "Users" where "id"='${req.userData._id}') as "isPaid",
            (Select count(*)::integer as "notification_count" from "notifications" 
            where "receiver_id"='${req.userData._id}' and "is_seen"=false)`;

            const result =  await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT
            });
            global.appLogger.info(`[End] Notifications Count Fetched Successfully\n`);
            return result;
        }
        catch(err){
            global.appLogger.Error(`[Error] Fetching Notifications Count Api ${err.message}\n`);
            throw new Error(err.message);
        }       
    }

 




    async sendThanksMsg(req){
        try{   
            global.appLogger.info(`\n---- Starting Send Thanks Msg Api Call by User with Id ${req.userData._id} ----`);
                let payload;
                let notificationId =  req.body.NotificationId;
                console.log(notificationId);
                if(req.body.notification_type == "thanks_on_upvote")
                {
                    payload = {
                        receiver_id: req.body.user_id,
                        sender_id: req.userData._id,
                        photo_id: req.body.photo_id,
                        notification_type: 'thanks_on_upvote'
                    }
                }
            
                if(req.body.notification_type == "thanks_on_weeklytopten_congratulation")
                {
                    payload= {
                        receiver_id:req.body.user_id,
                        sender_id:req.userData._id,
                        photo_id: req.body.photo_id,
                        notification_type: 'thanks_on_weeklytopten_congratulation'
                    }
                }

                if(req.body.notification_type=="thanks_on_upvote_comment"){
                    const photoDetail = await this._commentModel.findOne({
                        where:{
                        id: req.body.comment_id
                        },
                        attributes:['photo_id', 'comment_text']
                    });    

                    payload= {
                        receiver_id: req.body.user_id,
                        sender_id: req.userData._id,
                        photo_id: photoDetail.dataValues.photo_id,
                        notification_type: 'thanks_on_upvote_comment',
                        comment_id: req.body.comment_id
                    }
                }

                if(req.body.notification_type == "thanks_weekly_toptenuser"){
                    payload = {
                        receiver_id: req.body.user_id,
                        sender_id: req.userData._id,
                        notification_type: 'thanks_weekly_toptenuser'
                    }
                }

                if(req.body.notification_type == "congratulate_weekly_toptenuser"){
                    payload = {
                        receiver_id: req.body.user_id,
                        sender_id: req.userData._id,
                        photo_id: req.body.photo_id,
                        notification_type: 'congratulate_weekly_toptenuser'
                    }
                }

                if (req.body.is_thanked == true) {
                    const [notifyUser, created] = await this._notificationModel.findOrCreate(
                    {
                        where: { 
                            receiver_id: payload.receiver_id,
                            sender_id: payload.sender_id,
                            ...(payload.photo_id && { photo_id: payload.photo_id }),
                            ...(payload.comment_id && { comment_id: payload.comment_id }),
                            notification_type: payload.notification_type,
                        },
                        defaults: payload              
                    });
                        setTimeout(async ()=>{
                            try{
                                if(created){
                                    let query = `Select n."id", n."notification_type", n."createdAt",
                                        n."updatedAt", n."is_seen",
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
                                            'is_follow', (Select Exists(Select * from "Followers" where "user_id"= n."receiver_id" and "follower_id"= n."sender_id" and "is_active"=true)),
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
                                            'is_thanked', (case 
                                            WHEN n."notification_type"='upvote_photo' then (Select Exists(Select * from "notifications" where 
                                            "receiver_id"=n."sender_id" and "sender_id"=n."receiver_id" and 
                                            "photo_id"=n."photo_id" and "notification_type"='thanks_on_upvote')) 
                            
                                            WHEN n."notification_type" = 'upvote_comment' then (Select Exists(Select * from "notifications" where 
                                            "receiver_id"= n."sender_id" and "sender_id"=n."receiver_id" and "photo_id"=n."photo_id" 
                                            and "notification_type"='thanks_on_upvote_comment' and "comment_id"= n."comment_id")) 
                                            
                                            WHEN n."notification_type" = 'congratulate_weekly_toptenuser' then 
                                            (Select Exists(Select * from "notifications" where 
                                            "receiver_id"=n."sender_id" and "sender_id"=n."receiver_id" and 
                                            "photo_id"=n."photo_id" and "notification_type"='thanks_on_weeklytopten_congratulation'))
                                            
                                            WHEN n."notification_type" = 'thanks_on_weeklytopten_congratulation' then 
                                            (Select Exists(Select * from "notifications" where 
                                            "receiver_id"=n."sender_id" and "sender_id"=n."receiver_id" and 
                                            "notification_type"='thanks_weekly_toptenuser')) else null end),
                        
                                            'isCongratulateTopTenUser', case WHEN n."notification_type"='follower_in_weekly_top_ten'
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
                                        left join "Comments" c on c."id"= n."comment_id"
                                        where n."id"= '${notifyUser.id}'`;

                                    await updateUserNotifications(query, notifyUser.receiver_id);
                                }
                            }
                            catch(err){
                                console.log(err.message);
                            }

                            try{
                                    let user = await this._userModel.findOne({
                                        where :{
                                            id: req.userData._id
                                        },
                                        attributes:['id', 'notifications']
                                    });       

                                    
                                    
                                    if (user && user.dataValues.notifications) {
                                        const RegularNotificationObj = user.dataValues.notifications.find(n => n.notification_type === 'regular');
                                        let RegularNotification = RegularNotificationObj?.regular_notifications;
                                        if(RegularNotification){
                                            let regularNotification;
                                            if (notificationId) {
                                                regularNotification = RegularNotification.find(n => n.id === notificationId);
                                            }
                                            

                                            if (!regularNotification && payload.photo_id) {
                                                regularNotification = RegularNotification.find(n =>
                                                    n.message?.photo_id === payload.photo_id &&
                                                    n.message?.sender_id === payload.receiver_id &&
                                                    n.message?.receiver_id === payload.sender_id &&
                                                    n.notification_type === 'follower_in_weekly_top_ten'
                                                );
                                            }

                                            if(regularNotification){
                                                if(payload.notification_type == 'congratulate_weekly_toptenuser'){
                                                    regularNotification.message.isCongratulateTopTenUser = true;
                                                }
                                                else{
                                                    regularNotification.message.is_thanked = true;
                                                }
                                                user.changed('notifications', true);
                                                await user.save();
                                            }
                                        }
                                    }     
                            }
                            catch(err){
                                console.log(err.message);
                            }
                        })

                
                    if(created || notifyUser)
                    {
                        global.appLogger.info(`[End] Notification Send Successfully \n`);
                        return 'Notification Send Successfully';
                    }
                }
        }
        catch(err){       
            global.appLogger.error(`[Error] Send Thanks Msg Api ${err.message}\n`);
            throw new Error(err.message);
        }
    }


    async NotifyComingNextPhotos(req){
        try{
            global.appLogger.info(`\n---- Starting Notify Coming Next Photos Api Call by User with Id ${req.userData._id} ----`);
            await this._photoNotificationsModel.create({
                    user_id: req.userData._id,
                    photo_id: req.body.photoId,
                    photo_member_id: req.body.photoMemberId,
                    is_notify: true
            });

            return {
                message: 'Notify Me Selected Successfully'
            }
        }
        catch(err){       
            global.appLogger.error(`[Error] Notify Coming Next Photos Api ${err.message}\n`);
            throw new Error(err.message);
        }
    }
}
