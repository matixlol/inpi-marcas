import type { Marca } from "./types.ts";

/** Nice classification (Clasificación de Niza), short Spanish titles. */
export const CLASES: Record<number, string> = {
  0: "Sin clase informada",
  1: "Productos químicos",
  2: "Pinturas, barnices y colorantes",
  3: "Cosméticos, perfumes y productos de limpieza",
  4: "Aceites industriales, combustibles y velas",
  5: "Productos farmacéuticos y veterinarios",
  6: "Metales comunes y sus productos",
  7: "Máquinas y motores",
  8: "Herramientas manuales y cubiertos",
  9: "Aparatos electrónicos, científicos y software",
  10: "Aparatos e instrumentos médicos",
  11: "Iluminación, calefacción, cocción y refrigeración",
  12: "Vehículos",
  13: "Armas de fuego y fuegos artificiales",
  14: "Joyería y relojería",
  15: "Instrumentos musicales",
  16: "Papel, impresos y papelería",
  17: "Caucho, plásticos y aislantes",
  18: "Cuero, bolsos, valijas y paraguas",
  19: "Materiales de construcción no metálicos",
  20: "Muebles y espejos",
  21: "Utensilios de cocina y del hogar, vidrio",
  22: "Cuerdas, carpas y lonas",
  23: "Hilos para uso textil",
  24: "Tejidos, ropa de cama y de mesa",
  25: "Ropa, calzado y sombrerería",
  26: "Mercería, puntillas y flores artificiales",
  27: "Alfombras y revestimientos de piso",
  28: "Juegos, juguetes y artículos de deporte",
  29: "Carne, lácteos, conservas y aceites comestibles",
  30: "Café, harinas, panadería, dulces y condimentos",
  31: "Productos agrícolas frescos, plantas y alimento animal",
  32: "Cervezas, aguas y bebidas sin alcohol",
  33: "Bebidas alcohólicas (excepto cerveza)",
  34: "Tabaco y artículos para fumadores",
  35: "Publicidad, gestión de negocios y comercio",
  36: "Seguros, finanzas e inmobiliarias",
  37: "Construcción, reparación e instalación",
  38: "Telecomunicaciones",
  39: "Transporte, viajes y almacenamiento",
  40: "Tratamiento de materiales e impresión",
  41: "Educación, entretenimiento, eventos y fiestas",
  42: "Servicios científicos, tecnológicos y software",
  43: "Restaurantes, bares y hotelería",
  44: "Servicios médicos, de belleza y agrícolas",
  45: "Servicios jurídicos, de seguridad y personales",
};

export const claseNombre = (clase: number) => CLASES[clase] ?? `Clase ${clase}`;

export const PRODUCTOS_HASTA = 34; // classes 1–34 are goods, 35–45 services

export type Situacion =
  | "vigente"
  | "tramite"
  | "vencida"
  | "caduca"
  | "denegada"
  | "abandonada"
  | "desistida"
  | "nula"
  | "otra";

export const SITUACIONES: Record<
  Situacion,
  { label: string; tono: "ok" | "info" | "warn" | "muted"; bloquea: boolean; explicacion: string }
> = {
  vigente: {
    label: "Vigente",
    tono: "ok",
    bloquea: true,
    explicacion:
      "Concedida y sin vencer. El titular tiene el uso exclusivo en esta clase y puede oponerse a marcas parecidas.",
  },
  tramite: {
    label: "En trámite",
    tono: "info",
    bloquea: true,
    explicacion:
      "Solicitud presentada que todavía no se resolvió. Tiene prioridad sobre pedidos posteriores, así que también puede bloquear.",
  },
  vencida: {
    label: "Vencida",
    tono: "warn",
    bloquea: false,
    explicacion:
      "Se concedió pero pasó la fecha de vencimiento. Si el titular la renovó, la renovación aparece como otra acta con el mismo nombre.",
  },
  caduca: {
    label: "Caduca",
    tono: "muted",
    bloquea: false,
    explicacion: "El registro se perdió (por ejemplo, por falta de uso o por no renovarla a tiempo).",
  },
  denegada: {
    label: "Denegada",
    tono: "muted",
    bloquea: false,
    explicacion:
      "El INPI rechazó la solicitud, típicamente por parecerse a una marca anterior o por ser genérica. Es un buen antecedente de qué no pasa.",
  },
  abandonada: {
    label: "Abandonada",
    tono: "muted",
    bloquea: false,
    explicacion: "El solicitante dejó de responder o de impulsar el trámite. No otorga derechos.",
  },
  desistida: {
    label: "Desistida",
    tono: "muted",
    bloquea: false,
    explicacion: "El solicitante retiró la solicitud. No otorga derechos.",
  },
  nula: {
    label: "Nula",
    tono: "muted",
    bloquea: false,
    explicacion: "El trámite o el registro fue anulado. No otorga derechos.",
  },
  otra: {
    label: "Otro estado",
    tono: "muted",
    bloquea: false,
    explicacion: "Estado que el INPI informa con un código no documentado.",
  },
};

const hoy = () => new Date().toISOString().slice(0, 10);

export function situacion(m: Marca): Situacion {
  switch (m.estado) {
    case "C":
      return m.vencimiento && m.vencimiento < hoy() ? "vencida" : "vigente";
    case null:
    case "":
    case "E":
      return "tramite";
    case "CA":
      return "caduca";
    case "N":
      return "denegada";
    case "A":
      return "abandonada";
    case "D":
      return "desistida";
    case "NU":
      return "nula";
    default:
      return "otra";
  }
}

export const TIPOS: Record<string, string> = {
  Denominativa: "Solo palabras, sin diseño. Protege el nombre escrito en cualquier tipografía.",
  Mixta: "Palabras más un diseño o logo. Protege la combinación.",
  Figurativa: "Solo un dibujo o logo, sin palabras.",
  Tridimensional: "La forma de un producto o envase.",
  Sonora: "Un sonido o melodía.",
};

/** Filters for the INPI query itself (server-side). */
export const ESTADOS_INPI: { value: string; label: string }[] = [
  { value: "", label: "Todos los estados" },
  { value: "C", label: "Concedidas" },
  { value: "E", label: "En trámite" },
  { value: "N", label: "Denegadas" },
  { value: "CA", label: "Caducas" },
  { value: "A", label: "Abandonadas" },
  { value: "D", label: "Desistidas" },
  { value: "NU", label: "Nulas" },
];
