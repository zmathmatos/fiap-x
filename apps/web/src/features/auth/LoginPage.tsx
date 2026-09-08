import { useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { FrameExtractionDemo } from './FrameExtractionDemo';
import { DURATION, SPRING } from '../../lib/motion';
import { useAuth } from './useAuth';

type Mode = 'login' | 'register';

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

const MIN_PASSWORD = 8;

const STEPS = [
  { icon: 'upload_file', text: 'Envie um ou vários arquivos de uma vez' },
  { icon: 'content_cut', text: 'O worker corta o vídeo em frames, em paralelo' },
  { icon: 'folder_zip', text: 'Baixe o .zip com todos os frames extraídos' },
];

function validate(
  mode: Mode,
  values: { name: string; email: string; password: string },
): FieldErrors {
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
    <div className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between p-xl bg-surface-container-low border-r border-secondary-container relative overflow-hidden">
        {/* A faint grid, so the panel reads as a workspace rather than a blank field. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--secondary-container)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--secondary-container)) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse at 30% 40%, black, transparent 72%)',
          }}
        />

        {/*
          One slow bloom of the accent behind the demo. It is the only purely
          decorative motion in the app, and it belongs on the one screen that is not
          a work surface.
        */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-circle bg-primary-container/10 blur-3xl"
          animate={{ scale: [1, 1.15, 1], opacity: [0.45, 0.75, 0.45] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          className="relative"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow }}
        >
          <h1>
            <Logo className="h-8 w-auto text-primary-container" />
          </h1>
          <p className="mt-sm text-label-caps uppercase text-secondary">Processamento de vídeos</p>
        </motion.div>

        <div className="relative flex flex-col gap-xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, duration: DURATION.slow, ease: 'easeOut' }}
          >
            <FrameExtractionDemo />
          </motion.div>

          <div className="max-w-md">
            <motion.h2
              className="text-headline-lg text-on-surface"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: DURATION.slow, ease: 'easeOut' }}
            >
              Um vídeo entra.
              <br />
              <span className="text-primary-container">Milhares de frames</span> saem.
            </motion.h2>

            <ol className="mt-lg flex flex-col gap-sm">
              {STEPS.map((step, index) => (
                <motion.li
                  key={step.text}
                  className="flex items-center gap-sm text-body-sm text-secondary"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + index * 0.09, duration: DURATION.base }}
                >
                  <span className="shrink-0 w-8 h-8 rounded-full bg-surface-container-lowest border border-secondary-container grid place-items-center text-primary-container">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {step.icon}
                    </span>
                  </span>
                  {step.text}
                </motion.li>
              ))}
            </ol>
          </div>
        </div>

        <p className="text-body-sm text-secondary relative">Hackathon POSTECH SOAT · Fase 5</p>
      </aside>

      <main className="flex items-center justify-center p-lg bg-background">
        <motion.form
          className="w-full max-w-sm flex flex-col gap-md"
          onSubmit={submit}
          noValidate
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: DURATION.slow, ease: 'easeOut' }}
        >
          <div
            className="relative grid grid-cols-2 p-1 rounded-full bg-surface-container border border-secondary-container"
            role="tablist"
          >
            {(['login', 'register'] as Mode[]).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={mode === tab}
                onClick={() => switchMode(tab)}
                className={`relative h-9 rounded-full text-body-sm transition-colors ${
                  mode === tab
                    ? 'text-on-surface font-semibold'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                {mode === tab && (
                  <motion.span
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-full bg-surface-container-lowest shadow-sm"
                    transition={SPRING.snappy}
                  />
                )}
                <span className="relative">{tab === 'login' ? 'Entrar' : 'Criar conta'}</span>
              </button>
            ))}
          </div>

          {/*
            Animating the height stops the e-mail and password fields from jumping
            down the screen when the name field appears.
          */}
          <AnimatePresence initial={false}>
            {mode === 'register' && (
              <motion.div
                key="name"
                className="overflow-hidden"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: DURATION.base, ease: 'easeOut' }}
              >
                <Field
                  label="Nome"
                  autoComplete="name"
                  value={values.name}
                  onChange={change('name')}
                  error={errors.name}
                />
              </motion.div>
            )}
          </AnimatePresence>

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

          <AnimatePresence>
            {formError && (
              <motion.p
                className="px-md py-sm rounded-xl bg-error-container text-on-error-container text-body-sm overflow-hidden"
                role="alert"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {formError}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.div
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={SPRING.snappy}
          >
            <Button type="submit" variant="primary" block loading={submitting}>
              {mode === 'login' ? 'Entrar' : 'Criar conta'}
            </Button>
          </motion.div>
        </motion.form>
      </main>
    </div>
  );
}
