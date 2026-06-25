export interface JwtPayload {
  sub: string;      // user.id (UUID Prisma)
  username: string;
  role: string;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
}
