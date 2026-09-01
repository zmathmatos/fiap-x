import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { useAuth } from './useAuth';

type Mode = 'login' | 'register';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

const MIN_PASSWORD = 8;

function validate(mode: Mode, values: { name: string; email: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};

  if (mode === 'register' && values.name.trim().length === 0) {
    errors.name = 'Informe seu nome.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Informe um e-mail válido.';
  }
  if (mode === 'register' && values.password.length < MIN_PASSWORD) {
    errors.password = `A senha precisa de ao menos ${MIN_PASSWORD} caracteres.`;
  }
  if (mode === 'login' && values.password.length === 0) {
    errors.password = 'Informe sua senha.';
  }

  return errors;
}

export function LoginPage(): JSX.Element {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const change = (field: keyof typeof values) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  const switchMode = (next: Mode): void => {
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();

    const found = validate(mode, values);
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login({ email: values.email.trim(), password: values.password });
      } else {
        await register({
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
        });
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível continuar.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth">
      <aside className="auth__aside">
        <div className="brand">
          <span className="brand__mark">FIAP X</span>
          <span className="brand__sub">Processamento de vídeos</span>
        </div>

        <div className="auth__pitch">
          <h2>Envie o vídeo. Receba os frames.</h2>
          <p>
            Seus vídeos entram numa fila e são processados em paralelo. Você acompanha o status em
            tempo real e baixa um .zip com todos os frames extraídos.
          </p>
          <ol className="auth__steps">
            <li>Envie um ou vários arquivos de uma vez</li>
            <li>Acompanhe o processamento sem recarregar a página</li>
            <li>Baixe o .zip assim que ficar pronto</li>
          </ol>
        </div>

        <p className="field__hint">Hackathon POSTECH SOAT · Fase 5</p>
      </aside>

      <main className="auth__panel">
        <form className="auth__form" onSubmit={submit} noValidate>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className="tabs__tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              className="tabs__tab"
              aria-selected={mode === 'register'}
              onClick={() => switchMode('register')}
            >
              Criar conta
            </button>
          </div>

          {mode === 'register' && (
            <Field
              label="Nome"
              autoComplete="name"
              value={values.name}
              onChange={change('name')}
              error={errors.name}
            />
          )}

          <Field
            label="E-mail"
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={change('email')}
            error={errors.email}
          />

          <Field
            label="Senha"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={values.password}
            onChange={change('password')}
            error={errors.password}
            hint={mode === 'register' ? `Mínimo de ${MIN_PASSWORD} caracteres.` : undefined}
          />

          {formError && (
            <p className="alert" role="alert">
              {formError}
            </p>
          )}

          <Button type="submit" variant="primary" block loading={submitting}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>
      </main>
    </div>
  );
}
