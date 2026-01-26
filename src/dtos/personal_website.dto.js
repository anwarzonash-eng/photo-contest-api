import { IsString, IsNotEmpty, IsOptional, IsIn, IsInt, ValidateIf, IsArray, ValidateNested, 
  ArrayNotEmpty, IsObject, IsEmail, IsBoolean, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import 'reflect-metadata';

export class selectTemplateDto {
    @IsNotEmpty()
    @IsIn(['template_selection', 'website_purpose'])
    type;


    @IsString()
    @IsIn(['PP Template 1', 'PP Template 2', 'PP Template 3', 'PP Template 4', 'PP Template 5'])
    @ValidateIf((o => o.type == 'template_selection'))
    @IsNotEmpty()
    template_name;


    @IsString()
    @ValidateIf((o => o.type == 'website_purpose'))
    @IsNotEmpty()
    website_purpose;


    @IsOptional()
    @IsIn(['uploaded_photos', 'selected_photos'])
    photoType;


    @IsOptional()
    eventId;

    
    @IsString()
    @ValidateIf((o => o.type == 'website_purpose'))
    @IsNotEmpty()
    domain;


    @IsString()
    @ValidateIf((o => o.type == 'website_purpose'))
    @IsNotEmpty()
    user_name;


    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => SelectedPhotoDto)
    selected_photos;


    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => SelectedPhotoDto)
    cover_photo;

}


export class listPhotosForPersonalWebsiteDto {
  @IsInt()
  @IsOptional()
  offSet;
}



export class SelectedPhotoDto {
  @IsString()
  @IsNotEmpty()
  id;


  @IsNotEmpty()
  @IsString()
  photo_url;


  @IsNotEmpty()
  @IsString()
  compressedImageUrl;


  @IsNotEmpty()
  @IsString()
  compressedImageId;


  @IsNotEmpty()
  @IsString()
  createdAt;


  @IsNotEmpty()
  @IsIn(['gallery', 'hunted'])
  source;
}


export class updatePersonalWebsiteDto {
    @IsOptional()
    @IsString()
    user_name;
  

    @IsOptional()
    @IsString()
    user_bio;

    
    @IsOptional()
    @IsString()
    facebook_link;


    @IsOptional()
    @IsString()
    instagram_link;

    
    @IsOptional()
    @IsString()
    twitter_link;


    @IsOptional()
    @IsString()
    linkedIn;

    
    @IsOptional()
    @IsString()
    tiktok;


    @IsOptional()
    photoUrl;
}


export class uploadPersonalWebsitePhotosDto {
  @IsNotEmpty()
  photoUrl;


  @IsNotEmpty()
  @IsString()
  eventId;
}

export class confirmUploadedPhotosDto{

  @IsNotEmpty()
  @IsArray()
  photoIds;
}


export class fetchPersonalPhotosDto{
  @IsInt()
  @IsNotEmpty()
  offSet;

  @IsNotEmpty()
  @IsString()
  domain;

  
  @IsNotEmpty()
  @IsString()
  userType;
}


export class fetchPersonalWebsiteDto{
  @IsOptional()
  @IsString()
  domain;

  @IsNotEmpty()
  @IsString()
  userType;
}


export class contactUsDto{
  @IsNotEmpty()
  @IsString()
  name;


  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email;


  @IsNotEmpty()
  @IsString()
  message;


  @IsNotEmpty()
  @IsString()
  domain;
}


export class updatePersonalSiteDto{
    @IsOptional()
    @IsString()
    user_name;
  

    @IsOptional()
    @IsString()
    user_bio;

    
    @IsOptional()
    @IsString()
    facebook_link;


    @IsOptional()
    @IsString()
    instagram_link;

    
    @IsOptional()
    @IsString()
    twitter_link;


    @IsOptional()
    @IsString()
    linkedIn;

    
    @IsOptional()
    @IsString()
    tiktok;


    @IsOptional()
    @IsString()
    headline;


    @IsOptional()
    @IsString()
    subHeadline;

    
    @IsOptional()
    @IsString()
    @IsIn(['PP Template 1', 'PP Template 2', 'PP Template 3', 'PP Template 4', 'PP Template 5'])
    template_name;


    @IsOptional()
    @IsBoolean()
    isHearted;


    @IsOptional()
    @IsBoolean()
    isTopTenPhoto;

    
    @IsOptional()
    @IsBoolean() 
    followMe;

        
    @IsOptional()
    @IsBoolean() 
    show_big_photo_hunt_profile;


    @IsOptional()
    @IsBoolean() 
    big_photo_hunt_branding;


    @IsOptional()
    @IsBoolean() 
    update_my_followers;


    @IsOptional()
    @IsString()
    website_url;

    
    @IsOptional()
    profile_pic;
    
}


export class deletePersonalPhotosDto{
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID("4",{ each: true })
    photoId;
}

export class managePersonalPhotosDto{
    @IsArray()
    @ArrayNotEmpty()
    @IsUUID("4",{ each: true })
    photoIds;
}


export class createPersonalGalleryDto{
  @IsString()
  @IsNotEmpty()
  galleryName;
}
