import { IsUUID } from 'class-validator';

export class AssignMemberDto {
  @IsUUID()
  userId: string;
}

export class AssignQueryDto {
  @IsUUID()
  queryId: string;
}
