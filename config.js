// Configuração do WPP Flow
// Cole aqui os dados do seu projeto Supabase (Project Settings → API).
// A "anon public key" pode ficar no código: quem protege os dados são as regras (RLS) do banco.
// Se deixar em branco, a plataforma abre em MODO LOCAL (salva só neste navegador, para testes).

window.WPPFLOW_CONFIG = {
  SUPABASE_URL: "",       // ex.: "https://vyhpxvwcnvhesbnimake.supabase.co"
  SUPABASE_ANON_KEY: "",  // ex.: "sb_publishable_qfH1DNdD5lN5TieRz8unLA_wlSxgofv"
  ALLOWED_DOMAIN: "dtidigital.com.br", // só e-mails deste domínio podem criar conta ("" libera qualquer e-mail)
};
