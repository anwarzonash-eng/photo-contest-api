import { response } from 'express';
import baseService from './base.service';
import { sequelize } from '../utils/database';
import  { addMemberToAudience } from "../utils/mailchimp/list";
const schedule = require('node-schedule');
import {Env} from '../config';
import {sendEmail} from "../utils/mailchimp/send_email";
import { Op, literal } from 'sequelize';


export class personalPageFollowersService extends baseService {

    async followUser(req) {
        try{
            global.appLogger.info(`\n---- Start Personal Page Follow User Api Call ----`);
        
            let userId = req.userData._id;
            const { siteOwnerId, email, followersId, isFollow } = req.body;

            if(isFollow === false){
                await this._personalPageFollowRelationModel.update(
                    { is_follow: false },   
                    { 
                        where: { 
                            user_id: userId, 
                            follower_id: siteOwnerId 
                        } 
                    }
                );  
                return { message: 'Successfully unfollowed the user.' };
            }

      
            let follower = await this._personalPageFollowerModel.findOne({ 
                    where: { 
                        user_id: userId,
                        email, 
                        site_owner_id: siteOwnerId 
                    } 
            });
                
            if (!follower) {
                    
                    // 4. Add email to Mailchimp audience
                    const memberData = await addMemberToAudience(email, Env.PERSONAL_PAGE_SUBSCRIBERS_LIST_ID);
                    
                    follower = await this._personalPageFollowerModel.create({ 
                        user_id: userId,
                        email, 
                        member_id: memberData?.id,
                        site_owner_id: siteOwnerId  
                    });
            }


            // 2. Create follow event
            let [event, created] = await this._personalPageFollowEventModel.findOrCreate({
                where:{
                    user_id: userId,
                    site_owner_id: siteOwnerId,
                    email_status: 'pending'
                },
                defaults:{
                    user_id: userId,
                    personal_page_follower_id: follower.id,
                    site_owner_id: siteOwnerId,
                    email_status: 'pending',
                }
            });


            // 3. Add relation for the original creator (source follow)
            await this._personalPageFollowRelationModel.findOrCreate({
                where:{
                    user_id: userId,
                    follower_id: siteOwnerId,
                },
                defaults: {
                    user_id: userId,
                    personal_page_follower_id: follower.id,
                    follow_event_id: event.id,
                    follower_id: siteOwnerId,
                    source_creator_id: siteOwnerId,
                    is_follow: true,
                }
            });

            if(followersId && followersId.length > 0){
                for (const id of followersId) {
                    await this._personalPageFollowRelationModel.findOrCreate({
                        where: {
                            user_id: userId,
                            follower_id: id,
                        },
                        defaults: { 
                            user_id: userId,
                            personal_page_follower_id: follower.id,
                            follow_event_id: event.id,  
                            follower_id: id,
                            source_creator_id: siteOwnerId,
                            is_follow: true,
                        }
                    });
                }
            }

            let suggestedCreators;
            if(followersId && followersId.length == 0){ 
                suggestedCreators = await this.getSuggestedFollowersList(req);

                // 5. Schedule transactional email to be send after 10 
                schedule.scheduleJob(new Date(Date.now() + 10 * 60 * 1000), async () => {
                    const extraFollows = await this._personalPageFollowRelationModel.count({
                        where: { 
                            follow_event_id: event.id, 
                            follower_id: { 
                                [Op.ne]: siteOwnerId
                            },
                            is_follow: true
                        }
                    });

                    let emailType = 'Email 1 - Followed original creator';

                    if (extraFollows > 0) {
                        emailType = 'Email 2 - Followed extra creators';
                        let template = {
                            from_email:'support@example.com', 
                            from_name: "Photo Contest", 
                            to_email: email, 
                            subject:'Email 2 - Followed extra creators', 
                            body:`<p>Hi! 
                                <br><br> Email 2 - Followed extra creators
                                <br><br>The Photo Contest
                            </p>`
                        }
                        await sendEmail(template);
                    } 
                    else {
                        let template = {
                            from_email:'support@example.com', 
                            from_name: "Photo Contest", 
                            to_email: email, 
                            subject:'Email 1 - Only followed original creator', 
                            body:`<p>Hi! 
                                <br><br> Email 1 - Only followed original creator
                                <br><br>The Photo Contest
                            </p>`
                        }
                        await sendEmail(template);
                    }

                    await this._personalPageFollowEventModel.update(
                    {
                        email_status: 'sended',
                        email_type: emailType
                    }, 
                    {
                        where:{
                            id: event.id
                        }
                    });
                });
            }

            
            return {
                suggestedCreators,
            };
        }
        catch(err){
            global.appLogger.error(`[Error] Personal Page Follow User Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while follow user`};
        }
    }


