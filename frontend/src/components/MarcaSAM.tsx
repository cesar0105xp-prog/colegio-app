import { useState } from 'react';

// Identidad de SAM — Sistema de Acompañamiento y Monitoreo, Liceo Moderno San Marcos.
// Colores tomados del logo institucional.
export const COLORES_SAM = {
  azul: '#1E3A6E',
  dorado: '#E8B33A',
  lavanda: '#C7D2F5',
  morado: '#7C4DDB',
  crema: '#FAF8F3',
};

/** Logotipo "SAM" con el anillo dorado que cruza la A. */
export function LogoSAM({ className = 'h-16', claro = false }: { className?: string; claro?: boolean }) {
  const texto = claro ? '#FFFFFF' : COLORES_SAM.azul;
  return (
    <svg viewBox="0 0 300 120" className={className} role="img" aria-label="SAM">
      {/* Puntos decorativos arriba a la derecha */}
      <circle cx="232" cy="14" r="9" fill={COLORES_SAM.dorado} />
      <circle cx="254" cy="18" r="4.5" fill={COLORES_SAM.lavanda} />
      <circle cx="268" cy="24" r="4.5" fill={COLORES_SAM.lavanda} />
      <circle cx="280" cy="32" r="4.5" fill={COLORES_SAM.lavanda} />
      <text x="150" y="106" textAnchor="middle"
        fontFamily="'Montserrat', 'Poppins', 'Segoe UI', system-ui, sans-serif"
        fontWeight={800} fontSize="104" letterSpacing="2" fill={texto}>SAM</text>
      {/* Anillo dorado sobre la A */}
      <ellipse cx="150" cy="78" rx="62" ry="12" fill="none" stroke={COLORES_SAM.dorado} strokeWidth="6"
        transform="rotate(-14 150 78)" strokeLinecap="round" />
    </svg>
  );
}

/** Ícono compacto para el menú lateral. */
export function IconoSAM({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} role="img" aria-label="SAM">
      <rect width="40" height="40" rx="11" fill={COLORES_SAM.azul} />
      <text x="20" y="26" textAnchor="middle" fontFamily="'Montserrat', 'Segoe UI', system-ui, sans-serif"
        fontWeight={800} fontSize="13" fill="#FFFFFF">SAM</text>
      <ellipse cx="20" cy="22" rx="13" ry="3.2" fill="none" stroke={COLORES_SAM.dorado} strokeWidth="1.6" transform="rotate(-14 20 22)" />
      <circle cx="31" cy="9" r="2.4" fill={COLORES_SAM.dorado} />
    </svg>
  );
}

/**
 * Mascota (león de SAM). La imagen vive en /public/sam-mascota.png; mientras no
 * exista, el componente no muestra nada.
 */
export function MascotaSAM({ className = 'h-40' }: { className?: string }) {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return <img src="/sam-mascota.png" alt="León de SAM" className={`${className} w-auto object-contain`} onError={() => setVisible(false)} />;
}

/** Encabezado completo: mascota, logotipo, nombre del sistema y del colegio. */
export function EncabezadoSAM() {
  return (
    <div className="flex flex-col items-center text-center">
      <MascotaSAM className="h-32 sm:h-40 -mb-2" />
      <LogoSAM className="h-16 sm:h-20" />
      <div className="w-full flex items-center gap-2 mt-2">
        <span className="flex-1 h-px" style={{ background: COLORES_SAM.azul, opacity: 0.8 }} />
        <span className="w-2 h-2 rounded-full" style={{ background: COLORES_SAM.dorado }} />
        <span className="flex-1 h-px" style={{ background: COLORES_SAM.azul, opacity: 0.8 }} />
      </div>
      <p className="mt-2 text-sm sm:text-base font-bold" style={{ color: COLORES_SAM.azul }}>
        Sistema de Acompañamiento y Monitoreo
      </p>
      <div className="w-full flex items-center gap-3 mt-1">
        <span className="flex-1 h-0.5 rounded" style={{ background: COLORES_SAM.dorado }} />
        <span className="text-xs sm:text-sm tracking-wide text-slate-600">Liceo Moderno San Marcos</span>
        <span className="flex-1 h-0.5 rounded" style={{ background: COLORES_SAM.dorado }} />
      </div>
    </div>
  );
}
