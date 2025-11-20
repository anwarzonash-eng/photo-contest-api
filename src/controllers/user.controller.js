import baseController from "./base.controller"
import { validationMiddleware, authMiddleware} from '../middleware';
import { editProfileDto, uploadCoverPhotoDto, changePasswordDto, updateSubscriptionReasonDto, 
    acceptedInviterInvitationDto, UserByIdDto, UserEmailDto, ContactUsDto, WelcomeUserDto,
     updateLastVisitTimeDto, sendPhotoReminderDto } from "../dtos";
import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";

class userController extends baseController {
    constructor() {
        super('/user')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/edit_profile`, validationMiddleware(editProfileDto), authMiddleware(), this.editProfile)  
        this.router.post(`${this.parentRouterPath}/uploadCoverPhoto`, validationMiddleware(uploadCoverPhotoDto), authMiddleware(), this.uploadCoverPhoto)  
        this.router.post(`${this.parentRouterPath}/changepassword`, validationMiddleware(changePasswordDto), authMiddleware(), this.changePassword)  
        this.router.post(`${this.parentRouterPath}/get_user_profile`, validationMiddleware(UserByIdDto), authMiddleware(), this.getUserProfile)
        this.router.post(`${this.parentRouterPath}/add_newsletter_recipient`, validationMiddleware(UserEmailDto), this.AddNewsletterRecipient)
        this.router.post(`${this.parentRouterPath}/contact-us`, validationMiddleware(ContactUsDto), this.ContactUs)
        this.router.post(`${this.parentRouterPath}/weeklyTopTenUsers`, authMiddleware(), this.weeklyTopTenUsers)
        this.router.post(`${this.parentRouterPath}/sendPhotoReminder`, validationMiddleware(sendPhotoReminderDto), authMiddleware(), this.sendPhotoReminder)
        this.router.post(`${this.parentRouterPath}/welcome`, validationMiddleware(WelcomeUserDto), authMiddleware(), this.WelcomeUser)
        this.router.post(`${this.parentRouterPath}/testimonials`,   this.getTestimonials)
        this.router.post(`${this.parentRouterPath}/updateLastVisitTime`, validationMiddleware(updateLastVisitTimeDto), authMiddleware(), this.updateLastVisitTime)
        this.router.post(`${this.parentRouterPath}/getPaymentStatus`, authMiddleware(), this.getPaymentStatus)
        this.router.post(`${this.parentRouterPath}/updateSubscriptionReason`, validationMiddleware(updateSubscriptionReasonDto), authMiddleware(), this.AddSubscriptionReason)
        this.router.post(`${this.parentRouterPath}/generateInviteLink`, authMiddleware(), this.generateInviteLink)
        this.router.post(`${this.parentRouterPath}/getAcceptedInviterInvitations`, validationMiddleware(acceptedInviterInvitationDto), authMiddleware(), this.getAcceptedInviterInvitations)
        this.router.post(`${this.parentRouterPath}/getHuntScoreStatus`, authMiddleware(), this.getHuntScoreStatus)
    }


    getPaymentStatus = async(req, res, next) => {
        try{
            const data = await this._userService.getPaymentStatus(req);
            res.send(this._responseTemplate('Success', data, undefined))
        }
        catch(error){
            next(error);
        }
    }
    updateLastVisitTime = async (req, res, next) => {
        try {
            const data = await this._userService.updateLastVisitTime(req);
            res.send(this._responseTemplate('Success', data, undefined))
        } catch (error) {
            next(error)
        }
    } 
    

    editProfile = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            
            const profileData = await this._userService.editProfile(req);
            return res.send(profileData.status === "Error"
                  ? this._responseTemplate('Error', undefined, profileData.message)
                  : this._responseTemplate('Success', profileData, undefined));

        } catch (error) {
            next(error)
        }
    } 

    uploadCoverPhoto = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            
            const data = await this._userService.uploadCoverPhoto(req);
            if(data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data,  undefined));
            }
        } catch (error) {
            next(error)
        }
    } 
    
    sendPhotoReminder = async (req, res, next) => {
        try {
            const data = await this._userService.sendPhotoReminder(req);
            res.send(this._responseTemplate('Success', data, undefined))
        } catch (error) {
            next(error)
        }
    } 

    WelcomeUser = async (req, res, next) => {
        try {
            const data = await this._userService.WelcomeUser(req);
            if(data){
                res.send(this._responseTemplate('Success', data, undefined))
            }
            else{
                res.status(404).send(this._responseTemplate('Error', undefined, 'User Not Exist'));
            }
        } catch (error) {
            next(error)
        }
    } 

    weeklyTopTenUsers = async (req, res, next) => {
        try {
            const data = await this._userService.weeklyTopTenUsers(req);
            if(data.status == "Error"){
                res.status(404).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

    AddSubscriptionReason = async (req, res, next) => {
        try {
            const data = await this._userService.updateSubscriptionReason(req);
            res.send(this._responseTemplate('Success', data, undefined))
        } catch (error) {
            next(error)
        }
    }

    AddNewsletterRecipient =  async (req, res, next) => {
        try {
            const data = await this._userService.AddNewsletterRecipient(req);
            if(data.status == "Error"){
                res.status(404).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

    getTestimonials = async(req, res, next) => {
        try{
            const data = await this._userService.getTestimonials();
            res.send(this._responseTemplate('Success', data, undefined))
        }
        catch(error){
            next(error);
        }
    }


    ContactUs = async(req, res, next) => {
        try{
            const data = await this._userService.ContactUs(req.body)
            if(data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        }
        catch(error){
            next(error);
        }
    }
    
    changePassword = async (req, res, next) => {
        try {
            const updatepassword = await this._userService.changePassword(req.body)
            if (updatepassword) {
                res.status(200).send(this._responseTemplate('Success', updatepassword, undefined))
            } else {
                res.status(404).send(this._responseTemplate('Error', undefined, 'Invalid Email'))
            }
        } catch (error) {
            next(error)
        }
    }

    getUserProfile = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            
            const profileData = await this._userService.getUserProfile(req);
            if(profileData.status && profileData.status == 'Error'){
                return res.status(400).send(this._responseTemplate('Error', undefined, profileData.message))
            }
            else{
                return res.send(this._responseTemplate('Success', profileData, undefined))
            }

        } catch (error) {
            next(error)
        }
    }

   
    generateInviteLink  = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            
            const data = await this._userService.generateInviteLink(req);
            return res.send(this._responseTemplate('Success', data, undefined))

        } catch (error) {
            next(error)
        }
    }

    getAcceptedInviterInvitations = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            
            const data = await this._userService.getAcceptedInvitationsList(req);
            return res.send(this._responseTemplate('Success', data, undefined))

        } catch (error) {
            next(error)
        }
    }

    getHuntScoreStatus = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            
            const data = await this._userService.getHuntScoreStatus(req);
            return res.send(this._responseTemplate('Success', data, undefined))

        } catch (error) {
            next(error)
        }
    }
}

export default userController