export type AccessibilityType = "Ninguna" | "Parcial" | "Total";

export interface PropertyData {
  address: string;
  city: string;
  propertyType: string;
  floor?: number;
  houseFloors?: number;
  size: number;
  rooms: number;
  bathrooms: number;
  halfBaths: number;
  condition: string;
  features: string[];
  constructionYear?: number;
  lastFullRenovationYear?: number;
  lastPartialRenovationYear?: number;
  accessibility: AccessibilityType;
}

export interface LeadData extends PropertyData {
  name: string;
  email: string;
  phone: string;
  estimatedValue?: string;
}

export const PROPERTY_TYPES = [
  "Piso",
  "Ático",
  "Dúplex",
  "Estudio",
  "Casa",
  "Chalet",
  "Villa",
  "Adosado",
  "Pareado"
];

export const CONDITIONS = [
  "Obra nueva",
  "Excelente",
  "Buen estado",
  "A reformar",
  "Reformado"
];

export const FEATURES = [
  "Terraza",
  "Piscina",
  "Garaje",
  "Trastero",
  "Vistas al mar",
  "Jardín",
  "Ascensor",
  "Aire acondicionado"
];
