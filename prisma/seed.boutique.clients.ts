import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CLIENTS: {
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  notes: string | null;
}[] = [
  {
    "firstName": "Roberta",
    "lastName": "",
    "phone": "+393482924461",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Maria",
    "lastName": "",
    "phone": "+393401617152",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Gheorghe",
    "lastName": "Ilie",
    "phone": "+393733451617",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Gabriele",
    "lastName": "",
    "phone": "+393317705563",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Alice",
    "lastName": "",
    "phone": "+393516625083",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Magali",
    "lastName": "",
    "phone": "+393465601661",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Anna",
    "lastName": "",
    "phone": "+393533698430",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Aurora",
    "lastName": "",
    "phone": "+33762678510",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Daniela",
    "lastName": "",
    "phone": "+39335416020",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Tiziana",
    "lastName": "",
    "phone": "+31629085788",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Silvio",
    "lastName": "",
    "phone": "+393920997674",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Yasmine",
    "lastName": "",
    "phone": "+393518108135",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Alice",
    "lastName": "",
    "phone": "+393312223082",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Ambra",
    "lastName": "",
    "phone": "+393351744238",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Sonia",
    "lastName": "",
    "phone": "+393397823834",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Lucia",
    "lastName": "",
    "phone": "+393887849315",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Giovanna",
    "lastName": "",
    "phone": "+393385612459",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Lori",
    "lastName": "",
    "phone": "+393458539045",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Nadia",
    "lastName": "",
    "phone": "+393428183564",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Valentina",
    "lastName": "",
    "phone": "+393913392375",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Ilaria mattiuzzo",
    "lastName": "",
    "phone": "+393923179166",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Jessica",
    "lastName": "",
    "phone": "+393333374158",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Monica",
    "lastName": "",
    "phone": "+393383671954",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Laddy",
    "lastName": "",
    "phone": "+393715828899",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Marilena",
    "lastName": "",
    "phone": "+393808916507",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Stefania",
    "lastName": "",
    "phone": "+393312748575",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Ilaria",
    "lastName": "",
    "phone": "+393398487672",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Basmala",
    "lastName": "",
    "phone": "+393924092041",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Giorgia",
    "lastName": "",
    "phone": "+393291169013",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Giovanna",
    "lastName": "",
    "phone": "+393284595494",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Francesca",
    "lastName": "",
    "phone": "+393770440456",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Alessandro",
    "lastName": "",
    "phone": "+393293733226",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Annalisa",
    "lastName": "",
    "phone": "+393421205276",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Irene",
    "lastName": "",
    "phone": "+393338137501",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Gaia",
    "lastName": "",
    "phone": "+393914592219",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Amelia",
    "lastName": "",
    "phone": "+393398812968",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Chiara",
    "lastName": "",
    "phone": "+393485657678",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Antonia",
    "lastName": "",
    "phone": "+393755832787",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Emanuela angius",
    "lastName": "",
    "phone": "+393516446169",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Mel",
    "lastName": "",
    "phone": "+393273815355",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Klarisa",
    "lastName": "",
    "phone": "+393201466384",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Federico",
    "lastName": "",
    "phone": "+393336352974",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Monica",
    "lastName": "",
    "phone": "+393382142256",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Eleonora",
    "lastName": "",
    "phone": "+393270573022",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Eleana",
    "lastName": "",
    "phone": "+393479754478",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Cesare",
    "lastName": "",
    "phone": "+393487155019",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Alessandro",
    "lastName": "",
    "phone": "+393403501961",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Anita",
    "lastName": "",
    "phone": "+393351746065",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Marco",
    "lastName": "",
    "phone": "+393388889202",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Mamma",
    "lastName": "",
    "phone": "+393336323996",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Lina",
    "lastName": "",
    "phone": "+393271893657",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Veronica",
    "lastName": "",
    "phone": "+393488698702",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Martina",
    "lastName": "",
    "phone": "+393737391505",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Marilena",
    "lastName": "",
    "phone": "+393357441431",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Luca",
    "lastName": "",
    "phone": "+393896542866",
    "email": null,
    "notes": null
  },
  {
    "firstName": "",
    "lastName": "",
    "phone": "",
    "email": "lupantea@gmail.com",
    "notes": null
  },
  {
    "firstName": "Michele",
    "lastName": "",
    "phone": "+393755833852",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Catalin",
    "lastName": "",
    "phone": "+393661415229",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Conci",
    "lastName": "",
    "phone": "+393397951459",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Emanuele",
    "lastName": "",
    "phone": "+393317098614",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Monia",
    "lastName": "",
    "phone": "+393402519090",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Martina",
    "lastName": "",
    "phone": "+393397932950",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Roberta",
    "lastName": "",
    "phone": "+393483669343",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Giulia",
    "lastName": "",
    "phone": "+393516425413",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Miki",
    "lastName": "",
    "phone": "+393275496892",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Adriana",
    "lastName": "Pernorio",
    "phone": "+393405264560",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Lucia",
    "lastName": "Guerra",
    "phone": "+393457268091",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Chiara",
    "lastName": "Guenda",
    "phone": "+393342691595",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Beatrice",
    "lastName": "Montagna",
    "phone": "+393296741211",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Armando",
    "lastName": "",
    "phone": "+393402673222",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Angela",
    "lastName": "Patti",
    "phone": "+393394928660",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Viviana",
    "lastName": "Dal prato",
    "phone": "+393348108513",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Viviana",
    "lastName": "",
    "phone": "+393519032709",
    "email": null,
    "notes": "Nota rubrica: Amica vera"
  },
  {
    "firstName": "Vero",
    "lastName": "Zanetti",
    "phone": "+393202621039",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Valeria",
    "lastName": "Bernó",
    "phone": "+393296424621",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Titti",
    "lastName": "",
    "phone": "+393473008644",
    "email": null,
    "notes": "Nota rubrica: Capo sonia"
  },
  {
    "firstName": "Stefi",
    "lastName": "",
    "phone": "+393276595747",
    "email": null,
    "notes": "Nota rubrica: Amica angi cap"
  },
  {
    "firstName": "Sofia",
    "lastName": "Montagna",
    "phone": "+393737012611",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Silvana",
    "lastName": "Parzini",
    "phone": "+393897855770",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Sara",
    "lastName": "Pezzella",
    "phone": "+393389325033",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Sara",
    "lastName": "Colombo",
    "phone": "+393462708183",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Sabrina",
    "lastName": "Venerando",
    "phone": "+393332892365",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Roberta",
    "lastName": "Bellazzi",
    "phone": "+393382259951",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Rina",
    "lastName": "",
    "phone": "+393284246784",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Paolo",
    "lastName": "Gennari",
    "phone": "+393203058480",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Paola",
    "lastName": "Brunoldi",
    "phone": "+393476982419",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Panariello",
    "lastName": "",
    "phone": "+393519330974",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Ornella",
    "lastName": "Mazzini",
    "phone": "+393356035295",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Omar",
    "lastName": "",
    "phone": "+393450562970",
    "email": null,
    "notes": "Nota rubrica: Assicurazione toro"
  },
  {
    "firstName": "Morena",
    "lastName": "Corna",
    "phone": "+393483386732",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Monia",
    "lastName": "",
    "phone": "+393397610963",
    "email": null,
    "notes": "Nota rubrica: Mamma maritina"
  },
  {
    "firstName": "Melissa",
    "lastName": "Venturin",
    "phone": "+393477943575",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Mary",
    "lastName": "Di maio bar",
    "phone": "+393493363702",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Martina",
    "lastName": "Testoni",
    "phone": "+393347925856",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Martina",
    "lastName": "Mancò",
    "phone": "+393347975602",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Mariuccia",
    "lastName": "",
    "phone": "+393475401149",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Marina",
    "lastName": "Motta",
    "phone": "+393481162204",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Tammy",
    "lastName": "",
    "phone": "+393333403707",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Marina",
    "lastName": "Marina",
    "phone": "+393383681833",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Mariapia",
    "lastName": "",
    "phone": "+393408614387",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Maria",
    "lastName": "Parzini",
    "phone": "+393285491243",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Mamma marina motta",
    "lastName": "",
    "phone": "+393477759585",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Mamma linda cip",
    "lastName": "",
    "phone": "+393472327974",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Stefy",
    "lastName": "Mirabello",
    "phone": "+393382779141",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Maddalena",
    "lastName": "",
    "phone": "+393341412992",
    "email": null,
    "notes": "Nota rubrica: Collega marco"
  },
  {
    "firstName": "Luciana",
    "lastName": "Pernorio",
    "phone": "+393382435909",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Lucia",
    "lastName": "Mosca",
    "phone": "+393332437633",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Lucia",
    "lastName": "",
    "phone": "+393406254695",
    "email": null,
    "notes": "Nota rubrica: Cliente serena"
  },
  {
    "firstName": "Luca",
    "lastName": "",
    "phone": "+393349870111",
    "email": null,
    "notes": "Nota rubrica: Capo angi"
  },
  {
    "firstName": "Lidia",
    "lastName": "Delzani",
    "phone": "+393336651501",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Leti",
    "lastName": "",
    "phone": "+393894825759",
    "email": null,
    "notes": "Nota rubrica: Vicina casa"
  },
  {
    "firstName": "Leo",
    "lastName": "Uccelli",
    "phone": "+393927848158",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Martina",
    "lastName": "Asquino",
    "phone": "+393458418271",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Silvia",
    "lastName": "",
    "phone": "+393497971806",
    "email": null,
    "notes": "Nota rubrica: Amica marta"
  },
  {
    "firstName": "Laura",
    "lastName": "Pilo",
    "phone": "+393404994776",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Laura",
    "lastName": "Medici",
    "phone": "+393400769006",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Ivano",
    "lastName": "",
    "phone": "+393493654146",
    "email": null,
    "notes": "Nota rubrica: Piscina"
  },
  {
    "firstName": "Giulia",
    "lastName": "Petrosillo",
    "phone": "+393404501694",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Giorgia",
    "lastName": "Venerando",
    "phone": "+393312208314",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Franci",
    "lastName": "",
    "phone": "+393471594211",
    "email": null,
    "notes": "Nota rubrica: Mamma vera"
  },
  {
    "firstName": "Franca",
    "lastName": "Salini",
    "phone": "+393333446870",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Franca",
    "lastName": "Granata",
    "phone": "+393426319082",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Flory",
    "lastName": "",
    "phone": "+393276617230",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Erika",
    "lastName": "Raisa",
    "phone": "+393397519799",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Enrica",
    "lastName": "Costa",
    "phone": "+393313945538",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Elisa",
    "lastName": "",
    "phone": "+393475091747",
    "email": null,
    "notes": "Nota rubrica: Varona ritmo"
  },
  {
    "firstName": "Elisa",
    "lastName": "Aurelio",
    "phone": "+393454665018",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Eli",
    "lastName": "Uccelli",
    "phone": "+393496335418",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Eleonora",
    "lastName": "Valeri pipitone",
    "phone": "+393342536290",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Elena",
    "lastName": "Andreone",
    "phone": "+393474797091",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Danilo",
    "lastName": "Maldarella",
    "phone": "+393482948040",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Daniela",
    "lastName": "Pozzi",
    "phone": "+393274449077",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Cri",
    "lastName": "Asquino",
    "phone": "+393887940125",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Claudia",
    "lastName": "Sop",
    "phone": "+393278024467",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Claudia",
    "lastName": "Casoni",
    "phone": "+393381479665",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Chiara",
    "lastName": "Oldani",
    "phone": "+393384669737",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Caterina",
    "lastName": "",
    "phone": "+393356847265",
    "email": null,
    "notes": "Nota rubrica: Capo anto"
  },
  {
    "firstName": "Carol",
    "lastName": "Brunoldi",
    "phone": "+393492485112",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Carmela",
    "lastName": "",
    "phone": "+393405543186",
    "email": null,
    "notes": "Nota rubrica: Cliente ari"
  },
  {
    "firstName": "Benedetta",
    "lastName": "",
    "phone": "+393664907495",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Barbara",
    "lastName": "Rabachin",
    "phone": "+393473836407",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Barbara",
    "lastName": "",
    "phone": "+393473213378",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Arianna",
    "lastName": "Farina",
    "phone": "+393393083385",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Angela",
    "lastName": "Bar",
    "phone": "+393203162156",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Alice",
    "lastName": "Salvini",
    "phone": "+393336129688",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Alessia",
    "lastName": "Jeta",
    "phone": "+393292255784",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Adelaide",
    "lastName": "",
    "phone": "+393293194408",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Ele",
    "lastName": "Ilardo",
    "phone": "+393460637556",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Silvia",
    "lastName": "Desio",
    "phone": "+393292126248",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Letizia",
    "lastName": "Giannone",
    "phone": "+393314440236",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Arianna",
    "lastName": "Righini",
    "phone": "+393661110614",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Neliana",
    "lastName": "",
    "phone": "+393484529630",
    "email": null,
    "notes": "Nota rubrica: Milm"
  },
  {
    "firstName": "Asia",
    "lastName": "",
    "phone": "+393312808493",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Sabrina",
    "lastName": "D'angelo",
    "phone": "+393479412362",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Giulia",
    "lastName": "Mangiarotti",
    "phone": "+393452211852",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Patrizia",
    "lastName": "Degrazia",
    "phone": "+393492912975",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Nicolò",
    "lastName": "Quaglia",
    "phone": "+393387985589",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Alessia",
    "lastName": "Fiammarelli",
    "phone": "+393474424129",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Alessandra maria",
    "lastName": "Rizzi",
    "phone": "+393428502232",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Antonella",
    "lastName": "Olivari",
    "phone": "+393406931054",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Asia",
    "lastName": "Lucianatelli",
    "phone": "+393495248640",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Carlotta",
    "lastName": "Brunoldi",
    "phone": "+393385664279",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Cinzia",
    "lastName": "Dal prato",
    "phone": "+393488618078",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Diana",
    "lastName": "George",
    "phone": "+393519098857",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Vitiello",
    "lastName": "",
    "phone": "+393331409415",
    "email": null,
    "notes": "Nota rubrica: Vidiello"
  },
  {
    "firstName": "Caterina",
    "lastName": "Ferrari",
    "phone": "+393497413780",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Donatella",
    "lastName": "Marchesi",
    "phone": "+393289665903",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Soina",
    "lastName": "Gheorghe",
    "phone": "+393293637769",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Chiara",
    "lastName": "Gibin",
    "phone": "+393396998644",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Donatella",
    "lastName": "",
    "phone": "+393473904896",
    "email": null,
    "notes": "Nota rubrica: Madama"
  },
  {
    "firstName": "Elena",
    "lastName": "Mantovani",
    "phone": "+393388140200",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Gabriella",
    "lastName": "",
    "phone": "+393333087501",
    "email": null,
    "notes": "Nota rubrica: Buondonna"
  },
  {
    "firstName": "Gloria",
    "lastName": "Crosta",
    "phone": "+393469843573",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Gemma",
    "lastName": "Parzini",
    "phone": "+393331297082",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Laura",
    "lastName": "Piovani",
    "phone": "+393493132363",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Laura",
    "lastName": "Tacchini",
    "phone": "+393396327064",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Linda",
    "lastName": "Cipriani",
    "phone": "+393383228203",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Martina",
    "lastName": "Puricelli",
    "phone": "+393455642220",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Manjola",
    "lastName": "Gyeka",
    "phone": "+393312720181",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Silvia",
    "lastName": "Cicola",
    "phone": "+393331048744",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Marta",
    "lastName": "Rubini",
    "phone": "+393457641463",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Marta",
    "lastName": "Manzolli",
    "phone": "+393459325663",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Massimo",
    "lastName": "Salttori",
    "phone": "+393453570222",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Mara",
    "lastName": "Lusetti",
    "phone": "+393345428346",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Martina",
    "lastName": "Pedrazzini",
    "phone": "+393486068522",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Maria",
    "lastName": "Nita",
    "phone": "+393281961550",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Paola",
    "lastName": "Codino",
    "phone": "+393357730816",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Paola",
    "lastName": "Salini",
    "phone": "+393381729179",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Paola",
    "lastName": "Cubini",
    "phone": "+393386922910",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Ornella",
    "lastName": "Facchinello",
    "phone": "+393286784291",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Rosa",
    "lastName": "Di dio",
    "phone": "+393409028728",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Raffaella",
    "lastName": "Pollini",
    "phone": "+39335284397",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Sara",
    "lastName": "Torriani",
    "phone": "+393922013920",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Serena",
    "lastName": "Cappadonia",
    "phone": "+393466879969",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Simona",
    "lastName": "Mazzetto",
    "phone": "+393358457359",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Speranza",
    "lastName": "Trebbini",
    "phone": "+393475051577",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Silvia",
    "lastName": "Boccia",
    "phone": "+393458446922",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Sara",
    "lastName": "Contartese",
    "phone": "+393406118388",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Teresa",
    "lastName": "Masi",
    "phone": "+393474901490",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Vittoria",
    "lastName": "Seren",
    "phone": "+393357376230",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Victoria",
    "lastName": "",
    "phone": "+393286486014",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Maria valentina",
    "lastName": "Boccia",
    "phone": "+393343068367",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Valentina",
    "lastName": "",
    "phone": "+393401632659",
    "email": null,
    "notes": null
  },
  {
    "firstName": "Valentina",
    "lastName": "Ottone",
    "phone": "+393391227462",
    "email": null,
    "notes": null
  }
];

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "boutique-del-benessere" },
  });
  if (!tenant) throw new Error("Tenant boutique-del-benessere non trovato. Esegui prima seed.boutique.ts");

  let created = 0, skipped = 0;

  for (const client of CLIENTS) {
    const phone = client.phone || "N/D";
    const existing = client.phone
      ? await prisma.client.findFirst({ where: { tenantId: tenant.id, phone } })
      : null;

    if (existing) { skipped++; continue; }

    await prisma.client.create({
      data: {
        tenantId: tenant.id,
        firstName: client.firstName || "N/D",
        lastName: client.lastName,
        phone,
        email: client.email || undefined,
        notes: client.notes || undefined,
      },
    });
    created++;
  }

  console.log(`✅ Clienti importati: ${created}, già presenti: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
