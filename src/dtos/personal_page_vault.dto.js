import { IsString, IsNotEmpty, IsOptional, IsInt, IsUUID } from 'class-validator';
import 'reflect-metadata';


export class uploadPhotosToS3Dto{
    @IsNotEmpty()
    @IsUUID()
    batchId;

    @IsOptional()
    folderId;
}

export class photoVaultLogsDto{
     @IsInt()
     @IsNotEmpty()
     offSet;
}


export class createFolderDto {
    @IsNotEmpty()
    @IsString()
    folderName;
}


export class updateFolderDto {
    @IsNotEmpty()
    @IsString()
    folderId;


    @IsNotEmpty()
    @IsString()
    folderName;

}

export class getFoldersListDto {
     @IsInt()
     @IsNotEmpty()
     offSet;
}

export class getPhotosListDto {
    @IsNotEmpty()
    @IsString()
    folderId;


    @IsInt()
    @IsNotEmpty()
    offSet;     
}


export class uploadPhotosToVaultDto {
    @IsNotEmpty()
    @IsString()
    folderId;

    
    @IsNotEmpty()
    @IsString()
    batchId;
}

