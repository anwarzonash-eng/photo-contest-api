import {
  IsString, IsNotEmpty, IsInt, IsOptional, IsIn, IsUrl, ValidateIf, IsArray,
  ArrayNotEmpty, ValidateNested, IsBoolean
} from 'class-validator';
import 'reflect-metadata';
import { Type, Transform } from 'class-transformer';


export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  email;

  @IsString()
  @IsNotEmpty()
  password;
}

export class updateActivityPageCalloutDto {
  @IsNotEmpty()
  @IsString()
  id;


  @IsString()
  @IsNotEmpty()
  title;


  @IsString()
  @IsNotEmpty()
  subTitle;


  @IsString()
  @IsNotEmpty()
  CTA;


  @IsUrl()
  @IsNotEmpty()
  CTA_Url;
}



export class stopUserNotificationDto {
  @IsString()
  @IsNotEmpty()
  notificationId;


  @IsNotEmpty()
  @IsBoolean()
  isStopped;
}


class TargetConditionDto {
  @IsString()
  @IsNotEmpty()
  type;


  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  value;
}




export class UserNotificationDto {
  @IsOptional()
  @IsString()
  notificationId;


  @IsString()
  @IsNotEmpty()
  message;


  @IsOptional()
  @IsString()
  btnLabel;


  @IsOptional()
  @IsString()
  btnUrl;


  @IsNotEmpty()
  @IsIn(['immediate', 'scheduled'])
  postedType;


  @IsString()
  @ValidateIf((o => o.postedType === 'scheduled'))
  @IsNotEmpty()
  postedAt;


  @IsNotEmpty()
  @IsIn(['never', 'scheduled'])
  expirationType;

  @IsOptional()
  photo_url;

  @IsString()
  @ValidateIf((e => e.expirationType === 'scheduled'))
  @IsNotEmpty()
  expiredAt;


  @IsNotEmpty()
  @IsString()
  shownNoOfTimes;



  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TargetConditionDto)
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    }
    return value;
  })
  target_conditions;
}


export class fetchUserNotificationDto {
  @IsInt()
  @IsNotEmpty()
  offSet;


  @IsInt()
  @IsNotEmpty()
  limit;
}





export class getUsersListDto {
  @IsInt()
  @IsNotEmpty()
  offSet;

  @IsInt()
  @IsNotEmpty()
  limit;

  @IsOptional()
  @IsString()
  @IsIn(['account_status', 'name', 'email', 'login', 'instagram_link', 'location',
    'last_activity', 'hunted', 'portfolio', 'comments_given', 'upvotes_given',
    'comments_received', 'votes_received', 'top_upvotes_received',
    'top_ten', 'following_count', 'followers_count'])
  sortBy;

  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  sortType;


  @IsOptional()
  @IsString()
  searchKeyword;
}


export class updateUserByIdDto {
  @IsString()
  @IsNotEmpty()
  userId;

  @IsString()
  @IsOptional()
  name;

  @IsString()
  @IsOptional()
  @IsIn(['Active', 'Pause', 'Closed'])
  status;
}


export class downloadWeeklyTopTenDto {
  @IsString()
  @IsNotEmpty()
  fileName;

  @IsString()
  @IsNotEmpty()
  weekDate;
}


export class getWeeklyTopTenListDto {
  @IsInt()
  @IsNotEmpty()
  offSet;


  @IsInt()
  @IsNotEmpty()
  limit;
}