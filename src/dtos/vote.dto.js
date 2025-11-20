import {IsString, IsNotEmpty,IsIn, IsOptional} from 'class-validator';
import 'reflect-metadata';


export  class PerformVoteDto {
    @IsString()
    @IsNotEmpty()
    photoID;
    
    @IsString()
    @IsNotEmpty()
    @IsIn(['add', 'remove'])
    actionType;

    
    @IsOptional()
    batchId;
}



export class VoteCommentDto{
  @IsString()
  @IsNotEmpty()
  commentID;

  @IsString()
  @IsNotEmpty()
  @IsIn(['add', 'remove'])
  actionType;
}