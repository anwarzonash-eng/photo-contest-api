import baseController from "./base.controller"
import { validationMiddleware, authMiddleware, conditionalAuthMiddleware,  userRoleMiddleware } from '../middleware';
import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";
import { selectTemplateDto, listPhotosForPersonalWebsiteDto, updatePersonalWebsiteDto, uploadPersonalWebsitePhotosDto,
    fetchPersonalPhotosDto, contactUsDto, fetchPersonalWebsiteDto, confirmUploadedPhotosDto, updatePersonalSiteDto,
    deletePersonalPhotosDto, managePersonalPhotosDto, createPersonalGalleryDto, listPersonalGalleryDto, listHuntedPhotosDto
} from "../dtos";


class personalWebsiteController extends baseController {

    constructor() {
        super('/personal-website');
        this.initializeRouter()
    }

    initializeRouter() {

        this.router.post(`${this.parentRouterPath}/selectTemplate`, validationMiddleware(selectTemplateDto), authMiddleware(), this.addTemplate)
        this.router.post(`${this.parentRouterPath}/fetch`, conditionalAuthMiddleware, validationMiddleware(fetchPersonalWebsiteDto), this.fetchPersonalWebsite)
        this.router.post(`${this.parentRouterPath}/listPhotos`, validationMiddleware(listPhotosForPersonalWebsiteDto), authMiddleware(), this.listPhotos)
        this.router.post(`${this.parentRouterPath}/update`, validationMiddleware(updatePersonalWebsiteDto), authMiddleware(), this.updatePersonalSite)
        this.router.post(`${this.parentRouterPath}/uploadPhotos`, validationMiddleware(uploadPersonalWebsitePhotosDto), authMiddleware(), this.uploadPhotos)
        this.router.post(`${this.parentRouterPath}/photos`, validationMiddleware(fetchPersonalPhotosDto), conditionalAuthMiddleware,  this.fetchPersonalPhotos)
        this.router.post(`${this.parentRouterPath}/contactUs`, validationMiddleware(contactUsDto), this.ContactUs)
        this.router.post(`${this.parentRouterPath}/confirmPhotos`, validationMiddleware(confirmUploadedPhotosDto), authMiddleware(), this.confirmUploadedPhotos)
        this.router.post(`${this.parentRouterPath}/detail`, authMiddleware(), this.getPersonalWebsite)
        this.router.patch(`${this.parentRouterPath}/updateData`, validationMiddleware(updatePersonalSiteDto), authMiddleware(), this.updatePersonalWebsite)
        this.router.post(`${this.parentRouterPath}/delete-personal-photos`, validationMiddleware(deletePersonalPhotosDto), authMiddleware(), this.deletePersonalPhotos)
        this.router.post(`${this.parentRouterPath}/manage-personal-photos`,  validationMiddleware(managePersonalPhotosDto), authMiddleware(), this.managePersonalPhotos)
        this.router.post(`${this.parentRouterPath}/create-personal-gallery`,  validationMiddleware(createPersonalGalleryDto), authMiddleware(), this.CreatePersonalGallery)
        this.router.post(`${this.parentRouterPath}/list-gallery`, authMiddleware(), this.ListPersonalGallery)
      
    }


        addTemplate = async (req, res, next) => {
            try {
                if (!req.userData)
                    new userNotAuthorizedException()
    
                const data = await this._personalWebsiteService.addTemplate(req);         
                res.send(this._responseTemplate('Success', data, undefined));
                
            } 
            catch (error) {
                next(error)
            }
        }


                
        listPhotos = async (req, res, next) => {
            try {
                if (!req.userData)
                    new userNotAuthorizedException()
    
                const data = await this._personalWebsiteService.listPhotos(req);         
                res.send(this._responseTemplate('Success', data, undefined));
                
            } 
            catch (error) {
                next(error)
            }
        }


                 
        fetchPersonalPhotos = async (req, res, next) => {
            try {
    
                const data = await this._personalWebsiteService.fetchPersonalPhotos(req);   
                 if(data && data.status == "Error"){
                    res.status(data.statusCode).send(this._responseTemplate('Error', undefined, data.message));
                }
                else{      
                    res.send(this._responseTemplate('Success', data, undefined));
                }
                
            } 
            catch (error) {
                next(error)
            }
        }




