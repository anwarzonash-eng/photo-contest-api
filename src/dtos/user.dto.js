import {IsString, IsEmail, IsNotEmpty, Min, Max, IsBoolean, IsInt, IsUrl, IsOptional, ValidateIf, IsIn} from 'class-validator';
import 'reflect-metadata';


export class CreateUserDto {
    @IsString()
    @IsNotEmpty()
    name;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email;

    @IsOptional()
    facebookUserId;
    
    @IsString()
    password;

    @IsString()
    @IsNotEmpty()
    @IsIn(['email', 'facebook', 'google','apple'])
    userType;

    @IsString()
    @IsNotEmpty()
    photograperType;

    @IsInt()
    @Min(1)
    @Max(10)
    @ValidateIf((o => o.photograperType !== 'I just like to look' && o.photograperType !== "I'm only here supporting a friend"))
    @IsNotEmpty()
    photoDesireRatio;

   

    @IsString()
    @ValidateIf((o => o.photograperType !== 'I just like to look' && o.photograperType !== "I'm only here supporting a friend"))
    @IsNotEmpty()
    genresList;

    @IsString()
    @ValidateIf((o => o.photograperType !== 'I just like to look' && o.photograperType !== "I'm only here supporting a friend"))
    @IsNotEmpty()
    cameraBrand;
    
    @IsString()
    @ValidateIf((o => o.photograperType !== 'I just like to look' && o.photograperType !== "I'm only here supporting a friend"))
    @IsNotEmpty()
    photo_assistance;

    @IsBoolean()
    @IsOptional()
    isEmailVerified;

    @IsBoolean()
    @IsOptional()
    isProvidedDetailedInfo;

    @IsBoolean()
    @IsOptional()
    isRegistered;

    @IsString()
    @ValidateIf(e => e.facebookLink !== '')
    @IsUrl()
    facebookLink;

    @IsString()
    @ValidateIf(e => e.twitterLink !== '')
    @IsUrl()
    twitterLink;

    @IsString()
    @ValidateIf(e => e.instagramLink !== '')
    @IsUrl()
    instagramLink;

    @IsString()
    @ValidateIf(e => e.website !== '')
    @IsUrl()
    @IsOptional()
    website;

    @IsString()
    @IsOptional()
    state;

    @IsString()
    @IsOptional()
    country;


    @IsString()
    @IsOptional()
    heard_us;

  }

  export class updateSubscriptionReasonDto{
    @IsString()
    @IsNotEmpty()
    subscription_reason;
  }

  export class updateLastVisitTimeDto{
    @IsString()
    @IsNotEmpty()
    lastVisitTime;
  }

  export  class LogInUserDto {
    @IsString()
    @IsNotEmpty()
    emailOrUsername;
  
    @IsString()
    @IsNotEmpty()
    password;

  }

  export class ContactUsDto
  {
    @IsString()
    @IsNotEmpty()
    name;

    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email;

    @IsString()
    @IsNotEmpty()
    message;
  }

  
  export class editProfileDto
  {

    @IsString()
    @IsOptional()
    photographerType;

    @IsString()
    @IsOptional()
    photo_assistance;


    @IsString()
    @IsOptional()
    genresList;

    
    @IsString()
    @IsOptional()
    aboutMe;

    @IsString()
    @IsOptional()
    strengths;

    @IsString()
    @IsOptional()
    meetFor;



    @IsString()
    @IsOptional()
    aboutMe;

    @IsString()
    @IsOptional()
    strengths;

    @IsString()
    @IsOptional()
    meetFor;

    @IsString()
    @IsOptional()
    cameraBrand;

    @IsString()
    @IsOptional()
    facebookLink;

    @IsString()
    @IsOptional()
    twitterLink;

    @IsString()
    @IsOptional()
    instagramLink;

    @IsString()
    @IsOptional()
    website;

    @IsString()
    @IsOptional()
    state;

    @IsString()
    @IsOptional()
    country;

    
    @IsOptional()
    photoUrl;

    @IsString()
    @IsNotEmpty()
    @IsIn(['edit_profile','upload_photo'])
    page;
  }
  
  export class UserEmailDto{
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email;
  }

  export class uploadCoverPhotoDto{
    @IsNotEmpty()
    photoUrl;
  }



  export class GetSingleUserByEmailDto {
    @IsString()
    @IsNotEmpty()
    //@IsEmail()
    email;

  }


  export class changePasswordDto{
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email;
    
    @IsString()
    @IsNotEmpty()
    password;  
  }

  export class forgetPasswordDto{
    @IsString()
    @IsNotEmpty()
    @IsEmail()
    email;
  }

  export class resetPasswordDto{
    @IsString()
    @IsNotEmpty()
    password;  
  }

export class UserByIdDto{
  @IsOptional()
  @IsNotEmpty()
  userID;

  @IsOptional()
  @IsNotEmpty()
  profile;
}



export class WelcomeUserDto{
  @IsString()
  @IsNotEmpty()
  userID;

  @IsBoolean()
  @IsNotEmpty()
  is_welcome;
}

export class acceptedInviterInvitationDto{
  @IsInt()
  @IsNotEmpty()
  offset;
}