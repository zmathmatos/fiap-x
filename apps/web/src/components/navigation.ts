export interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Biblioteca', icon: 'video_library', end: true },
  { to: '/upload', label: 'Enviar vídeo', icon: 'upload_file' },
];
