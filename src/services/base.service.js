
import { UserModel, NotificationModel, PhotoModel, GalleryPhotoModel, PhotoClickedModel, VoteModel, CommentsModel, 
    FollowersModel, WelcomeUserModel, VoteCommentModel, PhotoViewsModel, InvitationLinksModel,
     HuntScoreModel, LikeGalleryPhotoModel, PhotoNotificationsModel, PersonalWebsiteModel, PersonalPhotoModel,
     PersonalPhotoUpvoteModel, PrevTownHallModel, MonthlyTownHallModel, PersonalPageFollowerModel, 
     PersonalPageFollowEventModel, PersonalPageFollowRelationModel, FoldersModel, PersonalPageVaultPhotosModel,
     PhotoVaultLogsModel, PhotoVaultBatchModel, AdminNotificationTemplateModel, ActivityCalloutModel, 
     UserNotificationStatusModel, TempUserActionsModel, AiReportsModel
} from "../models";

class baseService {    
    _userModel;
    _photoModel;
    _galleryPhotoModel;
    _photoClickedModel;
    _voteModel;
    _voteCommentModel;
    _commentModel;
    _followerModel;
    _welcomeUserModel;
    _notificationModel;
    _photoViewsModel;
    _invitationLinksModel;
    _huntScoreModel;
    _likeGalleryPhotoModel;
    _photoNotificationsModel;
    _personalWebsiteModel;
    _personalPhotoModel;
    _personalPhotoUpvoteModel;
    _prevTownhallModel;
    _monthlyTownhallModel;
    _personalPageFollowerModel;
    _personalPageFollowEventModel;
    _personalPageFollowRelationModel;
    _foldersModel;
    _personalPageVaultPhotosModel;
    _photoVaultLogsModel;
    _photoVaultBatchModel;
    _adminNotificationTemplateModel;
    _activityCalloutModel;
    _userNotificationStatusModel;
    _tempUserActionsModel;
    _AiReportsModel;


    constructor(){
        this._userModel = UserModel
        this._photoModel = PhotoModel;
        this._galleryPhotoModel = GalleryPhotoModel;
        this._photoClickedModel = PhotoClickedModel
        this._voteModel = VoteModel;
        this._voteCommentModel = VoteCommentModel;
        this._commentModel = CommentsModel;
        this._followerModel = FollowersModel;
        this._welcomeUserModel = WelcomeUserModel;
        this._notificationModel = NotificationModel;
        this._photoViewsModel = PhotoViewsModel;
        this._invitationLinksModel = InvitationLinksModel;
        this._huntScoreModel = HuntScoreModel;
        this._likeGalleryPhotoModel = LikeGalleryPhotoModel;
        this._photoNotificationsModel = PhotoNotificationsModel;
        this._personalWebsiteModel = PersonalWebsiteModel;
        this._personalPhotoModel = PersonalPhotoModel;
        this._personalPhotoUpvoteModel = PersonalPhotoUpvoteModel;
        this._prevTownhallModel = PrevTownHallModel;
        this._monthlyTownhallModel = MonthlyTownHallModel;
        this._personalPageFollowerModel = PersonalPageFollowerModel;
        this._personalPageFollowEventModel = PersonalPageFollowEventModel;
        this._personalPageFollowRelationModel = PersonalPageFollowRelationModel;
        this._foldersModel = FoldersModel;
        this._personalPageVaultPhotosModel = PersonalPageVaultPhotosModel;
        this._photoVaultLogsModel = PhotoVaultLogsModel;
        this._photoVaultBatchModel = PhotoVaultBatchModel;
        this._adminNotificationTemplateModel = AdminNotificationTemplateModel;
        this._activityCalloutModel = ActivityCalloutModel;
        this._userNotificationStatusModel = UserNotificationStatusModel;   
        this._tempUserActionsModel = TempUserActionsModel; 
        this._AiReportsModel = AiReportsModel;
    }
}

export default baseService;