        confirmUploadedPhotos = async (req, res, next) => {
            try {
    
                const data = await this._personalWebsiteService.confirmUploadedPhotos(req);   
                 if(data && data.status == "Error"){
                    res.status(data.statusCode).send(this._responseTemplate('Error', undefined, data.message));
                }
                else{      
                    res.send(this._responseTemplate('Success', data, undefined));
                }
                
            } 
            catch (error) {
                next(error)
            }
        }


   

        updatePersonalSite = async (req, res, next) => {
            try {
                if (!req.userData)
                    new userNotAuthorizedException()

                const photoData = await this._personalWebsiteService.updatePersonalSite(req);
                 if (photoData && photoData.status=="Error") {
                    res.status(400).send(this._responseTemplate('Error', undefined, photoData.message))
                }
                else{
                    res.send(this._responseTemplate('Success', photoData, undefined))
                }
            } 
            catch (error) {
                next(error)
            }
        } 

        fetchPersonalWebsite = async (req, res, next) => {
            try {
                if (!req.userData)
                    new userNotAuthorizedException()

                const photoData = await this._personalWebsiteService.fetchPersonalWebsite(req);
                if (photoData && photoData.status=="Error") {
                    res.status(photoData.statusCode).send(this._responseTemplate('Error', undefined, photoData.message))
                }
                else{
                    res.send(this._responseTemplate('Success', photoData, undefined))
                }
            } 
            catch (error) {
                next(error)
            }
        } 


        uploadPhotos = async (req, res, next) => {
            try {
                if (!req.userData)
                    new userNotAuthorizedException()

                const photoData = await this._personalWebsiteService.uploadPhotos(req);
                if(photoData && photoData.status == "Error"){
                    res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
                }
                else{
                    res.send(this._responseTemplate('Success', photoData, undefined))
                }
            } catch (error) {
                next(error)
            }
        } 


        
        ContactUs = async (req, res, next) => {
            try {
                if (!req.userData)
                    new userNotAuthorizedException()

                const data = await this._personalWebsiteService.ContactUs(req);
                if(data && data.status == "Error"){
                    res.status(400).send(this._responseTemplate('Error', undefined, data.message));
                }
                else{
                    res.send(this._responseTemplate('Success', data, undefined))
                }
            } catch (error) {
                next(error)
            }
        } 

        getPersonalWebsite = async (req, res, next) => {
            try {
                const data = await this._personalWebsiteService.getPersonalWebsite(req);
                if(data && data.status == "Error"){
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

        updatePersonalWebsite = async (req, res, next) => {
            try {
                const data = await this._personalWebsiteService.updatePersonalWebsite(req);
                if(data && data.status == "Error"){
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

        deletePersonalPhotos = async (req, res, next) => {
            try {
        
                    const photoData = await this._personalWebsiteService.deletePersonalPhotos(req);
                    if(photoData && photoData.status == "Error"){
                        res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
                    }
                    else{
                        res.send(this._responseTemplate('Success', photoData, undefined))
                    }
            } 
            catch (error) {
                next(error)
            }
        } 

        
        managePersonalPhotos = async (req, res, next) => {
            try {
        
                    const photoData = await this._personalWebsiteService.managePersonalPhotos(req);
                    if(photoData && photoData.status == "Error"){
                        res.status(400).send(this._responseTemplate('Error', undefined, photoData.message));
                    }
                    else{
                        res.send(this._responseTemplate('Success', photoData, undefined))
                    }
            } 
            catch (error) {
                next(error)
            }
        } 
        

        CreatePersonalGallery = async (req, res, next) => {
            try {
                  
                    const galleryData = await this._personalWebsiteService.CreatePersonalGallery(req);
                    if(galleryData && galleryData.status == "Error"){
                        res.status(400).send(this._responseTemplate('Error', undefined, galleryData.message));
                    }
                    else{
                        res.send(this._responseTemplate('Success', galleryData, undefined))
                    }
                
            }
            catch (error) {
                next(error)
            }
        }


        
        ListPersonalGallery = async (req, res, next) => {
            try {
                  
                    const galleryData = await this._personalWebsiteService.ListPersonalGallery(req);
                    if(galleryData && galleryData.status == "Error"){
                        res.status(400).send(this._responseTemplate('Error', undefined, galleryData.message));
                    }
                    else{
                        res.send(this._responseTemplate('Success', galleryData, undefined))
                    }
                
            }
            catch (error) {
                next(error)
            }
        }

}

export default personalWebsiteController;