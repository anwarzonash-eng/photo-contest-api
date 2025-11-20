import {updateMemberProfile, getMemberProfile } from './profile';
import  {findOrCreateInterest } from "./interest";
export async function setPaidInterest(memberId, interestCategory, isPaid) {
    try{
        const paidUserInterest = await findOrCreateInterest('BPH Master: Paid User Status', interestCategory);
        let currentInterests = await getMemberProfile(memberId);
        if(currentInterests && paidUserInterest){
            currentInterests[paidUserInterest.interestId] = isPaid;
            await updateMemberProfile(memberId, {interests: currentInterests}); 
        } 
    }
    catch(err){
        throw err;
    }
}