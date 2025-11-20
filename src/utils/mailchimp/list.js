import { Env } from '../../config';
import {getSecrets} from '../secret-manager';
const mailchimp = require("@mailchimp/mailchimp_marketing");
import crypto from 'crypto';


(async () => {
    try{
        let secret_key = await getSecrets();    
        mailchimp.setConfig({
            apiKey: secret_key.MailChimpMarketingApiKey,
            server: Env.MailChimpServerPrefix 
        })
    }
    catch{}
})()


export async function addMemberToList(listId, userEmail, interestId){
    try{
            let addMember = await mailchimp.lists.addListMember(listId, {
                email_address: userEmail,
                status: 'subscribed',
                email_type: 'html',
                interests: {
                    [interestId]: true,
                },
                marketing_permissions:[{
                    marketing_permission_id: "c73a9abd30",
                    enabled: true
                }]
            })
         return addMember;
    }
    catch(error){   
        throw error;
    }
}


export async function addMemberToAudience(email, listId) {
    try {
     
            // 1. Hash email (lowercase first)
            const subscriberHash = crypto.createHash('md5').update(email.toLowerCase()).digest('hex');

            // 2. Try to get the member from Mailchimp
            let member;
            try {
                member = await mailchimp.lists.getListMember(listId, subscriberHash);
            } 
            catch (err) {
                if (err.status === 404) {
                    member = null; // not found
                } 
                else {
                    throw err; // some other error
                }
            }

            if (member) {
                return member;
            }

            // 3. Add member if not found
            const response = await mailchimp.lists.addListMember(listId, {
                email_address: email,
                status: 'subscribed'
            });
      
            return response;
  } 
  catch (err) {
    throw err;
  }
}
