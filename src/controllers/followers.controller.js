import baseController from "./base.controller"
import { validationMiddleware, authMiddleware } from '../middleware';
import {FollowUserDto, getFollowUserDto, followerUpvotedPhotoDto} from "../dtos";
import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";


class followersController extends baseController {

    constructor() {
        super('/follow')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/user`, validationMiddleware(FollowUserDto), authMiddleware(), this.followUser)
        this.router.post(`${this.parentRouterPath}/list`, validationMiddleware(getFollowUserDto), authMiddleware(), this.viewFollowDetail)
        this.router.post(`${this.parentRouterPath}/upvoted_photos`, validationMiddleware(followerUpvotedPhotoDto), authMiddleware(), this.followerUpvotedPhoto)
    }
    

    followUser = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            const followData = await this._followerService.followUser(req)
            res.send(this._responseTemplate('Success', followData, undefined))

        } catch (error) {
            next(error)
        }
    }

    viewFollowDetail = async(req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const followData = await this._followerService.viewFollowDetail(req)
            res.send(this._responseTemplate('Success', followData, undefined))

        } catch (error) {
            next(error)
        }
    }

    followerUpvotedPhoto = async(req, res,next) => {
        try{
            if (!req.userData)
            new userNotAuthorizedException()

            const Data = await this._followerService.followerUpvotedPhoto(req)
            res.send(this._responseTemplate('Success', Data, undefined))
        }
        catch(err){
            next(err);
        }
    }
}

export default followersController