import baseController from "./base.controller"
import { validationMiddleware } from '../middleware';
import { CreateUserDto, LogInUserDto, GetSingleUserByEmailDto, forgetPasswordDto, resetPasswordDto } from "../dtos";


class authController extends baseController {

    constructor() {
        super('/auth')
        this.initializeRouter()

    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/registeruser`, validationMiddleware(CreateUserDto), this.registerUser)
        this.router.post(`${this.parentRouterPath}/upvoteByBatch`, this.upvoteByBatch)
        this.router.post(`${this.parentRouterPath}/login`, validationMiddleware(LogInUserDto), this.login)
        this.router.post(`${this.parentRouterPath}/user`, validationMiddleware(GetSingleUserByEmailDto), this.checkUserExistenceByEmail)
        this.router.post(`${this.parentRouterPath}/me`, validationMiddleware(GetSingleUserByEmailDto), this.getUserProfileByEmail)
        this.router.post(`${this.parentRouterPath}/forgetPassword`, validationMiddleware(forgetPasswordDto), this.forgetPassword)
        this.router.post(`${this.parentRouterPath}/resetPassword`, validationMiddleware(resetPasswordDto), this.resetPassword)
    }

    registerUser = async (req, res, next) => {
        try {
            const user = await this._authService.isUserExist(req.body.email);
            if (user) {
                return res.status(400).send(this._responseTemplate('Error', undefined, 'This user already exists. Please sign in below.'))
            }
            else{
                const userData = await this._authService.registerUser(req);
                if(userData.status=="Error"){
                    res.status(404).send(this._responseTemplate('Error', undefined, userData.message))
                }
                else{
                    res.status(200).send(this._responseTemplate('Success', userData, undefined))
                }
            }
        } catch (error) {
            next(error)
        }

    }

    
    upvoteByBatch = async (req, res, next) => {
        try {
            const user = await this._authService.addCommentsByBatchId(req.body.userId, req.body.batchId)
            if (user && user.status=="Error") {
                res.status(404).send(this._responseTemplate('Error', undefined, user.message))
            } else {
                res.status(200).send(this._responseTemplate('Success', user, undefined))
            }

        } catch (error) {
            next(error)
        }
    }



    login = async (req, res, next) => {
        try {
            const user = await this._authService.login(req.body.emailOrUsername, req.body.password)
            if (user.status=="Error") {
                res.status(404).send(this._responseTemplate('Error', undefined, user.message))
            } else {
                res.status(200).send(this._responseTemplate('Success', user, undefined))
            }

        } catch (error) {
            next(error)
        }
    }

    forgetPassword = async(req, res, next) => {
        try{
            const user = await this._authService.forgetPassword(req.body.email)
            if(user.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, user.message));
            }
            else{
                res.send(this._responseTemplate('Success', user, undefined))
            }
        }  
        catch (error) {
            next(error)
        }
    }

    resetPassword = async(req, res, next) => {
        try{
            const user = await this._authService.resetPassword(req);
            if(user.status == "Error"){
                res.status(400).send(this._responseTemplate('Error', undefined, user.message));
            }
            else{
                res.send(this._responseTemplate('Success', user, undefined))
            }
        } 
        catch (error) {
            next(error)
        }
    }


    getUserProfileByEmail = async (req, res, next) => {
        try {
            const user = await this._authService.getUserProfileByEmail(req.body.email)
            if (user) {
                res.status(200).send(this._responseTemplate('Success', user, undefined))
            } else {
                res.status(400).send(this._responseTemplate('Error', undefined, `We don't recognize that username or password. Email us at`))
                
            }
        } catch (error) {
            next(error)
        }
    }

    checkUserExistenceByEmail  = async (req, res, next) => {
        try {

            let {email, referral_code, userType, batchId } = req.body;
            const user = await this._authService.checkUserExistenceByEmail(email, referral_code, userType, batchId);
            if (user) {
                if(user.message){
                    res.status(400).send(this._responseTemplate('Error', undefined, user.message))
                }
                else{
                    res.status(200).send(this._responseTemplate('Success', user, undefined))
                }
            } else {
                res.status(400).send(this._responseTemplate('Error', undefined, `We don't recognize that username or password. Email us at`))
                
            }
        } catch (error) {
            next(error)
        }
    }
}

export default authController