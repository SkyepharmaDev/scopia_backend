import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AssignMemberDto {
  @IsUUID()
  userId: string;

  @IsBoolean()
  @IsOptional()
  canEdit?: boolean;
}

export class UpdateMemberDto {
  @IsBoolean()
  canEdit: boolean;
}

export class AssignQueryDto {
  @IsUUID()
  queryId: string;
}
