import express from "express";
import { authService } from "../services/auth.service.js";
import { photoService } from "../services/photo.service.js";
import { responseTemplate } from "../enums/responseTemplate.enum.js";
import { voteService } from "../services/vote.service.js";
import { userService } from "../services/user.service.js";
import { commentService } from "../services/comment.service.js";
import { followerService } from "../services/followers.service";
import {notificationService} from "../services/notification.service.js";
import { paymentService } from "../services/payment.service.js";
import { adminService } from "../services/admin.service.js";
import {personalWebsiteService} from "../services/personal_website.service.js";
import { townhallService } from "../services/townhall.service.js";
import { personalPageFollowersService } from "../services/personalPageFollowers.service.js";
import { personalPageVaultService } from "../services/personalPageVault.service.js";


class baseController {

    router;
    parentRouterPath;
    _authService;
    _adminService;
    _photoService;
    _voteService;
    _commentService;
    _userService;
    _notificationService;
    _followerService;
    _responseTemplate;
    _paymentService;
    _personalWebsiteService;
    _townhallService;
    _personalPageFollowersService;
    _personalPageVaultService;
    _aiReportService;
    _chatgptService;


    constructor(routerPath){

        this.parentRouterPath = routerPath;
        this.router = express.Router();

        this._authService = new authService()
        this._adminService = new adminService()
        this._photoService = new photoService()
        this._voteService = new voteService()
        this._commentService = new commentService()
        this._userService = new userService()
        this._followerService = new followerService()
        this._notificationService = new notificationService()
        this._paymentService = new paymentService()
        this._personalWebsiteService = new personalWebsiteService()
        this._townhallService = new townhallService()
        this._personalPageFollowersService = new personalPageFollowersService()
        this._personalPageVaultService = new personalPageVaultService()
        this._aiReportService = new AIReportsService()
        this._chatgptService = new chatgptService()
        
        this._responseTemplate = responseTemplate;

    }
}

export default baseController;