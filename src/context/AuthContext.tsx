import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth, googleProvider, isFirebaseConfigured } from "@/services/firebase";

export type StudentProfile = {
  uid: string;
  name: string;
  email: string;
  className: string;
  premium: boolean;
  provider: "firebase" | "demo";
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  user: StudentProfile | null;
  loading: boolean;
  authReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateStudent: (profile: Partial<StudentProfile>) => void;
};

const DEMO_STORAGE_KEY = "diamond-student-hub-demo-user";

const demoProfile = (email = "student@diamondhub.demo", name = "Aarav Patil"): StudentProfile => ({
  uid: "demo-student",
  name,
  email,
  className: "Class 9",
  premium: false,
  provider: "demo",
});

const toProfile = (firebaseUser: User): StudentProfile => ({
  uid: firebaseUser.uid,
  name: firebaseUser.displayName || "Diamond Student",
  email: firebaseUser.email || "student@diamondhub.app",
  className: "Class 9",
  premium: false,
  provider: "firebase",
});

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
      setUser(stored ? (JSON.parse(stored) as StudentProfile) : null);
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ? toProfile(firebaseUser) : null);
      setLoading(false);
    });
  }, []);

  const persistDemoUser = useCallback((profile: StudentProfile | null) => {
    if (!profile || profile.provider !== "demo") {
      window.localStorage.removeItem(DEMO_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(profile));
  }, []);

  const setProfile = useCallback(
    (profile: StudentProfile | null) => {
      setUser(profile);
      persistDemoUser(profile);
    },
    [persistDemoUser],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      if (auth) {
        await signInWithEmailAndPassword(auth, email, password);
        return;
      }

      setProfile(demoProfile(email, email.split("@")[0] || "Diamond Student"));
    },
    [setProfile],
  );

  const register = useCallback(
    async ({ name, email, password }: RegisterInput) => {
      if (auth) {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(credential.user, { displayName: name });
        setUser(toProfile(credential.user));
        return;
      }

      setProfile(demoProfile(email, name));
    },
    [setProfile],
  );

  const loginWithGoogle = useCallback(async () => {
    if (auth && googleProvider) {
      await signInWithPopup(auth, googleProvider as GoogleAuthProvider);
      return;
    }

    setProfile(demoProfile("google.student@diamondhub.demo", "Isha Deshmukh"));
  }, [setProfile]);

  const forgotPassword = useCallback(async (email: string) => {
    if (auth) {
      await sendPasswordResetEmail(auth, email);
    }
  }, []);

  const logout = useCallback(async () => {
    if (auth) {
      await signOut(auth);
    }

    setProfile(null);
  }, [setProfile]);

  const updateStudent = useCallback(
    (profile: Partial<StudentProfile>) => {
      setUser((current) => {
        if (!current) {
          return current;
        }

        const next = { ...current, ...profile };
        persistDemoUser(next);
        return next;
      });
    },
    [persistDemoUser],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      authReady: isFirebaseConfigured,
      login,
      register,
      loginWithGoogle,
      forgotPassword,
      logout,
      updateStudent,
    }),
    [forgotPassword, loading, login, loginWithGoogle, logout, register, updateStudent, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return value;
}
