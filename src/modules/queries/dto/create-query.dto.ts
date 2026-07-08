import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum Visibility {
  PRIVATE = 'PRIVATE',
  SHARED = 'SHARED',
  PUBLIC = 'PUBLIC',
}

export class CreateQueryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  sqlContent: string;

  @IsUUID()
  sectorId: string;

  @IsUUID()
  @IsOptional()
  ownerGroupId?: string;

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;
}
