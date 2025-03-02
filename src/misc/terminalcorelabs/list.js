import { appList } from "../app-list.js";

const laruinarecordsIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/laruinarecords-logo.svg";
const elumbralstudiosIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/elumbralstudios-logo.svg";
const terminalcoreIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/terminalcorelabs-logo.svg";
const terminalkillersystemsIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/terminalkillersystems-logo.svg";

export const terminalcoreMenu = [
  {
    label: "Productos",
    submenu: [
      {
        label: "Streamby",
        description: "Almacena y administra archivos multimedia para tus proyectos de software",
        icon: null,
        href: "https://streamby.vercel.app",
        route: null,
      },
    ]
  }, {
    label: "Aplicaciones",
    submenu: appList
  }, {
    label: "Soporte técnico",
    href: "#",
  }, {
    label: "Contacto",
    route: "/contact",
  }
];