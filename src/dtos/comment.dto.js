import {IsString, IsNotEmpty, IsInt,  IsOptional } from 'class-validator';
import 'reflect-metadata';


export class AddCommentDto {
  @IsString()
  @IsNotEmpty()
  photoID;

  @IsString()
  @IsNotEmpty()
  commentText;

  @IsOptional()
  topcommentID;

  @IsOptional()
  subcommentID;
}


export class listCommentDto {
  @IsString()
  @IsNotEmpty()
  photoID;

  @IsInt()
  @IsNotEmpty()
  offSet;
}


export class listReplyDto{
  @IsString()
  @IsNotEmpty()
  photoID;

  @IsString()
  @IsNotEmpty()
  topcommentID;

  @IsOptional()
  subcommentID;
}

