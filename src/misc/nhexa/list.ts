import { appList } from '../app-list';
import type { MenuItem } from '../../types';

export const nhexaMenu: MenuItem[] = [
  {
    label: 'Proyectos',
    submenu: [
      {
        label: 'World Of Gwerh',
        description: 'Acércate a escuchar las historias que el bardo tiene para contarte',
        icon: null,
        href: 'https://worldofgwerh.nhexa.cl',
      },
    ],
  },
  {
    label: 'Departamentos',
    submenu: [
      {
        label: 'Animación',
        description: 'Audiovisual & Diseño',
        icon: null,
        route: '/animation',
      },
      {
        label: 'Tecnología',
        description: 'Software & Ciberseguridad',
        icon: null,
        route: '/technology',
      },
    ],
  },
  {
    label: 'Aplicaciones',
    submenu: appList.user,
  },
];
