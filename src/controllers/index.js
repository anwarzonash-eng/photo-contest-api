import authController from "./auth.controller.js";
import commentController from "./comment.controller.js";
import photoController from "./photo.controller.js";
import voteController from "./vote.controller.js";
import userController from "./user.controller.js";
import followersController from "./followers.controller.js";
import notificationController from "./notifications.controller.js";
import paymentController from "./payment.controller.js";
import adminController from "./admin.controller.js";
import personalWebsiteController from "./personal_website.controller.js";
import townhallController from "./townhall.controller.js";
import personalPageFollowersController from "./personalPageFollowers.controller.js";
import personalPageVaultController from "./personalPageVault.controller.js";


export const controllers = function name() {
    return [
        new authController(),
        new photoController(),
        new voteController(),
        new commentController(),
        new userController(),
        new followersController(),
        new notificationController(),
        new paymentController(),
        new adminController(),
        new personalWebsiteController(),
        new townhallController(),
        new personalPageFollowersController(),
        new personalPageVaultController(),
        new AIReportsController(),
        new chatgptController()
    ]
}