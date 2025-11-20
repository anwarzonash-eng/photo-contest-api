import { IsString, IsUUID, ArrayMinSize, ArrayMaxSize, ValidateNested, ArrayNotEmpty, IsNotEmpty, IsBoolean, IsBooleanString, IsOptional, Min, Max, IsIn, IsInt, ValidateIf, IsArray, isNotEmpty} from 'class-validator';
import { Type } from 'class-transformer';
import 'reflect-metadata';

export class UploadPhotoDto{
  @IsOptional()
  photoUrl;

  @IsOptional()
  photoId;

  @IsOptional()
  day;

  @IsBooleanString()
  @IsNotEmpty()
  isQueued;
 
  @IsOptional()
  @IsString()
  description;

  @IsOptional()
  @IsString()
  feedback_type;

  @IsOptional()
  metadata;

  @IsOptional()
  genres_list;
 
  @IsOptional()
  weekDay;

  @IsOptional()
  isGalleryPhoto;
}

export class RemovePhotoDto{
  @IsString()
  @IsNotEmpty()
  photoId;


  @IsNotEmpty()
  @IsIn(['hunted', 'gallery_photo'])
  photoType;
}



export class uploadGalleryPhotoDto{
  @IsNotEmpty()
  photoUrl;

  @IsOptional()
  metadata;
}

export class deleteGalleryPhotoDto{
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4",{ each: true })
  photoId;
}

export class getPhotoPerWeekDto{
  @IsBoolean()
  @IsOptional()
  isQueued;

  @IsBoolean()
  @IsOptional()
  isGallery;
}

export class viewGalleryPhotoDto{
  @IsString() 
  @IsOptional()
  user_id;

  @IsString() 
  @IsOptional()
  profile;

  @IsOptional()
  isPaid;

  @IsInt()
  @IsNotEmpty()
  offset;

  @IsString()
  @IsNotEmpty()
  @IsIn(['upload_date', 'arranged_photo', 'gallery_photo'])
  sortingType;
}


export class updateViewedPhotoDto{
  @IsArray()
  @IsNotEmpty()
  photoID;
}


export class manageGalleryPhotoDto{
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID("4",{ each: true })
  photoId;

}

export class ListPhotoLandingDto{
  @IsString()
  @IsNotEmpty()
  @IsIn(['by_recent_users','last_week', 'by_recent_photos', 'leader_board', 'this_week'])
  sortingType;

  @IsInt()
  @IsNotEmpty()
  offSet;
}


export class ListPhotosDto {

  @IsString()
  @IsNotEmpty()
  @IsIn(['all', 'by_user'])
  userType;

  @IsString()
  @IsNotEmpty()
  @IsIn(['by_recent_users','last_week', 'by_recent_photos', 'leader_board', 'this_week','following', 'new_to_you', 'participating_members', 
    'coming_next_photos'
  ])
  sortingType;

  @IsInt()
  @IsNotEmpty()
  offSet;
}

export class ParticipatingMemberPhotosDto{
  @IsInt()
  @IsNotEmpty()
  offSet;
}



export class ListPhotoNewMemberDto{
  @IsString()
  @IsNotEmpty()
  @IsIn(['all', 'by_user'])
  userType;

  @IsInt()
  @IsNotEmpty()
  @Min(0)
  @Max(20, { message: 'offset limit exceed'})
  offSet;
}

export class editPhotoDto{
  @IsString()
  @IsNotEmpty()
  photo_id;

  @IsString()
  @IsOptional()
  description;

  @IsString()
  @IsOptional()
  feedback_type;

  @IsOptional()
  genres_list;

  @IsOptional()
  day;

}


export class ListUpvotedPhotoDto{
  @IsString()
  @IsNotEmpty()
  @IsIn(['by_recent_users', 'by_recent_photos', 'leader_board'])
  sortingType;

  @IsInt()
  @IsNotEmpty()
  offSet;
}


export class WeeklyUpvotedPhotoDto{
  @IsString()
  @IsNotEmpty()
  @IsIn(['upvoted_photo', 'recent_user', 'by_week'])
  sortingType;

  
  @IsString()
  @ValidateIf((o => o.sortingType === 'by_week'))
  @IsNotEmpty()
  weekDate;

  @IsString()
  @IsNotEmpty()
  @IsIn(['all', 'by_user'])
  userType;

}


export class sendPhotoReminderDto{
  @IsString()
  @IsOptional()
  remiderDay;
}



export class PhotoByIdDto{
  @IsString()
  @IsNotEmpty()
  photo_id;


  @IsString()
  @IsNotEmpty()
  @IsIn(['all', 'by_user'])
  userType;

  
}

export class UserPhotosDto{
  @IsString()
  @IsOptional()
  user_id;

  @IsInt()
  @IsNotEmpty()
  offset;

  @IsString()
  @IsOptional()
  photo_id;

  @IsString()
  @IsOptional()
  profile;


  @IsOptional()
  @IsIn(['all', 'user'])
  userType;

  
  @IsOptional()
  batchId;
}


export class PhotoClickedDto{
  @IsString()
  @IsNotEmpty()
  photoID;

  @IsString()
  @IsNotEmpty()
  source;
}



export class sortQueuedPhotoDto {
  @ValidateNested({ each: true})
  @ArrayMinSize(1)
  @ArrayMaxSize(4)

  @Type(() => photoObjectDto)
  photos;
}

export class photoObjectDto {
  @IsUUID()
  @IsOptional()
  photoId;

  @IsString()
  @IsNotEmpty()
  weekDay;

  @IsString()
  @IsNotEmpty()
  daysLeft;
}

export class removeQueuedPhotoDto{
  @IsString()
  @IsNotEmpty()
  photoID;
}

export class heartedGalleryPhotoDto{
  @IsString()
  @IsNotEmpty()
  galleryPhotoId;

  @IsBoolean()
  @IsNotEmpty()
  isHearted;
}

export class listComingNextPhotoDto{
  @IsInt()
  @IsNotEmpty()
  offset;
}

export class updateComingNextPhotoDto{
  @IsString()
  @IsNotEmpty()
  photoId;

  @IsBoolean()
  @IsNotEmpty()
  isComingNext;
}

export class boostWeeklyPhotoDto{
  @IsString()
  @IsNotEmpty()
  photoId;

  @IsString()
  @IsNotEmpty()
  postedDate;

}