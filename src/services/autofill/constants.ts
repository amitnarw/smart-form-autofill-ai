export const REGISTRATION_KEYWORDS = [
  'register', 'registration', 'signup', 'sign up', 'sign-up', 'create account', 
  'new account', 'join', 'get started', 'become a member', 'enroll', 'enrollment'
];

export const LOGIN_KEYWORDS = [
  'login', 'log in', 'sign in', 'signin', 'sign-in', 'logon', 'log on'
];

export const ROLE_KEYWORDS = {
  username: ['username', 'user', 'usr', 'login', 'signin', 'account'],
  name: ['name', 'firstname', 'lastname', 'fullname', 'fname', 'lname', 'first name', 'last name'],
  email: ['email', 'e-mail', 'mail', 'email address'],
  password: ['password', 'pwd', 'pass'],
  phone: ['phone', 'mobile', 'tel', 'contact', 'number'],
  address: ['address', 'location', 'street', 'city', 'zip', 'postal'],
  company: ['company', 'organization', 'org', 'business']
};

export const INPUT_SELECTORS = [
  'input:not([type])',
  'input[type="text" i]',
  'input[type="email" i]',
  'input[type="password" i]',
  'input[type="tel" i]',
  'input[type="number" i]',
  'textarea',
].join(',');
