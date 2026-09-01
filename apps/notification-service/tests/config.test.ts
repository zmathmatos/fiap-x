import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('falls back to development defaults when nothing is set', () => {
    const config = loadConfig({});

    expect(config.nodeEnv).toBe('development');
    expect(config.healthPort).toBe(9101);
    expect(config.smtp.host).toBe('localhost');
    expect(config.smtp.port).toBe(1025);
    expect(config.smtp.secure).toBe(false);
    expect(config.appUrl).toBe('http://localhost:8080');
  });

  it('reads the values that are provided', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
      NOTIFICATION_HEALTH_PORT: '9999',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'true',
      SMTP_FROM: 'FIAP X <no-reply@example.com>',
      APP_PUBLIC_URL: 'https://fiapx.example.com',
      RABBITMQ_EXCHANGE: 'outro-exchange',
    });

    expect(config.nodeEnv).toBe('production');
    expect(config.logLevel).toBe('warn');
    expect(config.healthPort).toBe(9999);
    expect(config.smtp.host).toBe('smtp.example.com');
    expect(config.smtp.port).toBe(587);
    expect(config.smtp.secure).toBe(true);
    expect(config.appUrl).toBe('https://fiapx.example.com');
    expect(config.rabbitmqExchange).toBe('outro-exchange');
  });

  it('treats a blank value as absent', () => {
    const config = loadConfig({ SMTP_HOST: '   ', NOTIFICATION_HEALTH_PORT: '' });

    expect(config.smtp.host).toBe('localhost');
    expect(config.healthPort).toBe(9101);
  });

  it('leaves the smtp credentials undefined when they are blank, so nodemailer connects anonymously', () => {
    const config = loadConfig({ SMTP_USER: '  ', SMTP_PASSWORD: '' });

    expect(config.smtp.user).toBeUndefined();
    expect(config.smtp.password).toBeUndefined();
  });

  it('keeps the smtp credentials when they are provided', () => {
    const config = loadConfig({ SMTP_USER: 'apikey', SMTP_PASSWORD: 's3cr3t' });

    expect(config.smtp.user).toBe('apikey');
    expect(config.smtp.password).toBe('s3cr3t');
  });

  it('rejects a port that is not a positive integer', () => {
    expect(() => loadConfig({ SMTP_PORT: 'abc' })).toThrow(/positive integer/);
    expect(() => loadConfig({ SMTP_PORT: '0' })).toThrow(/positive integer/);
    expect(() => loadConfig({ SMTP_PORT: '-1' })).toThrow(/positive integer/);
    expect(() => loadConfig({ NOTIFICATION_HEALTH_PORT: '1.5' })).toThrow(/positive integer/);
  });
});
