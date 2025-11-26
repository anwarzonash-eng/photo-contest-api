import { Env } from '../../config';
import {getSecrets} from '../secret-manager';
const mailchimp = require("@mailchimp/mailchimp_marketing");
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

export async function getCurrentProfile(MEMBER_EMAIL) {
  try {
    const secretKey = await getSecrets();
    const LIST_ID = secretKey.listId;
    const response = await mailchimp.lists.getListMember(LIST_ID, MEMBER_EMAIL);
    return response;
  } catch (error) {
      throw error;
  }
}


  export async function updateProfile(data, currentProfile, MEMBER_EMAIL) {
    try {
      const secretKey = await getSecrets();
      const listId = secretKey.listId;
      if(data.photoType != ""){
        currentProfile.merge_fields.USER_PHOTO = data.photoType;
      }
      if(data.userEmail != ""){
        currentProfile.merge_fields.USER_EMAIL = data.userEmail;
      }
  
      // Update the profile 
      await mailchimp.lists.updateListMember(listId, MEMBER_EMAIL, {
        merge_fields: currentProfile.merge_fields,
        email_address: data.userEmail
      });
      
    } catch (error) {
        throw error;
    }
  }

  export async function getMemberId(email) {
    let memberHash = "";
  
    try {

      const secretKey = await getSecrets();
      const listId = secretKey.listId;
      
      let offset = 0;
      const batchSize = 100; 
      while (true) {
        const response = await mailchimp.lists.getListMembersInfo(listId, {
          offset: offset,
          count: batchSize,
        });

      if (response.members.length === 0) {
        break;
      }

      const member = response.members.find(member => member.email_address === email);
      if (member) {
        memberHash = member.id;
        break;
      }
     offset += batchSize;
    }
    } catch (error) {
        throw error;
    }
  
    return memberHash;
  }

  
  export async function getMemberProfile(MEMBER_ID, listId) {
    try {
        if(!listId){
          let secretKey = await getSecrets();
          listId = secretKey.listId;
        }
      
        if(MEMBER_ID){
          const response = await mailchimp.lists.getListMember(listId, MEMBER_ID);
          return response.interests;
        }
    } 
    catch (error) {
      throw error;
    }
  }
 


export async function updateMemberProfile(MEMBER_ID, data, listId) {
  try {
        if(!listId){
          let secretKey = await getSecrets();
          listId = secretKey.listId;
        }
        
        const response = await mailchimp.lists.updateListMember(listId, MEMBER_ID, data);
        return response;
  } 
  catch (error) {
       throw error;
  }
}


export async function updateInterestsInProfile(getInterestId, totalPhotos, MEMBER_ID ){
  try{
    const currentInterests = await getMemberProfile(MEMBER_ID);
    var interestId = getInterestId.interests[totalPhotos-1].id;
    //if (currentInterests.hasOwnProperty(interestId)) {
    currentInterests[interestId] = true;
    //}


    await updateMemberProfile(MEMBER_ID, {
      interests: currentInterests
    });
    return;
  }catch(err){
      throw err;
  }
}