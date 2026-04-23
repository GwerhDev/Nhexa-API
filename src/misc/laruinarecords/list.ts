import { appList } from '../app-list';
import type { MenuItem } from '../../types';

export const laruinaMenu: MenuItem[] = [
  {
    label: 'Servicios',
    submenu: [
      {
        label: 'Estudio de Grabación',
        description: 'Grabación, mezcla y masterización de audio',
        icon: null,
        href: null,
        route: '/services/records',
      },
      {
        label: 'Back&Amp',
        description: 'Backline y amplificación para eventos',
        icon: null,
        href: null,
        route: '/services/backamp',
      },
      {
        label: 'Sala de Ensayo',
        description: 'Accede a nuestros planes con tu banda',
        icon: null,
        href: null,
        route: '/services/sala-de-ensayo',
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
