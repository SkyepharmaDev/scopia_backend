import { IsNotEmpty, IsString } from 'class-validator';

export class RunQueryDto {
  @IsString()
  @IsNotEmpty()
  sqlContent: string;
}
