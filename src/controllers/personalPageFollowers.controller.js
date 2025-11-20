import baseController from "./base.controller"
import { validationMiddleware, authMiddleware } from '../middleware';
import { PersonalPageFollowUserDto, getSuggestedFollowersDto } from "../dtos";


class personalPageFollowersController extends baseController {

    constructor() {
        super('/personal-page')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/followUser`, validationMiddleware(PersonalPageFollowUserDto), authMiddleware(), this.FollowUser)
        this.router.post(`${this.parentRouterPath}/suggestedFollowers`, validationMiddleware(getSuggestedFollowersDto), this.getSuggestedFollowersList)
    }


    
    FollowUser = async (req, res, next) => {
        try {
         
            // personal site follow user
           const data = await this._personalPageFollowersService.followUser(req);
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


     
    getSuggestedFollowersList = async (req, res, next) => {
        try {
         
            const data = await this._personalPageFollowersService.getSuggestedFollowersList(req);
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

export default personalPageFollowersController;
    