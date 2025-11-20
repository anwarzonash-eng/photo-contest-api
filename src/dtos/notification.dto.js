import { IsNotEmpty, IsNumber, IsString, IsBoolean, IsIn, ValidateIf, IsOptional } from 'class-validator';
import 'reflect-metadata';

export class notifyUserDto {
    @IsNumber()
    @IsNotEmpty()
    offset;
}


export class AddNotificationViewCountDto {
    @IsString()
    @IsNotEmpty()
    notificationId;
}


export class sendthanksDto{
    @IsString()
    @IsNotEmpty()
    user_id;

    @IsString()
    @IsNotEmpty()
    @IsIn(['thanks_on_upvote','thanks_on_weeklytopten_congratulation', 'thanks_on_upvote_comment','thanks_weekly_toptenuser', 'congratulate_weekly_toptenuser'])
    notification_type;

    @IsString()
    @ValidateIf((o => o.notification_type !== 'thanks_weekly_toptenuser' && o.notification_type !=='thanks_on_upvote_comment'))
    @IsNotEmpty()
    photo_id;


    @IsString()
    @ValidateIf((o => o.notification_type == 'thanks_on_upvote_comment'))
    @IsNotEmpty()
    comment_id;

    @IsBoolean()
    @IsNotEmpty()
    is_thanked;

    @IsString()
    @IsOptional()
    NotificationId;
}



export class notifyComingNextPhotosDto{
    @IsString()
    @IsNotEmpty()
    photoId;

    @IsString()
    @IsNotEmpty()
    photoMemberId;
  }