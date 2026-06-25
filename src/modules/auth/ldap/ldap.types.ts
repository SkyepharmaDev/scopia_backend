export interface LdapAuthResult {
  isAuthenticated: boolean;
  userDN: string;
  ldapGuid: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  service: string;
  employeeNumber: string;
  droit: number | null;
}

export interface LdapConfig {
  server: string;
  port: number;
  bindDN: string;
  bindPassword: string;
  baseDN: string;
  useTLS: boolean;
}
