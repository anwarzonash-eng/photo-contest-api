import { IsString, IsOptional } from 'class-validator';
import 'reflect-metadata';

export class checkoutSessionDto {
    @IsString()
    @IsOptional()
    successUrl;

    @IsString()
    @IsOptional()
    cancelUrl;
}
