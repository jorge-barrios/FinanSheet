import {
    HomeIcon,
    TransportIcon,
    DebtIcon,
    HealthIcon,
    SubscriptionIcon,
    MiscIcon,
    TagIcon,
    CurrencyDollarIcon,
    EducationIcon,
    EntertainmentIcon,
    ServicesIcon,
    SalaryIcon,
    DonationsIcon,
} from '../components/icons';

// Define a type for the icon component
type IconComponent = React.FC<{ className?: string }>;

/**
 * Maps category names to icons.
 * Supports both English (DB keys) and Spanish (display names).
 * Global categories from DB: housing, utilities, transport, food, health,
 * subscriptions, debt, savings, personal, entertainment, education, 
 * insurance, home, pets, business, gifts, donations, travel, taxes, other
 */
export function getCategoryIcon(categoryName: string): IconComponent {
    const normalized = categoryName.toLowerCase().trim();

    // HOUSING / VIVIENDA / HOME
    if (['housing', 'home', 'vivienda', 'hogar', 'casa', 'arriendo', 'dividendo', 'alquiler'].some(k => normalized.includes(k))) {
        return HomeIcon;
    }

    // UTILITIES / SERVICIOS (luz, agua, gas)
    if (['utilities', 'servicios', 'servicio', 'luz', 'agua', 'gas', 'electricidad', 'telefono', 'celular'].some(k => normalized.includes(k))) {
        return ServicesIcon;
    }

    // TRANSPORT / TRANSPORTE
    if (['transport', 'transporte', 'auto', 'bencina', 'uber', 'peaje', 'combustible', 'tag'].some(k => normalized.includes(k))) {
        return TransportIcon;
    }

    // FOOD / ALIMENTACIÓN
    if (['food', 'alimentación', 'alimentacion', 'supermercado', 'comida', 'restaurant', 'mercado'].some(k => normalized.includes(k))) {
        return MiscIcon;
    }

    // HEALTH / SALUD
    if (['health', 'salud', 'isapre', 'doctor', 'farmacia', 'medicamento', 'médico', 'clinica'].some(k => normalized.includes(k))) {
        return HealthIcon;
    }

    // SUBSCRIPTIONS / SUSCRIPCIONES
    if (['subscription', 'suscripcion', 'suscripciones', 'netflix', 'spotify', 'internet', 'plan', 'streaming'].some(k => normalized.includes(k))) {
        return SubscriptionIcon;
    }

    // DEBT / DEUDA
    if (['debt', 'deuda', 'crédito', 'credito', 'prestamo', 'préstamo', 'visa', 'mastercard', 'tarjeta'].some(k => normalized.includes(k))) {
        return DebtIcon;
    }

    // SAVINGS / INVERSIONES / AHORRO
    if (['savings', 'ahorro', 'inversión', 'inversion', 'inversiones', 'fondo', 'apv'].some(k => normalized.includes(k))) {
        return CurrencyDollarIcon;
    }

    // EDUCATION / EDUCACIÓN
    if (['education', 'educación', 'educacion', 'colegio', 'universidad', 'curso', 'matrícula'].some(k => normalized.includes(k))) {
        return EducationIcon;
    }

    // ENTERTAINMENT / ENTRETENIMIENTO
    if (['entertainment', 'entretenimiento', 'ocio', 'cine', 'juegos', 'hobby', 'diversión'].some(k => normalized.includes(k))) {
        return EntertainmentIcon;
    }

    // BUSINESS / NEGOCIOS
    if (['business', 'negocios', 'negocio', 'empresa', 'trabajo', 'oficina', 'emprendimiento'].some(k => normalized.includes(k))) {
        return SalaryIcon;
    }

    // INSURANCE / SEGUROS
    if (['insurance', 'seguro', 'seguros', 'póliza', 'poliza'].some(k => normalized.includes(k))) {
        return HealthIcon; // Using health icon for insurance
    }

    // PETS / MASCOTAS
    if (['pets', 'mascota', 'mascotas', 'perro', 'gato', 'veterinario'].some(k => normalized.includes(k))) {
        return MiscIcon;
    }

    // GIFTS / REGALOS
    if (['gifts', 'regalo', 'regalos', 'presente'].some(k => normalized.includes(k))) {
        return MiscIcon;
    }

    // DONATIONS / DONACIONES
    if (['donations', 'donación', 'donacion', 'donaciones', 'caridad'].some(k => normalized.includes(k))) {
        return DonationsIcon;
    }

    // TRAVEL / VIAJES
    if (['travel', 'viaje', 'viajes', 'vacaciones', 'turismo', 'pasaje'].some(k => normalized.includes(k))) {
        return TransportIcon;
    }

    // TAXES / IMPUESTOS
    if (['taxes', 'impuesto', 'impuestos', 'contribuciones', 'sii'].some(k => normalized.includes(k))) {
        return DebtIcon;
    }

    // PERSONAL
    if (['personal', 'aseo', 'ropa', 'vestimenta', 'peluquería'].some(k => normalized.includes(k))) {
        return TagIcon;
    }

    // INCOME / SUELDO (for income categories)
    if (['sueldo', 'salario', 'ingreso', 'remuneración', 'honorarios', 'income'].some(k => normalized.includes(k))) {
        return SalaryIcon;
    }

    // Default - other
    return TagIcon;
}
