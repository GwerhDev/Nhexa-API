import type { AppEntry } from '../types';

export interface AppList {
  user: AppEntry[];
  admin: AppEntry[];
}

export const appList: AppList = {
  user: [
    {
      url: 'https://spectra.nhexa.cl',
      label: 'Spectra',
      route: '#',
      description: 'Streaming',
      icon: null,
    },
    {
      url: 'https://spellcast.nhexa.cl',
      label: 'Spellcast',
      route: '#',
      description: 'Audio y música',
      icon: null,
    },
/*     {
      url: 'https://havenstore.nhexa.cl',
      label: 'Havenstore',
      description: 'Tienda',
      route: '#',
      icon: null,
    }, */
  ],
  admin: [
    {
      url: 'https://streamby.nhexa.cl',
      label: 'Projects',
      route: '#',
      description: 'Gestor de contenido',
      // Its entry in the catalog of StreamBy's nhexa-environment export: named by its content's
      // sha256, so it never expires (StreamBy redirects it to a signed URL; the bucket is private).
      // A new icon is a new URL: take it from the export's catalog.json.
      icon: 'https://api.nhexa.cl/streamby/be4dce92-de7c-4820-8f93-b3ea3335575d/content/8bdcc75ff894fdd3d2ef66b2ad691368b1adeeb1d970f366a35aa99a469b5056.svg',
    },
  ],
};
