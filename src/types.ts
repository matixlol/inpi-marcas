export type Titular = {
  cuit: string | null;
  nombre: string;
  porcentaje: number | null;
};

export type Marca = {
  acta: number;
  denominacion: string;
  clase: number;
  tipo: string | null;
  /** Raw INPI code: C, CA, A, N, D, NU, E, or null while in process. */
  estado: string | null;
  resolucion: string | null;
  ingreso: string | null;
  vencimiento: string | null;
  titulares: Titular[];
};

export type SearchResponse = {
  total: number;
  truncated: boolean;
  marcas: Marca[];
};
