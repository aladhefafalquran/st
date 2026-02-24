export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
}

export interface AuthResponse {
  user: User;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  email: string;
  username: string;
  password: string;
}
