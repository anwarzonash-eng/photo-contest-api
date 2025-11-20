import baseController from "./base.controller"
import { validationMiddleware, authMiddleware } from '../middleware';
import { photoVaultLogsDto, createFolderDto, getPhotosListDto, updateFolderDto, uploadPhotosToVaultDto,
    uploadPhotosToS3Dto, downloadBackBlazePhotosDto, deleteVaultPhotosDto
} from "../dtos";


class personalPageVaultController extends baseController {

    constructor() {
        super('/vault')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/uploadPhotos`,  validationMiddleware(uploadPhotosToS3Dto), authMiddleware(), this.UploadPhotos)
        this.router.post(`${this.parentRouterPath}/createFolder`, validationMiddleware(createFolderDto), authMiddleware(), this.CreateNewFolder)
        this.router.post(`${this.parentRouterPath}/updateFolder`, validationMiddleware(updateFolderDto), authMiddleware(), this.UpdateFolderName)
        this.router.post(`${this.parentRouterPath}/getFoldersList`, authMiddleware(), this.getFoldersList)
        this.router.post(`${this.parentRouterPath}/getPhotosList`, validationMiddleware(getPhotosListDto), authMiddleware(), this.getPhotosList)
        this.router.post(`${this.parentRouterPath}/uploadPhotosToVault`, validationMiddleware(uploadPhotosToVaultDto), authMiddleware(), this.UploadPhotosToVault)
        this.router.post(`${this.parentRouterPath}/stats`,  authMiddleware(), this.getPhotoVaultStats)
        this.router.post(`${this.parentRouterPath}/logs`, validationMiddleware(photoVaultLogsDto), authMiddleware(), this.getPhotoVaultLogs)
        this.router.post(`${this.parentRouterPath}/downloadBackBlazePhotos`, validationMiddleware(downloadBackBlazePhotosDto), authMiddleware(), this.downloadBackBlazePhotos)
        this.router.post(`${this.parentRouterPath}/deleteVaultPhotos`, validationMiddleware(deleteVaultPhotosDto), authMiddleware(), this.deleteVaultPhotos)
    }


    
    UploadPhotos = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.UploadPhotos(req);
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }


    deleteVaultPhotos = async (req, res, next) => {
        try {

              const data = await this._personalPageVaultService.DeleteVaultPhotos(req);
                if(data && data?.status == 'Error'){
                    res.status(400).send(this._responseTemplate('Error', undefined, data.message))
                }
                else{

                    res.send(this._responseTemplate('Success', data, undefined))
                }
        }
        catch (error) {
            next(error)
        }
    }


    downloadBackBlazePhotos = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.downloadBackBlazePhotos(req, res);
            if(data){
                if(data?.status == 'Error'){
                    res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
                }
                else{        
                    res.send(this._responseTemplate('Success', data, undefined))            
                }
            }

        } 
        catch (error) {
            next(error)
        }
    }

      
    getPhotoVaultStats = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.getPhotoVaultStats(req);
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

        
    getPhotoVaultLogs = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.getPhotoVaultLogs(req);
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

    UploadPhotosToVault = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.UploadPhotosToVault(req);
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }


      
    CreateNewFolder = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.CreateFolder(req);
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

       
    getFoldersList = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.getFoldersList(req);
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

           
    getPhotosList = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.getPhotosList(req);
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }


      
    UpdateFolderName = async (req, res, next) => {
        try {
         
           const data = await this._personalPageVaultService.UpdateFolderName(req);
            if(data && data?.status == 'Error'){
                res.status(400).send(this._responseTemplate('Error', undefined, data.message)) 
            }
            else{
                res.send(this._responseTemplate('Success', data, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }

       


}

export default personalPageVaultController;