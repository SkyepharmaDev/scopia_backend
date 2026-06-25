import { IsUUID } from 'class-validator';

export class CreateFavoriteDto {
  @IsUUID()
  queryId: string;
}
