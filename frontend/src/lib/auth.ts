import { apiClient } from "./api-client";

interface LoginInput {
  email: string;
  password: string;
}

export async function login(input: LoginInput) {
  const { data } = await apiClient.post("/auth/login", input);
  if (data.accessToken) {
    localStorage.setItem("access_token", data.accessToken);
  }
  return data;
}

export async function getMe() {
  const { data } = await apiClient.get("/auth/me");
  return data.user;
}

export function logout() {
  localStorage.removeItem("access_token");
  window.location.href = "/login";
}

export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem("access_token"));
}
