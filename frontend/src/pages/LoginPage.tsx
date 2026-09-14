import { AuthForm } from "../components/AuthForm";
import { useUser } from "../context/UserContext";

export function LoginPage() {
  const { login } = useUser();

  return (
    <div className="login-page">
      <div className="login-page__card">
        <h1>Homework</h1>
        <p>Войди или зарегистрируйся, чтобы продолжить</p>
        <AuthForm onSuccess={login} />
      </div>
    </div>
  );
}
