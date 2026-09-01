-- Executado uma única vez, quando o volume do Postgres é criado.
-- As tabelas são criadas pelas migrações do TypeORM, não aqui: este script
-- cuida apenas do que precisa existir antes da aplicação conectar.

CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS video;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fiapx_video') THEN
    CREATE ROLE fiapx_video LOGIN PASSWORD 'fiapx_video_pwd';
  END IF;
END
$$;

-- O serviço só enxerga o próprio schema: isolamento lógico entre microsserviços
-- numa instância compartilhada, igual ao adotado na fase anterior.
GRANT CONNECT ON DATABASE fiapx TO fiapx_video;
GRANT USAGE, CREATE ON SCHEMA video TO fiapx_video;

ALTER DEFAULT PRIVILEGES IN SCHEMA video
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fiapx_video;

ALTER DEFAULT PRIVILEGES IN SCHEMA video
  GRANT USAGE, SELECT ON SEQUENCES TO fiapx_video;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
