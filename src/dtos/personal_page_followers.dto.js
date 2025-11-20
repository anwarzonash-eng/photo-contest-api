import {IsString, IsNotEmpty, IsArray, IsOptional, IsBoolean, ValidateIf } from 'class-validator';
import 'reflect-metadata';


export  class PersonalPageFollowUserDto {
    @IsString()
    @IsNotEmpty()
    siteOwnerId;



    @IsString()
    @ValidateIf((o => o.isFollow === true))
    @IsNotEmpty()
    email;


    @IsOptional()
   // @IsArray()
    followersId;


    @IsNotEmpty()
    @IsBoolean()
    isFollow;
    
}

export class getSuggestedFollowersDto{
    @IsString()
    @IsNotEmpty()
    siteOwnerId;

    
    @IsString()
    @IsNotEmpty()
    email;

}
