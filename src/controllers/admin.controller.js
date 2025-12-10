import baseController from "./base.controller"
import { validationMiddleware, userRoleMiddleware, authMiddleware } from '../middleware';
import { AdminLoginDto, getUsersListDto, updateUserByIdDto, getWeeklyTopTenListDto, 
    downloadWeeklyTopTenDto, UserNotificationDto, fetchUserNotificationDto, updateActivityPageCalloutDto,
    stopUserNotificationDto 
} from "../dtos";

// admin controller
class adminController extends baseController {

    constructor() {
        super('/admin')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/login`, validationMiddleware(AdminLoginDto), this.AdminLogin)
        this.router.post(`${this.parentRouterPath}/getAllUsersList`, validationMiddleware(getUsersListDto), this.getAllUsersList)
        this.router.post(`${this.parentRouterPath}/updateUser`, validationMiddleware(updateUserByIdDto), this.updateUserById)
        this.router.post(`${this.parentRouterPath}/weeklyTopTenList`, validationMiddleware(getWeeklyTopTenListDto), this.getWeeklyTopTenList)
        this.router.post(`${this.parentRouterPath}/downloadWeeklyTopTen`, validationMiddleware(downloadWeeklyTopTenDto), this.downloadWeeklyTopTen)
        
        // Admin User Notifications APIs
        this.router.post(`${this.parentRouterPath}/addUserNotifications`, validationMiddleware(UserNotificationDto), userRoleMiddleware(), this.AddUserNotifications)
        this.router.post(`${this.parentRouterPath}/fetchUserNotifications`, validationMiddleware(fetchUserNotificationDto), userRoleMiddleware(), this.fetchUserNotifications)
        this.router.post(`${this.parentRouterPath}/stopUserNotification`, validationMiddleware(stopUserNotificationDto), userRoleMiddleware(), this.stopUserNotification)



        // Activity Page Callout APIs
        this.router.post(`${this.parentRouterPath}/fetchActivityCallout`, this.fetchActivityPageCallout)
        this.router.post(`${this.parentRouterPath}/updateActivityCallout`, validationMiddleware(updateActivityPageCalloutDto), userRoleMiddleware(), this.updateActivityPageCallout)
    }



    AdminLogin = async (req, res, next) => {
        try {
            const user = await this._adminService.AdminLogin(req.body.email, req.body.password)
            if (user.status=="Error") {
                res.status(404).send(this._responseTemplate('Error', undefined, user.message))
            } else {
                res.status(200).send(this._responseTemplate('Success', user, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

    fetchActivityPageCallout = async (req, res, next) => {
        try {
            const data = await this._adminService.FetchActivityPageCallout() 
            if (data && data.status=="Error") { 
                res.status(404).send(this._responseTemplate('Error', undefined, data.message))
            }   
            else {
                res.status(200).send(this._responseTemplate('Success', data, undefined))

            }
        }
        catch (error) {
            next(error)
        }   
    }


    updateActivityPageCallout = async (req, res, next) => {
        try {
            const data = await this._adminService.UpdateActivityPageCallout(req)
            if (data && data.status=="Error") {
                res.status(404).send(this._responseTemplate('Error', undefined, data.message))
            } 
            else {
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

   
   
    AddUserNotifications = async (req, res, next) => {
        try {
            const data = await this._adminService.AddUserNotifications(req)
            if (data && data.status=="Error") {
                res.status(404).send(this._responseTemplate('Error', undefined, data.message))
            } else {
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
        } catch (error) {
            next(error)
        }
    }

       
    fetchUserNotifications = async (req, res, next) => {
        try {
            const data = await this._adminService.FetchUserNotifications(req)
            if (data && data.status == "Error") {
                res.status(404).send(this._responseTemplate('Error', undefined, data.message))
            } else {
                res.status(200).send(this._responseTemplate('Success', data, undefined))
            }
        } catch (error) {
            next(error)
        }
    }


    stopUserNotification = async (req, res, next) => {
        try {            
                const data = await this._adminService.StopUserNotification(req)
                if (data && data.status == "Error") {
                    res.status(404).send(this._responseTemplate('Error', undefined, data.message))
                } 
                else {
                    res.status(200).send(this._responseTemplate('Success', data, undefined))
                }
        } 
        catch (error) {
            next(error)
        }
    }



    getAllUsersList = async (req, res, next) => {
        try {
            const user = await this._adminService.getAllUsersList(req.body)
            res.status(200).send(this._responseTemplate('Success', user, undefined))
        } catch (error) {
            next(error)
        }
    }


    updateUserById = async (req, res, next) => {
        try {
            const user = await this._adminService.updateUserById(req.body);
            if (user.status=="Error") {
                res.status(404).send(this._responseTemplate('Error', undefined, user.message))
            } 
            else {
                res.status(200).send(this._responseTemplate('Success', user, undefined))
            }
            
        } 
        catch (error) {
            next(error)
        }
    }

    getWeeklyTopTenList = async (req, res, next) => {
        try {
            const data = await this._adminService.getWeeklyTopTenList(req.body);
            res.status(200).send(this._responseTemplate('Success', data, undefined))
        } 
        catch (error) {
            next(error)
        }
    }


    downloadWeeklyTopTen = async (req, res, next) => {
        try {
            await this._adminService.downloadWeeklyTopTen(req, res);     
        } 
        catch (error) {
            next(error)
        }
    }
}

export default adminController