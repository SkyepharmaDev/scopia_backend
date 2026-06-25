import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'ldapts';
import { LdapAuthResult, LdapConfig } from './ldap.types';

@Injectable()
export class LdapService {
  private readonly logger = new Logger(LdapService.name);
  private readonly config: LdapConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      server: this.configService.getOrThrow<string>('LDAP_SERVER'),
      port: parseInt(this.configService.get<string>('LDAP_PORT', '389'), 10),
      bindDN: this.configService.getOrThrow<string>('LDAP_BIND_DN'),
      bindPassword: this.configService.getOrThrow<string>('LDAP_BIND_PASSWORD'),
      baseDN: this.configService.getOrThrow<string>('LDAP_BASE_DN'),
      useTLS:
        this.configService.get<string>('LDAP_USE_TLS', 'false') === 'true',
    };
  }

  /**
   * Authentifie un utilisateur via LDAP
   * @throws Error si l'authentification échoue
   */
  async authenticate(
    username: string,
    password: string,
  ): Promise<LdapAuthResult> {
    if (!password || password.trim() === '') {
      throw new Error('Le mot de passe ne peut pas être vide.');
    }

    const protocol = this.config.useTLS ? 'ldaps' : 'ldap';
    const url = `${protocol}://${this.config.server}:${this.config.port}`;

    const client = new Client({
      url,
      timeout: 10000,
      connectTimeout: 10000,
      tlsOptions: this.config.useTLS
        ? { rejectUnauthorized: false }
        : undefined,
    });

    try {
      // 1. Bind avec le compte de service
      this.logger.debug(`Connexion LDAP à ${url}`);
      await client.bind(this.config.bindDN, this.config.bindPassword);
      this.logger.debug('Bind compte de service réussi');

      // 2. Recherche de l'utilisateur par sAMAccountName
      const filter = `(sAMAccountName=${this.escapeFilter(username)})`;
      const { searchEntries } = await client.search(this.config.baseDN, {
        scope: 'sub',
        filter,
        attributes: [
          'dn',
          'sn',
          'givenName',
          'department',
          'employeeNumber',
          'memberOf',
          'sAMAccountName',
          'mail',
          'objectGUID',
        ],
      });

      if (searchEntries.length === 0) {
        throw new Error(
          `L'utilisateur '${username}' n'a pas été trouvé dans LDAP.`,
        );
      }

      const userEntry = searchEntries[0];
      const userDN = userEntry.dn;

      this.logger.debug(`Utilisateur trouvé: ${userDN}`);

      // 3. Unbind du compte de service, puis bind avec l'utilisateur
      await client.unbind();

      const userClient = new Client({
        url,
        timeout: 10000,
        connectTimeout: 10000,
        tlsOptions: this.config.useTLS
          ? { rejectUnauthorized: false }
          : undefined,
      });

      try {
        await userClient.bind(userDN, password);
        this.logger.debug('Authentification utilisateur réussie');
      } catch {
        throw new Error("Échec de l'authentification (mot de passe invalide).");
      } finally {
        await userClient.unbind();
      }

      // 4. Extraction des attributs
      const firstName = this.extractAttribute(userEntry, 'givenName');
      const lastName = this.extractAttribute(userEntry, 'sn');
      const email = this.extractAttribute(userEntry, 'mail');
      const service = this.extractAttribute(userEntry, 'department');
      const employeeNumber = this.extractAttribute(userEntry, 'employeeNumber');
      const ldapGuid = this.extractGuid(userEntry);

      // 5. Détermination des droits via memberOf
      const droit = this.extractDroit(userEntry);

      return {
        isAuthenticated: true,
        userDN,
        ldapGuid,
        username,
        email,
        firstName,
        lastName,
        service,
        employeeNumber,
        droit,
      };
    } catch (error) {
      this.logger.error(
        `Erreur LDAP: ${error instanceof Error ? error.message : error}`,
      );
      throw error;
    } finally {
      try {
        await client.unbind();
      } catch {
        // Ignorer les erreurs de unbind (connexion peut déjà être fermée)
      }
    }
  }

  /**
   * Extrait l'objectGUID (binaire 16 octets) en chaîne hex stable
   */
  private extractGuid(entry: Record<string, unknown>): string {
    const value = entry['objectGUID'];
    if (Buffer.isBuffer(value)) return value.toString('hex');
    if (Array.isArray(value) && value.length > 0) {
      const first: unknown = value[0];
      if (Buffer.isBuffer(first)) return first.toString('hex');
      if (typeof first === 'string') return first;
    }
    return typeof value === 'string' ? value : '';
  }

  /**
   * Extrait un attribut d'une entrée LDAP
   */
  private extractAttribute(
    entry: Record<string, unknown>,
    attribute: string,
  ): string {
    const value = entry[attribute];
    if (Array.isArray(value) && value.length > 0) {
      const first: unknown = value[0];
      return typeof first === 'string' ? first : '';
    }
    return typeof value === 'string' ? value : '';
  }

  /**
   * Détermine les droits de l'utilisateur en fonction de ses groupes AD
   * Personnalise cette méthode selon tes groupes AD
   */
  private extractDroit(entry: Record<string, unknown>): number | null {
    const memberOf = entry['memberOf'];
    if (!memberOf) return null;

    const rawGroups = Array.isArray(memberOf) ? memberOf : [memberOf];
    const groups: string[] = rawGroups.filter(
      (g): g is string => typeof g === 'string',
    );

    for (const groupStr of groups) {
      if (groupStr.includes('CN=AQ_DHT')) {
        return 1; // AQ
      }
      if (groupStr.includes('CN=AM_DHT')) {
        return 2; // AM
      }
      if (groupStr.includes('CN=Operateur_DHT')) {
        return 3; // Opérateur
      }
    }

    return null;
  }

  /**
   * Échappe les caractères spéciaux dans les filtres LDAP
   * Prévient les injections LDAP
   */
  private escapeFilter(input: string): string {
    const nullChar = String.fromCharCode(0);
    return input
      .replace(/\\/g, '\\5c')
      .replace(/\*/g, '\\2a')
      .replace(/\(/g, '\\28')
      .replace(/\)/g, '\\29')
      .replace(new RegExp(nullChar, 'g'), '\\00');
  }
}
