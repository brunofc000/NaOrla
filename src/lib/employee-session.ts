const KEY = "naorla.employee_session";

export type EmployeeSession = {
  token: string;
  kiosk_user_id: string;
  kiosk_name: string;
  kiosk_code: string;
  role: "garcom" | "cozinha";
  employee_name?: string | null;
};

export function getEmployeeSession(): EmployeeSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as EmployeeSession) : null;
  } catch {
    return null;
  }
}

export function setEmployeeSession(s: EmployeeSession) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("employee-session-changed"));
}

export function clearEmployeeSession() {
  localStorage.removeItem(KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("employee-session-changed"));
  }
}

import { useEffect, useState } from "react";

export function useEmployeeSession() {
  const [session, setSession] = useState<EmployeeSession | null>(() => getEmployeeSession());
  useEffect(() => {
    const onChange = () => setSession(getEmployeeSession());
    window.addEventListener("employee-session-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("employee-session-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return session;
}