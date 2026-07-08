import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { LdapService } from './ldap/ldap.service';
import { JwtPayload } from './types/jwt-payload.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly ldapService: LdapService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Flux principal d'authentification
   * LDAP authentifie → PostgreSQL gère l'identité applicative
   */
  async login(username: string, password: string) {
    // 1. Authentification LDAP
    const ldapResult = await this.authenticateViaLdap(username, password);

    // 2. Provisioning automatique (find or create)
    const user = await this.findOrCreateUser(ldapResult);

    // 3. Vérification compte actif
    if (!user.isActive) {
      throw new UnauthorizedException('Ce compte a été désactivé.');
    }

    // 4. Génération du JWT
    const token = this.generateToken(user);

    this.logger.log(`Connexion réussie: ${user.username}`);

    return {
      accessToken: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        canAuthor: await this.computeCanAuthor(user.id, user.role),
      },
    };
  }

  /**
   * Peut créer/tester des requêtes SQL : ADMIN, ou membre-éditeur (canEdit)
   * d'au moins un groupe. Le statut « éditeur » découle de l'appartenance.
   */
  private async computeCanAuthor(
    userId: string,
    role: string,
  ): Promise<boolean> {
    if (role === 'ADMIN') {
      return true;
    }
    const count = await this.prisma.userGroup.count({
      where: { userId, canEdit: true },
    });
    return count > 0;
  }

  /**
   * Authentification LDAP avec gestion d'erreur uniforme
   */
  private async authenticateViaLdap(username: string, password: string) {
    try {
      return await this.ldapService.authenticate(username, password);
    } catch (error) {
      this.logger.warn(
        `Échec auth LDAP pour '${username}': ${error instanceof Error ? error.message : error}`,
      );
      throw new UnauthorizedException('Identifiants invalides.');
    }
  }

  /**
   * Cherche l'utilisateur par GUID LDAP
   * - Existe → met à jour les infos AD (nom, email peuvent changer)
   * - N'existe pas → crée le compte automatiquement
   */
  private async findOrCreateUser(ldapResult: {
    ldapGuid: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
  }) {
    const { ldapGuid, username, email, firstName, lastName } = ldapResult;

    const existingUser = await this.prisma.user.findUnique({
      where: { ldapGuid },
    });

    if (existingUser) {
      // Mise à jour des infos AD si elles ont changé
      return this.prisma.user.update({
        where: { id: existingUser.id },
        data: { username, email, firstName, lastName },
      });
    }

    // Première connexion → auto-provisioning
    this.logger.log(
      `Création du compte pour '${username}' (première connexion)`,
    );

    return this.prisma.user.create({
      data: {
        ldapGuid,
        username,
        email,
        firstName,
        lastName,
        // role: USER par défaut (défini dans le schema Prisma)
      },
    });
  }

  /**
   * Génère un JWT avec les infos essentielles
   * Payload volontairement léger — les détails sont en base
   */
  private generateToken(user: {
    id: string;
    username: string;
    role: string;
  }): string {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        groups: {
          include: { group: { select: { id: true, name: true } } },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }

    return {
      ...user,
      canAuthor: await this.computeCanAuthor(user.id, user.role),
    };
  }
}
