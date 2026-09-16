// PM2 — Portal Escolar (VPS Hostinger KVM 2: 2 CPU, 8 GB RAM)
//
// Modo cluster con 2 instancias (una por núcleo). PM2 reparte las peticiones
// entre ambas y `pm2 reload` las reinicia de a una, sin cortar el servicio.
//
// Notas del modo cluster:
// - Las dos instancias comparten la base de datos (una sola instancia de Prisma
//   por proceso, ver src/utils/prisma.ts), el disco (uploads) y los logs.
// - Los límites de peticiones (express-rate-limit) se cuentan en memoria POR
//   instancia, así que en la práctica un mismo cliente puede hacer hasta el doble
//   antes del 429. El bloqueo de cuenta tras 5 contraseñas erradas no cambia:
//   se guarda en la base de datos y lo comparten ambas instancias.
// - Para pasar de fork a cluster en un servidor ya en marcha hace falta
//   `pm2 delete colegio-backend` y volver a arrancar; `startOrReload` no cambia
//   el modo de un proceso existente.
module.exports = {
  apps: [
    {
      name: 'colegio-backend',
      script: 'dist/index.js',
      cwd: __dirname,
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',   // reinicia una instancia si supera 1 GB
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',          // un arranque que dura menos cuenta como fallido
      restart_delay: 3000,
      kill_timeout: 10000,        // tiempo para el cierre ordenado de src/index.ts
      merge_logs: true,           // un solo archivo de log para ambas instancias
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
