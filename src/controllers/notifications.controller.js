import baseController from "./base.controller"
import { validationMiddleware, authMiddleware} from '../middleware';
import { notifyUserDto, sendthanksDto, notifyComingNextPhotosDto } from "../dtos";
import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";

class notificationController extends baseController {

    constructor() {
        super('/notify')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/user`, validationMiddleware(notifyUserDto), authMiddleware(), this.viewAllNotifications)  
        this.router.post(`${this.parentRouterPath}/sendthanks`, validationMiddleware(sendthanksDto), authMiddleware(), this.sendThanksMsg)  
        this.router.post(`${this.parentRouterPath}/getNotification`, authMiddleware(), this.getNotification) 
        this.router.post(`${this.parentRouterPath}/comingNextPhotos`, validationMiddleware(notifyComingNextPhotosDto), authMiddleware(), this.notifyComingNextPhotos) 
    }

    

    viewAllNotifications = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            
            const notifications = await this._notificationService.viewAllNotifications(req);
            res.send(this._responseTemplate('Success', notifications, undefined))

        } catch (error) {
            next(error)
        }
    }


    getNotification = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            
            const notifications = await this._notificationService.getNotification(req);
            res.send(this._responseTemplate('Success', notifications, undefined))

        } catch (error) {
            next(error)
        }
    }
    
    sendThanksMsg = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
                
            const notifications = await this._notificationService.sendThanksMsg(req);
            res.send(this._responseTemplate('Success', notifications, undefined))

        } catch (error) {
            next(error)
        }
    }

    notifyComingNextPhotos = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
                
            const notifications = await this._notificationService.NotifyComingNextPhotos(req);
            res.send(this._responseTemplate('Success', notifications, undefined))

        } catch (error) {
            next(error)
        }
    }

}

export default notificationController