export type credentialsFields_v1 = {
  site?: string;
  additionalFields?: {
    username?: string;
    email?: string;
    password?: string;
    phone?: string;
    address?: string;
    [key: string]: string | undefined;
  };
};

export type personalInfoFields_v1 = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  dob?: string;
  additionalFields?: {
    [key: string]: string | undefined;
  };
};
