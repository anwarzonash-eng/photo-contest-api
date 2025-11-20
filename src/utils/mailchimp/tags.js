import { Env } from '../../config';
import {getSecrets} from '../secret-manager';
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

export async function manageTags(memberId, listId, tagName, tagStatus) {
  try {
    //const secretKey = await getSecrets();
    await mailchimp.lists.updateListMemberTags(
        listId,
        memberId,
        { tags: [{
            name: tagName, 
            status: tagStatus //active or "inactive"
          }] 
        }
    );
    return;
  } 
  catch (error) {
    console.log("manage tag err", error.message);
    throw error.message;
  }
}

