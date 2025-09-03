// Shared category normalization utilities
// Extracted from App.tsx to ensure consistent category grouping and labels

const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
const norm = (s: string) => stripAccents((s || '').toLowerCase().trim());

const CATEGORY_LABELS_ES: Record<string, string> = {
  housing: 'Vivienda',
  utilities: 'Servicios',
  food: 'Alimentación',
  transport: 'Transporte',
  health: 'Salud',
  entertainment: 'Entretenimiento',
  subscriptions: 'Suscripciones',
  education: 'Educación',
  personal: 'Personal',
  savings: 'Ahorro',
  debt: 'Deuda',
  insurance: 'Seguros',
  taxes: 'Impuestos',
  business: 'Negocios',
  gifts: 'Regalos',
  travel: 'Viajes',
  home: 'Hogar',
  pets: 'Mascotas',
  charity: 'Donaciones',
  other: 'Otros',
  // Ingresos
  income: 'Sueldo',
};

const CATEGORY_SYNONYMS: Record<string, string> = {
  // Vivienda / Housing
  'vivienda': 'housing', 'arriendo': 'housing', 'hipoteca': 'housing', 'mortgage': 'housing', 'rent': 'housing', 'housing': 'housing',
  // Servicios / Utilities
  'servicios': 'utilities', 'luz': 'utilities', 'agua': 'utilities', 'gas': 'utilities', 'internet': 'utilities', 'electricidad': 'utilities', 'utilities': 'utilities',
  // Alimentación / Food
  'alimentacion': 'food', 'alimentos': 'food', 'comida': 'food', 'supermercado': 'food', 'food': 'food', 'groceries': 'food',
  // Transporte / Transport
  'transporte': 'transport', 'bus': 'transport', 'metro': 'transport', 'bencina': 'transport', 'gasolina': 'transport', 'transport': 'transport',
  // Salud / Health
  'salud': 'health', 'medico': 'health', 'medicina': 'health', 'isapre': 'health', 'fonasa': 'health', 'health': 'health', 'doctor': 'health', 'medicine': 'health',
  // Entretenimiento / Entertainment
  'entretenimiento': 'entertainment', 'cine': 'entertainment', 'salidas': 'entertainment', 'juegos': 'entertainment', 'videojuegos': 'entertainment', 'entertainment': 'entertainment',
  // Suscripciones / Subscriptions
  'suscripciones': 'subscriptions', 'suscripcion': 'subscriptions', 'netflix': 'subscriptions', 'spotify': 'subscriptions', 'hbo': 'subscriptions', 'prime': 'subscriptions', 'subscriptions': 'subscriptions', 'subscription': 'subscriptions',
  // Educación / Education
  'educacion': 'education', 'colegio': 'education', 'universidad': 'education', 'cursos': 'education', 'education': 'education',
  // Personal
  'personal': 'personal', 'ropa': 'personal', 'cuidado personal': 'personal', 'personal care': 'personal', 'personal expenses': 'personal',
  // Ahorro / Savings
  'ahorro': 'savings', 'savings': 'savings',
  // Deuda / Debt
  'deuda': 'debt', 'deudas': 'debt', 'creditos': 'debt', 'debt': 'debt',
  // Seguros / Insurance
  'seguros': 'insurance', 'seguro': 'insurance', 'insurance': 'insurance',
  // Impuestos / Taxes
  'impuestos': 'taxes', 'iva': 'taxes', 'tax': 'taxes', 'taxes': 'taxes',
  // Negocios / Business
  'negocios': 'business', 'negocio': 'business', 'business': 'business',
  // Regalos / Gifts
  'regalos': 'gifts', 'regalo': 'gifts', 'gifts': 'gifts', 'gift': 'gifts',
  // Viajes / Travel
  'viajes': 'travel', 'viaje': 'travel', 'travel': 'travel', 'trip': 'travel',
  // Hogar / Home (mantenimiento, muebles)
  'hogar': 'home', 'muebles': 'home', 'mantencion': 'home', 'home': 'home', 'furniture': 'home',
  // Mascotas / Pets
  'mascotas': 'pets', 'mascota': 'pets', 'pets': 'pets', 'pet': 'pets',
  // Donaciones / Charity
  'donaciones': 'charity', 'donacion': 'charity', 'charity': 'charity',
  // Otros / Other
  'otros': 'other', 'otro': 'other', 'misc': 'other', 'otros gastos': 'other', 'other': 'other',
  // Ingresos / Income (Sueldo, Salario, Salary, etc.)
  'ingreso': 'income', 'ingresos': 'income', 'sueldo': 'income', 'salario': 'income', 'salary': 'income', 'paycheck': 'income', 'nomina': 'income', 'nómina': 'income', 'pago': 'income',
};

export const getCategoryId = (raw: string) => CATEGORY_SYNONYMS[norm(raw)] || (norm(raw) || 'other');
export const toSpanishCanonical = (raw: string) => CATEGORY_LABELS_ES[getCategoryId(raw)] || raw || 'Otros';
