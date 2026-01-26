import { IsString, IsNotEmpty, IsIn, IsOptional, IsInt, IsUUID, ValidateIf, IsArray } from 'class-validator';
import 'reflect-metadata';


export class uploadPhotosToS3Dto{
    @IsNotEmpty()
    @IsUUID()
    batchId;

    @IsOptional()
    folderId;

    
    @IsNotEmpty()
    @IsString()
    photoCount;
}


export class deleteVaultPhotosDto{
    @IsNotEmpty()
    @IsArray()
    photosId;

}


export class photoVaultLogsDto{
     @IsInt()
     @IsNotEmpty()
     offSet;


     @IsInt()
     @IsOptional()
     limit;
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


export class getPhotosListDto {
    @IsNotEmpty()
    @IsString()
    folderId;


    @IsInt()
    @IsNotEmpty()
    offSet;   
    
    
    @IsInt()
    @IsOptional()
    limit;


    @IsNotEmpty()
    @IsIn(['date','name', 'size', 'fileType'])
    sortingType;


    @IsNotEmpty()
    @ValidateIf((o => o.sortingType === 'date'))
    @IsIn(['ASC', 'DESC'])
    sortOrder;
}



export class downloadBackBlazePhotosDto{
    @IsNotEmpty()
    @IsString()
    folderId;
}


export class uploadPhotosToVaultDto {
    @IsNotEmpty()
    @IsString()
    folderId;

    
    @IsNotEmpty()
    @IsString()
    batchId;

    @IsNotEmpty()
    @IsInt()
    photoCount;
}


export class listHuntedPhotosDto{
  @IsInt()
  @IsOptional()
  offSet;
}
