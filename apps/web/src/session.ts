export type Session = {
  authenticated: boolean;
  csrf_token?: string;
  merchant_id?: string;
  key_id?: string;
  scopes?: string[];
  auth_method?: 'privy' | 'email' | 'api_key' | 'sandbox';
  account_saved?: boolean;
  role?: 'owner' | 'viewer' | 'editor' | null;
};
