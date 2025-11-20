const moment_timezone = require('moment-timezone');
 import { sequelize } from './utils/database';

export async function updateBoostedPhotos(){
        moment_timezone.updateLocale('en', {
              week: {
                dow: 1 
              }
        });
            
        const weekStartDate = moment_timezone.tz('America/New_York').clone().startOf('week').format('YYYY-MM-DD');
        const weekEndDate = moment_timezone.tz('America/New_York').clone().endOf('week').format('YYYY-MM-DD');

        const photosToUpdate = await sequelize.query(`SELECT "id" FROM "Photos" 
            WHERE DATE("createdAt") >= '${weekStartDate}'
            AND DATE("createdAt") <= '${weekEndDate}'
            AND "isQueued"= false
            And "isDeleted" = false
            AND "boostedWeeklyPhoto" != 'Rehunt'`,
          {
            type: sequelize.QueryTypes.SELECT
          }
        );
        
        if (photosToUpdate.length > 0) {
            const photoIds = photosToUpdate.map(photo => photo.id);
            await sequelize.query(
              `UPDATE "Photos" SET "boostedWeeklyPhoto" = 'Rehunt' WHERE "id" IN (:photoIds)`,
              {
                replacements: { photoIds },
                type: sequelize.QueryTypes.UPDATE
              }
            );           
        }
}
