import { IsString, IsNotEmpty, IsOptional, IsDate, IsUrl, IsInt } from 'class-validator';
import 'reflect-metadata';


export class AddTownHallDto{
  @IsNotEmpty()
  photoUrl;


  @IsNotEmpty()
  @IsString()
  date;

  @IsNotEmpty()
  @IsString()
  guestName;

  
  @IsNotEmpty()
  @IsString()
  description;

    
  @IsNotEmpty()
  @IsUrl()
  videoLink;


  @IsNotEmpty()
  @IsString()
  townhallBtnLabel;
  
}


export class AddMonthlyTownHallDto{
  @IsNotEmpty()
  photoUrl;


  @IsNotEmpty()
  @IsString()
  heading;


  @IsNotEmpty()
  @IsString()
  subHeading;


  @IsNotEmpty()
  @IsString()
  body;


  

  @IsNotEmpty()
  @IsString()
  townhallBtn1Label;


  @IsNotEmpty()
  @IsUrl()
  townhallBtn1Url;

  
  @IsNotEmpty()
  @IsString()
  townhallBtn2Label;

  
  
  @IsNotEmpty()
  @IsUrl()
  townhallBtn2Url;
}



export class UpdateMonthlyTownHallDto{
  
  @IsNotEmpty()
  @IsString()
  townhallId;


  @IsOptional()
  photoUrl;


  @IsNotEmpty()
  @IsString()
  heading;


  @IsNotEmpty()
  @IsString()
  subHeading;


  @IsNotEmpty()
  @IsString()
  body;


  @IsNotEmpty()
  @IsString()
  townhallBtn1Label;


  @IsNotEmpty()
  @IsUrl()
  townhallBtn1Url;

  
  @IsNotEmpty()
  @IsString()
  townhallBtn2Label;

  
  
  @IsNotEmpty()
  @IsUrl()
  townhallBtn2Url;
}


export class UpdateTownHallDto{

  @IsNotEmpty()
  @IsString()
  townhallId;


  @IsOptional()
  photoUrl;


  @IsOptional()
  @IsString()
  date;

  
  @IsOptional()
  @IsString()
  guestName;

  
  @IsOptional()
  @IsString()
  description;

    
  @IsOptional()
  @IsUrl()
  videoLink;


  @IsOptional()
  @IsString()
  townhallBtnLabel;
  
}


export class getTownhallByIdDto{
  
  @IsNotEmpty()
  @IsString()
  townhallId;
}



export class removeTownhallDto{
    
  @IsNotEmpty()
  @IsString()
  townhallId;
}