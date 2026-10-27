# Salud y deporte

App web instalable (PWA) de seguimiento de salud y deporte de Rolo. Los datos viven en Supabase;
este repositorio es público, así que **solo contiene código** (nunca datos de salud ni claves secretas).

- `web/`: la app (HTML + JS sin build). Basada en el panel de entrenamiento, ahora con inicio de sesión y datos desde Supabase.
  - `config.js`: URL y clave pública (publishable) de Supabase. La seguridad la dan las políticas RLS.
  - `db.js`: sesión, carga de datos y registros rápidos (check-in).
  - `app.js`: vistas. Nueva vista **Hoy** (estado de recuperación, check-in, plan de 7 días, dolencias).
- `vercel.json`: publica la carpeta `web/`.

Esquema de la base: ver `plataforma/schema.sql` en la carpeta del proyecto (tablas con RLS por usuario).
