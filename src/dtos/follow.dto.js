import { IsInt, ValidateIf, IsString, IsNotEmpty, IsBoolean, IsIn, IsOptional, Min, Max } from 'class-validator';
import 'reflect-metadata';

export  class FollowUserDto {
    @IsString()
    @IsNotEmpty()
    followerID;

    @IsBoolean()
    @IsNotEmpty()
    is_follow;
}

export class followerUpvotedPhotoDto{
   @IsString()
   @IsNotEmpty()
   user_id;
}

 export class getFollowUserDto{
    @IsString()  
    @IsNotEmpty()
    @IsIn(['follower', 'following', 'recommended'])
    key;

    @IsString() 
    @IsOptional()
    user_id;

    @IsInt()
    @IsNotEmpty()
    @ValidateIf((o => o.key == 'recommended'))
    @Min(0)
    @Max(96, { message: 'offset limit exceed'})
    offset;
 }