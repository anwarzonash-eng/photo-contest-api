import baseController from "./base.controller"
import { validationMiddleware, authMiddleware, conditionalAuthMiddleware,  userRoleMiddleware } from '../middleware';
import { UploadPhotoDto, uploadGalleryPhotoDto, deleteGalleryPhotoDto, viewGalleryPhotoDto, ListPhotosDto, 
    ListPhotoLandingDto, ListPhotoNewMemberDto, PhotoClickedDto, PhotoByIdDto, UserPhotosDto, ListUpvotedPhotoDto,
     WeeklyUpvotedPhotoDto, manageGalleryPhotoDto, editPhotoDto, removeQueuedPhotoDto, getPhotoPerWeekDto, 
     sortQueuedPhotoDto, ParticipatingMemberPhotosDto, heartedGalleryPhotoDto, boostWeeklyPhotoDto,  RemovePhotoDto,
     updateComingNextPhotoDto, listComingNextPhotoDto, updateViewedPhotoDto } from "../dtos";
import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";

class photoController extends baseController {

    constructor() {
        super('/photo')
        this.initializeRouter()
    }

    initializeRouter() {

        this.router.post(`${this.parentRouterPath}/add`, validationMiddleware(UploadPhotoDto), authMiddleware(), this.addPhoto)
        this.router.post(`${this.parentRouterPath}/remove`, validationMiddleware(RemovePhotoDto), userRoleMiddleware(), this.removeUserPhotos)
        this.router.post(`${this.parentRouterPath}/list_photo_for_landing`, validationMiddleware(ListPhotoLandingDto), this.listPhotoForLanding)
        this.router.post(`${this.parentRouterPath}/list`, validationMiddleware(ListPhotosDto), authMiddleware(), this.listPhoto)
        this.router.post(`${this.parentRouterPath}/list_photo_for_new_members`, validationMiddleware(ListPhotoNewMemberDto), conditionalAuthMiddleware, this.listPhotoForNewMembers)
        this.router.post(`${this.parentRouterPath}/list_upvoted_photo`, validationMiddleware(ListUpvotedPhotoDto), authMiddleware(), this.listUpvotedPhotos)
        this.router.post(`${this.parentRouterPath}/get_photo_by_id`, validationMiddleware(PhotoByIdDto), conditionalAuthMiddleware, this.getPhotoById)
        this.router.post(`${this.parentRouterPath}/weekly_upvoted_photos`, validationMiddleware(WeeklyUpvotedPhotoDto), conditionalAuthMiddleware, this.listWeeklyUpvotedPhotos)
        this.router.post(`${this.parentRouterPath}/get_past_upvoted_weeks`, conditionalAuthMiddleware, this.getPastUpvotedWeeks)
        this.router.post(`${this.parentRouterPath}/edit_photo`, validationMiddleware(editPhotoDto), authMiddleware(), this.editPhoto)
        this.router.post(`${this.parentRouterPath}/get_user_photos`, validationMiddleware(UserPhotosDto), authMiddleware(), this.getUserPhotos)
        this.router.post(`${this.parentRouterPath}/get_photo_per_week`, validationMiddleware(getPhotoPerWeekDto), authMiddleware(), this.getPhotoPerWeek)
        this.router.post(`${this.parentRouterPath}/updateViewedPhotos`, validationMiddleware(updateViewedPhotoDto), authMiddleware(), this.updateViewedPhoto);
        //this.router.post(`${this.parentRouterPath}/getQueuedPhotoCount`, authMiddleware(), this.getQueuedPhotoCount)
       
        // Other user photos
        this.router.post(`${this.parentRouterPath}/get_photos_count`, authMiddleware(), this.getPhotosCount)
        this.router.post(`${this.parentRouterPath}/insert_photo_clicked`, validationMiddleware(PhotoClickedDto), this.photo_clicked) 
        this.router.post(`${this.parentRouterPath}/list_participating_members`, validationMiddleware(ParticipatingMemberPhotosDto), authMiddleware(), this.listParticipatingMemberPhotos) 
        
        //gallery photos
        this.router.post(`${this.parentRouterPath}/add-gallery`, validationMiddleware(uploadGalleryPhotoDto), authMiddleware(), this.uploadGalleryPhotos)
        this.router.post(`${this.parentRouterPath}/delete-gallery`, validationMiddleware(deleteGalleryPhotoDto), authMiddleware(), this.deleteGalleryPhotos)
        this.router.post(`${this.parentRouterPath}/view-gallery`, validationMiddleware(viewGalleryPhotoDto), authMiddleware(), this.viewGalleryPhotos)
        this.router.post(`${this.parentRouterPath}/manage-gallery`, validationMiddleware(manageGalleryPhotoDto), authMiddleware(), this.manageGalleryPhotos)


        // queued photos api
        this.router.post(`${this.parentRouterPath}/view_queued_photo`, authMiddleware(), this.getQueuedPhotos)
        this.router.post(`${this.parentRouterPath}/sort_queued_photo`, authMiddleware(), validationMiddleware(sortQueuedPhotoDto), this.sortQueuedPhotos)
        this.router.post(`${this.parentRouterPath}/remove_queued_photo`, validationMiddleware(removeQueuedPhotoDto), authMiddleware(), this.removeQueuedPhoto)
    
        // hearted gallery photos api
        this.router.post(`${this.parentRouterPath}/heartedGalleryPhoto`, validationMiddleware(heartedGalleryPhotoDto), authMiddleware(), this.heartedGalleryPhoto)
    
        // Coming Next Photos 
        this.router.post(`${this.parentRouterPath}/updateComingNextPhoto`, validationMiddleware(updateComingNextPhotoDto), authMiddleware(), this.updateComingNextPhoto)
        this.router.post(`${this.parentRouterPath}/listComingNextPhotos`,  validationMiddleware(listComingNextPhotoDto), authMiddleware(), this.listComingNextPhotos)

        // boost weekly photos
        this.router.post(`${this.parentRouterPath}/boostWeeklyPhotos`, validationMiddleware(boostWeeklyPhotoDto), authMiddleware(), this.boostWeeklyPhotos)
    }
    
    

