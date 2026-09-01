import { renderFailureEmail } from '../../src/application/templates/failure';
import { renderSuccessEmail } from '../../src/application/templates/success';

const base = {
  originalName: 'ferias.mp4',
  appUrl: 'http://localhost:8080',
  videoId: 'v1',
};

describe('renderFailureEmail', () => {
  it('names the video in the subject', () => {
    const mail = renderFailureEmail({ ...base, reason: 'ffmpeg exited with code 1' });

    expect(mail.subject).toBe('Falha ao processar "ferias.mp4"');
  });

  it('states the reason in both the text and the html body', () => {
    const mail = renderFailureEmail({ ...base, reason: 'arquivo corrompido' });

    expect(mail.text).toContain('arquivo corrompido');
    expect(mail.html).toContain('arquivo corrompido');
  });

  it('escapes html in the failure reason', () => {
    const mail = renderFailureEmail({ ...base, reason: '<script>alert(1)</script>' });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('escapes html in the file name', () => {
    const mail = renderFailureEmail({
      ...base,
      originalName: '<img src=x onerror=alert(1)>.mp4',
      reason: 'x',
    });

    expect(mail.html).not.toContain('<img');
  });

  it('links back to the video page', () => {
    const mail = renderFailureEmail({ ...base, reason: 'x' });

    expect(mail.html).toContain('http://localhost:8080/videos/v1');
  });
});

describe('renderSuccessEmail', () => {
  it('reports the frame count', () => {
    const mail = renderSuccessEmail({ ...base, frameCount: 42 });

    expect(mail.subject).toBe('"ferias.mp4" está pronto');
    expect(mail.text).toContain('42');
    expect(mail.html).toContain('42');
  });

  it('uses the singular form for a single frame', () => {
    const mail = renderSuccessEmail({ ...base, frameCount: 1 });

    expect(mail.text).toContain('1 frame ');
    expect(mail.text).not.toContain('1 frames');
  });
});
