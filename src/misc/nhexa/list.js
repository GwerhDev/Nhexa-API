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
        label: "La Ruina Records",
        description: "Estudio de Sonido",
        icon: laruinarecordsIcon,
        href: "https://laruina.cl"
      }, {
        label: "El Umbral Studios",
        description: "Estudio de diseño y animación 3D",
        icon: elumbralstudiosIcon,
        href: "#"
      }, {
        label: "TerminalCore Labs",
        description: "Desarrollo de Software",
        icon: terminalcoreIcon,
        href: "https://terminalcore.cl"
      }, {
        label: "TerminalKiller Systems",
        description: "Ciberseguridad",
        icon: terminalkillersystemsIcon,
        href: "https://terminalkiller.cl"
      }
    ]
  }, {
    label: "Aplicaciones",
    submenu: appList.user
  }, {
    label: "Soporte técnico",
    href: "#",
  }, {
    label: "Contacto",
    route: "/contact",
  }
];