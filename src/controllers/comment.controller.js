import baseController from "./base.controller"
import { validationMiddleware, authMiddleware } from '../middleware';
import { AddCommentDto, listCommentDto, listReplyDto } from "../dtos";
import userNotAuthorizedException from "../exceptions/userNotAuthorized.exception";


class commentController extends baseController {

    constructor() {
        super('/comment')
        this.initializeRouter()
    }

    initializeRouter() {
        this.router.post(`${this.parentRouterPath}/add`, validationMiddleware(AddCommentDto), authMiddleware(), this.addComment)
        this.router.post(`${this.parentRouterPath}/list`,validationMiddleware(listCommentDto), authMiddleware(), this.listComment)
        this.router.post(`${this.parentRouterPath}/list_replies`,validationMiddleware(listReplyDto), authMiddleware(), this.listReplies)
    }


    addComment = async (req, res, next) => {
        try {
            if (!req.userData)
                new userNotAuthorizedException()
            const commentData = await this._commentService.addComment(req)
            return res.send(commentData.status === "Error"
            ? this._responseTemplate('Error', undefined, commentData.message)
            : this._responseTemplate('Success', commentData, undefined));

        } catch (error) {
            next(error)
        }
    }



    listComment = async (req, res, next) => {
        try {        
            if (!req.userData)
                new userNotAuthorizedException()

            const commentData = await this._commentService.listComment(req)
            res.send(this._responseTemplate('Success', commentData, undefined))
        } catch (error) {
            next(error)
        }
    }

    listReplies = async (req, res, next) => {
        try {        
            if (!req.userData)
                new userNotAuthorizedException()

            const Data = await this._commentService.listReplies(req)
            res.send(this._responseTemplate('Success', Data, undefined))
        } catch (error) {
            next(error)
        }
    }
}

export default commentController