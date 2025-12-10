 import { sequelize } from './utils/database';

export async function updateHuntScores(){
        const users = await sequelize.query(`SELECT id, COALESCE(total_hunt_scores, 0) AS total_hunt_scores 
            FROM "Users" 
            WHERE "isBlocked" = false 
            offset 4500 limit 1000`,
          {
            type: sequelize.QueryTypes.SELECT
          }
        );
        
        for(let user of users){
            try{
                    let query = `Select  (
                    COALESCE((hs.scores ->> 'posted_photo')::int, 0) +
                    COALESCE((hs.scores ->> 'upvote_photo')::int, 0) +
                    COALESCE((hs.scores ->> 'gallery_photo')::int, 0) +
                    COALESCE((hs.scores ->> 'leave_comment')::int, 0) +
                    COALESCE((hs.scores ->> 'weekly_top_ten')::int, 0) +
                    COALESCE((hs.scores ->> 'invite_new_member')::int, 0) +
                    COALESCE((hs.scores ->> 'queued_photo_post')::int, 0) +
                    COALESCE((hs.scores ->> 'consecutive_photo_post')::int, 0)
                ) AS total_hunt_scores from "hunt_scores" hs
                WHERE hs."user_id" = '${user.id}'`;

                await sequelize.query(query,       
                    {
                        type: sequelize.QueryTypes.SELECT

                    }
                ).then(async (result) => {
                    const totalScores = result[0]?.total_hunt_scores || 0;
                    if(totalScores !== user.total_hunt_scores){
                        await sequelize.query(
                            `UPDATE "Users" SET "total_hunt_scores" = :totalScores WHERE "id" = :userId`,
                            {
                                replacements: { totalScores, userId: user.id },
                                type: sequelize.QueryTypes.UPDATE
                            }
                        ); 
                         global.appLogger.info(`Successfully updating hunt scores for user ID ${user.id}:`); 
                    }
                });
            }
            catch(err){
                global.appLogger.error(`Error updating hunt scores for user ID ${user.id}:`, err);
            }

         
        }
        global.appLogger.info(`Completed processing hunt scores for user offset 4500`);

}
