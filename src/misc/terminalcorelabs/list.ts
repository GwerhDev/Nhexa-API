import { appList } from '../app-list';
import type { MenuItem } from '../../types';

export const terminalcoreMenu: MenuItem[] = [
  {
    label: 'Productos',
    submenu: [
      {
        label: 'Streamby',
        description: 'Almacena y administra archivos multimedia para tus proyectos de software',
        icon: null,
        href: 'https://streamby.terminalcore.cl',
        route: null,
      },
    ],
  },
  {
    label: 'Aplicaciones',
    submenu: appList.user,
  },
  {
    label: 'Soporte técnico',
    href: '#',
  },
  {
    label: 'Contacto',
    route: '/contact',
  },
];
