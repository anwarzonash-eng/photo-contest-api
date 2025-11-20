import { Env } from '../../config'
const mailchimp = require("@mailchimp/mailchimp_marketing");
import {getSecrets} from '../secret-manager';


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


export async function addInterestCategory(title) {
  //Interest Category Creation
    try{
      const secretKey = await getSecrets();
      const listId = secretKey.listId;
      const response = await mailchimp.lists.createListInterestCategory(listId, {
        title: title, // description of this category
        type: "checkboxes",
      });

      return response.id;
    }
    catch(error){
      console.log(error);
    }
}


export async function addInterestToCategory(interestCategoryId, title){
    try{
      const secretKey = await getSecrets();
      const listId = secretKey.listId;
      const InterestResponse = await mailchimp.lists.createInterestCategoryInterest(
        listId, 
        interestCategoryId,
        { name: title } //The name of the interest
      );

      return InterestResponse.id;
    }
    catch(error){}
}

export async function getAllInterestCategories(){
  try{
    const secretKey = await getSecrets();
    const listId = secretKey.listId;
      const accountCategory = await mailchimp.lists.getListInterestCategories(listId, {
        count:20,
        offset:0,
      });
      return accountCategory.categories;
  }
  catch(err){}
}


export async function getInterestsInCategory(interestCategoryId){
  try{
    const secretKey = await getSecrets();
    const listId = secretKey.listId;
    const accountInterest = await mailchimp.lists.listInterestCategoryInterests(
      listId,
      interestCategoryId
    );
   return accountInterest.interests;
  }
  catch(err){}
}

export async function addPhotosInterestCategory(interestCategoryId, interestList){
    try{
    const secretKey = await getSecrets();
    const listId = secretKey.listId;
    for (let i = 0; i <4; i++) {
        await mailchimp.lists.createInterestCategoryInterest(
             listId,
             interestCategoryId, 
            { name: interestList[i] }
        );
    }
    }
    catch(err){}
}

export async function getInterestCategoryId(categoryId) {
  try
  {
    const secretKey = await getSecrets();
    const listId = secretKey.listId;
    const getInterestId = await mailchimp.lists.listInterestCategoryInterests(
      listId,
      categoryId
    );
    return getInterestId;  
  }catch(err){}  
}

export async function findOrCreateMultipleInterests(title, interestList){
  try
  {
    const allCategories = await getAllInterestCategories();
    const category = await allCategories.find(category=> category.title === title);
  
    let interestCategoryId;
    if(category != undefined){
      interestCategoryId = await category.id;
    }
    else
    {
      interestCategoryId = await addInterestCategory(title);
    }

    let InterestIds = await getInterestCategoryId(interestCategoryId);
    if(InterestIds.interests.length ==0){           
      await addPhotosInterestCategory(interestCategoryId, interestList);
      InterestIds = await getInterestCategoryId(interestCategoryId);    
    }
    return InterestIds;
  }catch(err){
      throw err;
  }
}

export async function findCategoryIdByName(categories, categoryName) {
  try{
    const category = await categories.find(category => category.name === categoryName);
    if (category != undefined) {
      return category.id;
    }
  }
  catch(err){
    throw err;
  }
}

export async function findOrCreateInterest(interestCategory, interestName){
  try
  {
    const allCategories = await getAllInterestCategories();
    const category = await allCategories.find(category=> category.title === interestCategory);
    let interestCategoryId;
    if(category != undefined){
      interestCategoryId = await category.id;
    }
    else
    {
      interestCategoryId = await addInterestCategory(interestCategory);
    }

     //get interest from interest Category        
    const accountInterest = await getInterestsInCategory(interestCategoryId);
    const Interest = await accountInterest.find(interest => interest.name === interestName);
    let interestId;
    if(Interest != undefined){
        interestId = await Interest.id;
    }
    else{
        interestId = await addInterestToCategory(interestCategoryId, interestName)
    }       

    return {interestId, accountInterest};
  }catch(err){
       throw err;
  }
}



export async function setUserInterest(interestCategory, subInterest, userCurrentInterests, status) {
  try{
      const interest = await findOrCreateInterest(interestCategory, subInterest);
      if(interest){
        userCurrentInterests[interest.interestId] = status;
        return userCurrentInterests;
      }
  }
  catch(err){
    throw err;
  }
}

