import { appList } from "../app-list.js";

const laruinarecordsIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/laruinarecords-logo.svg";
const elumbralstudiosIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/elumbralstudios-logo.svg";
const terminalcoreIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/terminalcorelabs-logo.svg";
const terminalkillersystemsIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/terminalkillersystems-logo.svg";

export const nhexaMenu = [
  {
    label: "Proyectos",
    submenu: [
      {
        label: "World Of Gwerh",
        description: "Acércate a escuchar las historias que el bardo tiene para contarte",
        icon: null,
        href: "https://worldofgwerh.nhexa.cl"
      }
    ]
  },
  {
    label: "Departamentos",
    submenu: [
      {
        label: "Animación",
        description: "Audiovisual & Diseño",
        icon: null,
        route: "/animation"
      }, {
        label: "Tecnología",
        description: "Software & Ciberseguridad",
        icon: null,
        route: "/technology"
      }
    ]
  }, {
    label: "Aplicaciones",
    submenu: appList.user
  },
];