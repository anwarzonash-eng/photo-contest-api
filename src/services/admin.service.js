import { response } from 'express';
import baseService from './base.service';
import { createToken } from '../utils/jwt';
import bcrypt from 'bcrypt'
import { sequelize } from '../utils/database';
import axios from 'axios';
import archiver from 'archiver';
import path from 'path';
const uploadPhoto = require("../utils/aws/s3");
import { photoOptimization } from "../utils/cloudinary/photo_optimization";
const moment = require('moment');


export class adminService extends baseService {
    async AdminLogin(email, userPassword) {
        try {
            global.appLogger.info(`\n---- Start Admin Login Api Call with email as ${email} ----`);
            let user = await this._userModel.findOne({
                where: {
                    name: email,
                    isAdmin: true
                },
                attributes: ['id', 'name', 'email', 'password']
            });

            if (!user) {
                return { status: 'Error', message: `Invalid username. Please check the username and try again.` }
            }


            const passwordMatch = await bcrypt.compare(userPassword, user.password);
            if (!passwordMatch) {
                return { status: 'Error', message: `Invalid credentials. Please check your password and try again.` }
            }

            const Token = await createToken(user);
            const { password, ...userData } = user.toJSON ? user.toJSON() : user;
            global.appLogger.info(`[End] Admin Login Successfully\n`);
            return [userData, Token];
        }
        catch (err) {
            global.appLogger.error(`[Error] Admin Login Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }


    async FetchActivityPageCallout() {
        try {
            global.appLogger.info(`\n---- Start Fetching Activity Page Callout Api Call ----`);

            const activityCallout = await this._activityCalloutModel.findOne({
                order: [['createdAt', 'DESC']],
                limit: 1
            });

            global.appLogger.info(`[End] Successfully Fetched Activity Page Callout \n`);

            return { activityCallout };
        }
        catch (err) {
            global.appLogger.error(`[Error] Fetching Activity Page Callout Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }



    async UpdateActivityPageCallout(req) {
        try {
            global.appLogger.info(`\n---- Start Updating Activity Page Callout Api Call By Admin ----`);

            let { id, title, subTitle, CTA, CTA_Url } = req.body;

            const [_, [updatedCallout]] = await this._activityCalloutModel.update({
                title,
                subTitle,
                CTA,
                CTA_Url
            }, {
                where: {
                    id
                },
                returning: true
            });

            let activityCallout = updatedCallout?.get();

            global.appLogger.info(`[End] Successfully Updated Activity Page Callout \n`);
            return { activityCallout }
        }
        catch (err) {
            global.appLogger.error(`[Error] Updating Activity Page Callout Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }


    async AddUserNotifications(req) {
        try {
            global.appLogger.info(`\n---- Start Adding User Notifications Api Call By Admin ----`);

            let photoUrl, optimizedData, notification;
            let notificationId = req.body?.notificationId;
            let target_conditions = req.body?.target_conditions;
            if (target_conditions && typeof target_conditions === 'string') {
                target_conditions = JSON.parse(target_conditions);
            }

            photoUrl = req.body?.photo_url;

            let photo = req.files?.photo;
            if (req.files && photo) {
                photoUrl = await uploadPhoto.uploadPhoto(photo);
                let imageFilePath = photo['tempFilePath'];
                optimizedData = await photoOptimization(imageFilePath, { folder: 'Resized_Photos', quality: "auto:good" });
            }

            let notificationObj = {
                sender_id: req.adminUser._id,
                message: req.body.message,
                photo_url: photoUrl,
                compressedImageUrl: optimizedData?.['compressedImageUrl'],
                compressedImageId: optimizedData?.['compressedImageId'],
                btnLabel: req.body?.btnLabel,
                btnUrl: req.body?.btnUrl,
                postedType: req.body.postedType,
                postedAt: req.body.postedType === 'immediate'
                    ? moment.utc().toDate() : moment.utc(req.body.postedAt, "MM-DD-YYYY HH:mm").toDate(),
                expirationType: req.body.expirationType,
                expiredAt: req.body.expirationType === 'scheduled'
                    ? moment.utc(req.body.expiredAt, "MM-DD-YYYY HH:mm").toDate() : null,
                shownNoOfTimes: req.body?.shownNoOfTimes,
                target_conditions
            }

            if (notificationId) {
                const [_, [updatedNotification]] = await this._adminNotificationTemplateModel.update(notificationObj, {
                    where: {
                        id: notificationId
                    },
                    returning: true
                });

                notification = updatedNotification?.get();
            }
            else {
                notification = await this._adminNotificationTemplateModel.create(notificationObj);
            }

            global.appLogger.info(`[End] Successfully Added User Notification \n`);

            return { notification }
        }
        catch (err) {
            global.appLogger.error(`[Error] Adding User Notifications Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }


    async FetchUserNotifications(req) {
        try {

            global.appLogger.info(`[Start] Fetching All User Notifications Api By Admin \n`);
            const notifications = await this._adminNotificationTemplateModel.findAndCountAll({
                order: [['createdAt', 'DESC']],
                offset: req.body.offSet,
                limit: 10
            });

            global.appLogger.info(`[End] Successfully Fetched All User Notifications \n`);

            return {
                notifications: notifications.rows,
                recordsCount: notifications.count
            }

        }
        catch (err) {
            global.appLogger.error(`[Error] Get All User Notifications Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }


    async StopUserNotification(req) {
        try {
            global.appLogger.info(`[Start] Stop User Notification Api By Admin \n`);

            let { isStopped, notificationId } = req.body;

            await this._adminNotificationTemplateModel.update({
                isActive: !isStopped
            }, {
                where: {
                    id: notificationId
                }
            });

            global.appLogger.info(`[End] Successfully Stopped User Notification \n`);
            return { message: 'User Notification Stopped Successfully!' }
        }
        catch (err) {
            global.appLogger.error(`[Error] Stop User Notifications Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }



    async getAllUsersList(data) {
        try {
            global.appLogger.info(`\n---- Start GetAllUsersList Api Call By Admin ----`);

            let searchKeyword = data?.searchKeyword;
            const sortBy = data.sortBy || 'createdAt';
            const sortType = data.sortType || 'DESC';
            let orderByClause = `"${sortBy}" ${sortType}`;

            const isInstagramLinkSort = sortBy === 'instagram_link';
            orderByClause = isInstagramLinkSort
                ? `CASE WHEN "instagram_link" IS NULL OR TRIM("instagram_link") = '' THEN 1 
                            ELSE 0 
                        END ASC,
                        "instagram_link" ${sortType}`
                : sortBy === 'last_activity' ? `CASE WHEN "last_activity" IS NULL THEN 1 
                    ELSE 0 END ASC,
                    "last_activity" ${sortType}`
                    : `"${sortBy}" ${sortType}`;


            const query = `
                WITH user_stats AS (
                    SELECT 
                        u."id",
                        u."account_status",
                        u."name",
                        u."email",
                        u."user_type" as login,
                        u."instagram_link",
                        u."state" as location,
                        COALESCE(u."lastVisitTime", u."activity_viewed")::date as last_activity,                                       
                        CASE 
                            WHEN u."membershipPlan" = 'Monthly' THEN 'M'
                            WHEN u."membershipPlan" = 'Annual' THEN 'A'
                            WHEN u."membershipPlan" = '2 Year' THEN '2Y'
                            WHEN u."membershipPlan" = 'Storage Vault' THEN 'S'
                            ELSE NULL
                        END AS "pro_member",                                 
                        (
                            SELECT EXISTS (
                                SELECT 1
                                FROM "Personal_Websites"
                                WHERE "user_id" = u."id"
                                AND NOW() >= (("createdAt")::timestamptz + INTERVAL '56 minutes')
                                FOR SHARE
                            )
                        ) AS is_personal_site,
                        (SELECT COUNT(*) FROM "personal_photos" WHERE "user_id" = u."id" AND "isDeleted" = false AND "isActive" = true) AS personal_photo_count,
                        (Select count(*) from "personal_photos_vault" where "user_id"= u.id AND "isDeleted" = false and "status" = 'uploaded_to_BackBlaze') As vault_count,                                            
                        (SELECT COUNT(*) FROM  "personal_page_follow_relations" f
                        WHERE f.follower_id = u."id" AND "is_follow" = true) as followers_count,
                        (SELECT COUNT(*) FROM "Photos" WHERE "user_id" = u."id" AND "isDeleted" = false AND "isQueued" = false) as hunted,
                        (SELECT CASE 
                                    WHEN u."isPaid" = false THEN LEAST(
                                        COUNT(CASE WHEN "photo_display_status" != 'expired' THEN 1 END), 5
                                    )
                                    ELSE COUNT(*) 
                                END
                            FROM "gallery_photos" 
                            WHERE "user_id" = u."id"
                        ) as portfolio,
                        (SELECT count(*) FROM "Comments" WHERE "user_id" = u."id" AND "isDeleted" = false) as comments_given,
                        (SELECT count(*) FROM "Votes" WHERE "user_id" = u."id" AND "is_vote" = true) as upvotes_given,
                        (SELECT COUNT(c.id)
                            FROM "Photos" p
                            LEFT JOIN "Comments" c ON p.id = c.photo_id
                            WHERE p.user_id = u."id" AND p."isDeleted"=false AND p."isQueued"= false AND c."isDeleted"=false
                        ) as comments_received,
                        (SELECT COUNT(v.id)
                            FROM "Photos" p
                            LEFT JOIN "Votes" v ON p.id = v.photo_id
                            WHERE p.user_id = u."id" AND p."isDeleted"=false AND p."isQueued"= false AND v."is_vote"= true
                        ) as votes_received,
                        COALESCE(
                            (SELECT MAX(votes_count) 
                            FROM (
                                SELECT COUNT(v.id) AS votes_count
                                FROM "Photos" p
                                LEFT JOIN "Votes" v ON p.id = v.photo_id
                                WHERE p.user_id = u."id" AND p."isDeleted" = false AND p."isQueued" = false AND v."is_vote" = true
                                GROUP BY p.id
                            ) AS photo_votes), 0) as top_upvotes_received,
                        u."winner_count" as top_ten,
                        (SELECT COUNT(*) FROM "Followers" f WHERE f.user_id = u."id" AND "is_active" = true) as following_count,
                        (SELECT COUNT(*) FROM "Followers" f WHERE f.follower_id = u."id" AND "is_active" = true) as followers_count,
                        u."createdAt"
                    FROM "Users" u
                    WHERE u."isAdmin" = false
                     ${searchKeyword ? `AND (u."name" ILIKE '%${searchKeyword}%' OR u."email" ILIKE '%${searchKeyword}%')` : ''}
                )
    
                SELECT 
                    (SELECT count(*) FROM "Users" where "isAdmin" = false
                      ${searchKeyword ? `AND ("name" ILIKE '%${searchKeyword}%' OR "email" ILIKE '%${searchKeyword}%')` : ''}
                    ) AS "total_users",
                    (SELECT count(*) FROM "Users" 
                     WHERE "createdAt" >= (CURRENT_DATE - INTERVAL '1 day')::timestamp AT TIME ZONE 'America/New_York' AT TIME ZONE 'GMT'
                        AND "createdAt" < CURRENT_DATE::timestamp AT TIME ZONE 'America/New_York' AT TIME ZONE 'GMT'
                        ${searchKeyword ? `AND ("name" ILIKE '%${searchKeyword}%' OR "email" ILIKE '%${searchKeyword}%')` : ''}
                       ) AS "yesterday_new_users",
                    (SELECT CURRENT_TIMESTAMP AT TIME ZONE 'GMT') as "server_time",
                    COALESCE(json_agg(user_data), '[]'::json) as "users_data"
                FROM (
                    SELECT 
                        *
                    FROM user_stats
                    ORDER BY ${orderByClause}
                    OFFSET ${data.offSet}
                    LIMIT ${data.limit}
                ) AS user_data`;

            const results = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT
            });

            return results;

        }
        catch (err) {
            global.appLogger.error(`[Error] Get All Users List Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }

    async updateUserById(data) {
        try {
            const isUserExist = await this._userModel.findOne({
                where: {
                    id: data.userId
                }
            });

            if (!isUserExist) {
                return { status: 'Error', message: `User with id ${data.userId} does not exist` }
            }


            const updateFields = {};
            if (data.name) {
                updateFields.name = data.name;
            }

            if (data.status) {
                const isBlocked = data.status === 'Active';
                updateFields.isBlocked = !isBlocked;
                updateFields.account_status = data.status;
            }

            if (Object.keys(updateFields).length > 0) {
                await this._userModel.update(updateFields, {
                    where: {
                        id: data.userId
                    }
                });
            }

            return {
                message: 'User Updated Successfully!'
            };
        }
        catch (err) {
            throw new Error(err.message);
        }
    }


    async getWeeklyTopTenList(req) {
        try {
            global.appLogger.info(`[Start] Fetching Weekly Top Ten List Api \n`);
            let query = `WITH weeks AS (
                    SELECT DISTINCT TO_CHAR(
                        DATE_TRUNC('week', ("createdAt" - INTERVAL '7 hours')::timestamp) - INTERVAL '1 day',
                        'MM-DD-YYYY'
                    ) AS past_weeks
                    FROM "Votes"
                    WHERE "is_vote" = true

                    UNION

                    SELECT TO_CHAR(
                        DATE_TRUNC('week', (current_timestamp - INTERVAL '7 hours')) - INTERVAL '1 day',
                        'MM-DD-YYYY'
                    ) AS past_weeks
                ),
                ordered_weeks AS (
                    SELECT 'WTT_Week_Ending_' || past_weeks AS past_weeks
                    FROM weeks
                    ORDER BY past_weeks::date DESC
                ),
                paged_weeks AS (
                    SELECT past_weeks
                    FROM ordered_weeks
                    OFFSET ${req.offSet} 
                    LIMIT ${req.limit}
                )
            SELECT
                json_agg(past_weeks) AS weeks,
                (SELECT COUNT(*) FROM ordered_weeks) AS "records_count"
            FROM paged_weeks`;

            const results = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT
            });

            global.appLogger.info(`[End] Successfully Fetched Weekly Top Ten List Api \n`);
            return results;

        }
        catch (err) {
            global.appLogger.error(`[Error] Fetching Weekly Top Ten List Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }


    async downloadWeeklyTopTen(req, res) {
        try {
            let errorMessage = `Something went wrong while dowloading Weekly Top Ten`;
            global.appLogger.info(`[Start] Downloading Weekly Top Ten Api \n`);

            let where = `(p."createdAt"::timestamp AT TIME ZONE 'America/New_York' >= date_trunc('week', TIMESTAMP :weekDate AT TIME ZONE 'America/New_York') - interval '1 week' 
                      AND p."createdAt"::timestamp AT TIME ZONE 'America/New_York' <= date_trunc('week', TIMESTAMP :weekDate AT TIME ZONE 'America/New_York') - interval '1 microsecond')
                      AND (v."createdAt" AT TIME ZONE 'America/New_York' >= date_trunc('week', TIMESTAMP :weekDate AT TIME ZONE 'America/New_York') - interval '1 week' 
                           AND v."createdAt" AT TIME ZONE 'America/New_York' <= date_trunc('week', TIMESTAMP :weekDate AT TIME ZONE 'America/New_York') - interval '1 microsecond')`;

            let query = `SELECT
                    (SELECT jsonb_agg(p."compressedImageUrl") as most_upvoted_photos 
                    FROM (
                        SELECT p.id, p."compressedImageUrl", MAX(v."createdAt") as upvoted_date, p.user_id
                        FROM "Photos" p JOIN "Votes" v ON p.id = v.photo_id
                        WHERE ${where}
                        AND p."isDeleted" = false and p."isQueued" = false
                        and p.user_id != '00000000-0000-0000-0000-000000000099' 
                        and p.user_id != '00000000-0000-0000-0000-000000000099'
                      GROUP BY p.id
                      ORDER BY (Select count(*) from "Votes" v inner join "Photos" p1 on p1."id"= v."photo_id"
                      where photo_id= p.id and ${where}) DESC, 
                      upvoted_date DESC
                      LIMIT 10
                  ) AS p
                  JOIN "Users" u ON u.id = p.user_id
                  WHERE u."isBlocked"= false)`;

            const results = await sequelize.query(query, {
                type: sequelize.QueryTypes.SELECT,
                replacements: { weekDate: req.body.weekDate }
            });

            const photoUrls = results[0]['most_upvoted_photos'];
            if (!photoUrls || photoUrls.length === 0) {
                return res.status(404).json({ status: 'Error', message: 'No photos found for the selected week.' });
            }
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${req.body.fileName}.zip"`);
            const archive = archiver('zip', { zlib: { level: 9 } });

            archive.on('error', (err) => {
                global.appLogger.error(`[Archive Error] ${err.message}`);
                res.status(500).json({ status: 'Error', message: errorMessage });
            });
            archive.pipe(res);

            for (const [index, url] of photoUrls.entries()) {
                try {
                    const response = await axios({
                        method: 'GET',
                        url,
                        responseType: 'stream'
                    });

                    const fileName = path.basename(url);
                    archive.append(response.data, { name: fileName });
                }
                catch (err) {
                    global.appLogger.error(`[Photo Streaming Error] ${err.message}`);
                }
            }

            await archive.finalize();
            global.appLogger.info(`[End] Successfully Downloaded Weekly Top Ten Api`);
            return;
        }
        catch (err) {
            global.appLogger.error(`[Error] Downloading WeeklyTopTen Api ${err.message} \n`);
            throw new Error(err.message);
        }
    }
}