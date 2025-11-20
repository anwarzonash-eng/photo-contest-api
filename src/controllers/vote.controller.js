import baseController from "./base.controller"
import { validationMiddleware, authMiddleware, conditionalAuthMiddleware } from '../middleware';
import { PerformVoteDto, VoteCommentDto } from "../dtos";
import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";

class voteController extends baseController {

    constructor() {
        super('/vote')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/perform`, validationMiddleware(PerformVoteDto), conditionalAuthMiddleware, this.performVote)  
        this.router.post(`${this.parentRouterPath}/personal_photo`, validationMiddleware(PerformVoteDto), authMiddleware(), this.performVoteOnPersonalPhoto)  
        this.router.post(`${this.parentRouterPath}/comment`, validationMiddleware(VoteCommentDto), authMiddleware(), this.performVoteOnComment)        
    }

    performVote = async (req, res, next) => {
        try {

            const response = await this._voteService.performVote(req)
            return res.send(response.status === "Error"
            ? this._responseTemplate('Error', undefined, response.message)
            : this._responseTemplate('Success', response, undefined));

        } catch (error) {
            next(error)
        }
    }

    performVoteOnPersonalPhoto = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const response = await this._voteService.performVoteOnPersonalPhoto(req)
            return res.send(response.status === "Error"
            ? this._responseTemplate('Error', undefined, response.message)
            : this._responseTemplate('Success', response, undefined));

        } catch (error) {
            next(error)
        }
    }


    performVoteOnComment = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()

            const response = await this._voteService.performVoteOnComment(req)
            return res.send(response.status === "Error"
            ? this._responseTemplate('Error', undefined, response.message)
            : this._responseTemplate('Success', response, undefined));

        } catch (error) {
            next(error)
        }
    }
}

export default voteController