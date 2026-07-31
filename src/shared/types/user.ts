export interface User {
  id: number | string;
  user_id?: string;
  username?: string;
  name: string | null;
  display_name?: string;
  email: string;
  code: string;
  roles?: Array<{
    role_id: string;
    role_code: string;
    role_name: string;
  }>;
  permissions?: string[];
}