    /*
    getQueuedPhotoCount = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photoData = await this._photoService.getQueuedPhotoCount(req);
            if(photoData.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photoData, undefined))
            }
        } catch (error) {
            next(error)
        }
    }  
    */


    addPhoto = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photoData = await this._photoService.addPhoto(req);
            if(photoData.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photoData, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

     removeUserPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photoData = await this._photoService.removeUserPhotos(req);
            if(photoData.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photoData, undefined))
            }
        } catch (error) {
            next(error)
        }
    }


    
    
    updateViewedPhoto = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photoData = await this._photoService.updateViewedPhoto(req);
            res.send(this._responseTemplate('Success', photoData, undefined))
            
        } catch (error) {
            next(error)
        }
    }

    getPhotoPerWeek = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const data = await this._photoService.getPhotoPerWeek(req);
            if(data.status && data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.status(200).send(this._responseTemplate('Success', data, undefined)) 
            }
        }catch(err){
            next(err)
        }
    }


    editPhoto = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photoData = await this._photoService.editPhoto(req);
            if(photoData.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photoData, undefined))
            }
        } catch (error) {
            next(error)
        }
    }




    listPhotoForLanding = async (req, res, next) => {
        try {

            if (!req.userData)
                new userNotAuthorizedException()               

            const photosData = await this._photoService.listPhotoForLanding(req)
            res.send(this._responseTemplate('Success', photosData, undefined))
        } catch (error) {
            next(error)
        }
    }


    listPhoto = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
                
            var userId =  req.userData._id;
            if(userId != undefined){
                const photosData = await this._photoService.listPhoto(req, userId)
                res.send(this._responseTemplate('Success', photosData, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

    listParticipatingMemberPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
                
            const photosData = await this._photoService.listParticipatingMemberPhotos(req)
            res.send(this._responseTemplate('Success', photosData, undefined))
        } 
        catch (error) {
            next(error)
        }
    }

    listUpvotedPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photosData = await this._photoService.listUpvotedPhotos(req)
            res.send(this._responseTemplate('Success', photosData, undefined))
        } catch (error) {
            next(error)
        }
    }

    getPastUpvotedWeeks = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const data = await this._photoService.getPastUpvotedWeeks();
            if(data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

    listWeeklyUpvotedPhotos  = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photosData = await this._photoService.listWeeklyUpvotedPhotos(req);
            res.send(this._responseTemplate('Success', photosData, undefined))
        } catch (error) {
            next(error)
        }
    }

  


    listPhotoForNewMembers = async(req, res, next) => {
        try {               
            var userId;
            if(req.userData != undefined){
                userId= req.userData._id;
            }
                
            const photosData = await this._photoService.listPhotoForNewMembers(req.body, userId);
            res.send(this._responseTemplate('Success', photosData, undefined))
        } catch (error) {
            next(error)
        }
    }

    getPhotoById = async(req, res, next) => {
        try {

            var userId;
            if(req.userData != undefined){
                userId= req.userData._id;
            }
            
            const photoData = await this._photoService.getPhotoById(req, userId)
            res.send(this._responseTemplate('Success', photoData, undefined))
        }
        catch(error) {
            next(error)
        }

    }

    getUserPhotos = async(req, res, next) => {
        try {

            if (!req.userData)
                new userNotAuthorizedException()   
                
            const photosData = await this._photoService.getUserPhotos(req);
            if(photosData && photosData.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, photosData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photosData, undefined));
            }
        }
        catch (error) {
            next(error)
        }
    }

    getPhotosCount = async(req, res, next) => {
        try {

            if (!req.userData)
                new userNotAuthorizedException()   
                
            const photosCount = await this._photoService.getPhotosCount(req)
            res.send(this._responseTemplate('Success', photosCount, undefined))
        }catch (error) {
            next(error)
        }
    }


    photo_clicked = async(req, res, next) => {
        try {                
            const photosData = await this._photoService.photo_clicked(req.body)
            res.send(this._responseTemplate('Success', photosData, undefined))
        }catch (error) {
            next(error)
        }
    }

    uploadGalleryPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photoData = await this._photoService.uploadGalleryPhotos(req);
            if(photoData.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photoData, undefined))
            }
        } catch (error) {
            next(error)
        }
    } 

    deleteGalleryPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photoData = await this._photoService.deleteGalleryPhotos(req);
            if(photoData.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photoData, undefined))
            }
        } catch (error) {
            next(error)
        }
    } 

    viewGalleryPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photoData = await this._photoService.viewGalleryPhotos(req);
            if(photoData.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photoData, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

    manageGalleryPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const data = await this._photoService.manageGalleryPhotos(req);
            if(data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

    removeQueuedPhoto = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const data = await this._photoService.removeQueuedPhoto(req);
            if(data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

    getQueuedPhotos =  async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const data = await this._photoService.getQueuedPhotos(req);
            if(data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

    sortQueuedPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const data = await this._photoService.sortQueuedPhotos(req);
            if(data.status && data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

    heartedGalleryPhoto = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const data = await this._photoService.heartedGalleryPhoto(req);
            if(data.status && data.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message));
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

    listComingNextPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photosData = await this._photoService.listComingNextPhotos(req)
            res.send(this._responseTemplate('Success', photosData, undefined))
        } 
        catch (error) {
            next(error)
        }
    }

    updateComingNextPhoto = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photosData = await this._photoService.updateComingNextPhoto(req)
            res.send(this._responseTemplate('Success', photosData, undefined))
        } catch (error) {
            next(error)
        }
    }

    boostWeeklyPhotos = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const photosData = await this._photoService.boostWeeklyPhotos(req);
            if(photosData && photosData.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, photosData.message));
            }
            else{
                res.send(this._responseTemplate('Success', photosData, undefined))     
            }        
        } 
        catch (error) {
            next(error)
        }
    }

}

export default photoController