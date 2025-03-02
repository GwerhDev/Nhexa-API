import { appList } from "../app-list.js";

const laruinarecordsIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/laruinarecords-logo.svg";
const elumbralstudiosIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/elumbralstudios-logo.svg";
const terminalcoreIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/terminalcorelabs-logo.svg";
const terminalkillersystemsIcon = "https://streamby.s3.sa-east-1.amazonaws.com/Nhexa/terminalkillersystems-logo.svg";

export const laruinaMenu = [
  {
    label: "Servicios",
    submenu: [
      {
        label: "Estudio de Grabación",
        description: "Grabación, mezcla y masterización de audio",
        icon: null,
        href: null,
        route: "/services/records"
      }, {
        label: "Back&Amp",
        description: "Backline y amplificación para eventos",
        icon: null,
        href: null,
        route: "/services/backamp"
      }, {
        label: "Sala de Ensayo",
        description: "Accede a nuestros planes con tu banda",
        icon: null,
        href: null,
        route: "/services/sala-de-ensayo"
      }
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