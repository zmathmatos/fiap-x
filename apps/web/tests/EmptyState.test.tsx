import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../src/components/EmptyState';

describe('EmptyState', () => {
  it('shows the title and the body', () => {
    render(<EmptyState title="Nenhum vídeo ainda" body="Envie o primeiro arquivo." />);

    expect(screen.getByText('Nenhum vídeo ainda')).toBeInTheDocument();
    expect(screen.getByText('Envie o primeiro arquivo.')).toBeInTheDocument();
  });

  it('renders the action when one is given', () => {
    render(
      <EmptyState title="Nada aqui" body="Comece agora." action={<button>Enviar vídeo</button>} />,
    );

    expect(screen.getByRole('button', { name: 'Enviar vídeo' })).toBeInTheDocument();
  });

  it('renders nothing in place of the action when there is none', () => {
    render(<EmptyState title="Nada aqui" body="Comece agora." />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