    async getSuggestedFollowersList(req){
        try{
             global.appLogger.info(`\n---- Start Fetching Suggested Followers List Api Call ----`);

              const { siteOwnerId, email } = req.body;

                const userData = await this._personalPageFollowerModel.findOne({ 
                    where: { 
                        email
                    } 
                });
                
                if (!userData) {
                    return { status: 'Error', message: 'User with this email does not exist' };
                }

                const siteOwnerData = await this._userModel.findByPk(siteOwnerId);

                if (!siteOwnerData) {
                    return { status: 'Error', message: 'Personal Page Site Uwner does not exist' };
                }

                const genres = siteOwnerData.genres_list
                ? siteOwnerData.genres_list.split(",").map(g => g.trim()).filter(g => g.length > 0)
                : [];


                // Exclude creators this follower already follows
                const alreadyFollowed = await this._personalPageFollowRelationModel.findAll({
                    where: { 
                        user_id: req.userData._id,
                        is_follow: true
                    },
                    attributes: ["follower_id"]
                });

                const excludeIds = alreadyFollowed?.map(r => r.follower_id);

                let orderBy = [
                        [literal("genre_match_score"), "DESC"], // Priority 1 
                        [literal("mutual_followers_count"), "DESC"], // Priority 2
                        [literal("recent_activity"), "DESC"],        // Priority 3
                        [literal("follower_count"), "DESC"],          // Priority 4
                        [literal(`CASE WHEN 
                                "User"."genres_list" IS NULL 
                                OR "User"."genres_list" = '' 
                            THEN 0 
                            ELSE 1 
                            END`), 
                        "DESC"] // Priority 5
                ]

                let requiredAttributes = [
                        "id",
                        "user_id",
                        "user_name", 
                        "user_bio",
                        "compressedProfilePic", 
                        "compressedProfileId", 
                        [
                            literal(`( SELECT COUNT(*) 
                                FROM unnest(string_to_array("User"."genres_list", ',')) AS genre
                                WHERE ${genres.length > 0
                                ? genres.map(g => `genre ILIKE '%${g.trim()}%'`).join(' OR ')
                                : '1=0'}
                            )`),
                            "genre_match_score"
                        ],
                        [
                            literal(`(                        
                                SELECT COUNT(DISTINCT r.user_id)
                                FROM personal_page_follow_relations r
                                WHERE r.follower_id = "Personal_Website"."user_id"
                                and r."is_follow" = true
                            )`),
                            "follower_count"
                        ],
                        [
                            literal(`EXISTS (
                                SELECT 1 FROM "personal_photos" p 
                                WHERE p.user_id = "Personal_Website"."user_id"
                                AND p."isDeleted" = false 
                                AND p."isActive" = true
                                AND p."createdAt"::timestamp >= NOW() - INTERVAL '30 days'
                            )`),
                            "recent_activity"
                        ],
                        [
                            literal(`(
                                SELECT COUNT(DISTINCT pf_shared.user_id)
                                FROM personal_page_follow_relations pf_site
                                INNER JOIN personal_page_follow_relations pf_shared
                                ON pf_site.user_id = pf_shared.user_id
                                WHERE pf_site.follower_id =  '${siteOwnerId}'
                                AND pf_shared.follower_id = "Personal_Website"."user_id" 
                                AND pf_site."is_follow" = true
                                AND pf_shared."is_follow" = true
                            )`),
                            "mutual_followers_count"
                        ]
                    ]

                let creators = await this._personalWebsiteModel.findAll({
                    where: {
                        user_id: { [Op.notIn]: [...excludeIds, siteOwnerId, req.userData._id] },
                        followMe: true
                    },
                    include: [
                        {
                            model: this._userModel,
                            where: genres.length
                            ? { 
                                [Op.or]: genres.map(g => (
                                    { genres_list: { 
                                        [Op.like]: `%${g}%` } 
                                    }
                                )) 
                            }
                            : {},
                            attributes: ["genres_list"]
                        }
                    ],
                    attributes: requiredAttributes,
                    order: orderBy,
                    limit: 5
                });
                
                if (creators.length < 5) {
                    const neededCount = 5 - creators.length;
                    const alreadyFetchedUserIds = creators.map(c => c.user_id);

                    const fallback = await this._personalWebsiteModel.findAll({
                        where: {
                            user_id: {
                                [Op.notIn]: [...excludeIds, siteOwnerId, req.userData._id, ...alreadyFetchedUserIds] 
                            },
                            followMe: true
                        },
                        include: [
                            {
                                model: this._userModel,
                                attributes: ["genres_list"]
                            }
                        ],
                        attributes: requiredAttributes,
                        order: orderBy,
                        limit: neededCount
                    });

                    creators = [...creators, ...fallback];
                }

                return creators;
        }
        catch(err){
            global.appLogger.error(`[Error] Fetching Suggested Followers List Api ${err.message} \n`);
            return {status:'Error', message: `Something went wrong while fetching followers list`};
        }
    }
} 