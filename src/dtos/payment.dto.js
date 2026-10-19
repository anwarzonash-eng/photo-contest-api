import { IsString, IsOptional, IsEmail, IsNotEmpty } from 'class-validator';
import 'reflect-metadata';

export class checkoutSessionDto {
    @IsString()
    @IsOptional()
    successUrl;

    @IsString()
    @IsOptional()
    cancelUrl;
}
