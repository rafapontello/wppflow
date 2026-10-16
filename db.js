// Camada de dados do WPP Flow.
// Tudo que fala com o Supabase (login e banco) fica aqui. Se o config.js estiver vazio,
// usa um "modo local" que imita o Supabase guardando tudo no navegador (só para testes).
(function () {
  const cfg = window.WPPFLOW_CONFIG || {};
  const LIST_COLUMNS = "id, name, screen_count, is_public, share_token, created_at, updated_at";
  const IMAGE_BUCKET = cfg.IMAGE_BUCKET || "prototype-images";

  function checkDomain(email) {
    const dom = (cfg.ALLOWED_DOMAIN || "").toLowerCase();
    if (dom && !String(email).toLowerCase().trim().endsWith("@" + dom)) {
      throw new Error(`Use seu e-mail @${dom} para criar a conta.`);
    }
  }

  // Traduz as mensagens de erro mais comuns do Supabase
  function friendly(err) {
    const m = (err && err.message) || String(err);
    const map = [
      [/Invalid login credentials/i, "E-mail ou senha incorretos."],
      [/Email not confirmed/i, "Confirme seu e-mail antes de entrar (veja sua caixa de entrada)."],
      [/User already registered/i, "Já existe uma conta com este e-mail. Tente entrar."],
      [/Password should be at least/i, "A senha precisa ter pelo menos 6 caracteres."],
      [/Database error saving new user/i, `Só e-mails @${cfg.ALLOWED_DOMAIN} podem criar conta.`],
      [/rate limit/i, "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo."],
      [/Failed to fetch/i, "Sem conexão com o servidor. Verifique sua internet."],
      [/statement timeout/i, "O servidor demorou para responder. Tente salvar de novo em instantes."],
      [/Bucket not found/i, "O espaço de imagens ainda não foi criado no Supabase (rode o storage.sql)."],
      [/row-level security/i, "Sem permissão para enviar imagens. Confira se o storage.sql foi rodado no Supabase."],
      [/(exceeded the maximum allowed size|Payload too large)/i, "Uma das imagens passa de 10 MB. Use uma imagem menor."],
    ];
    for (const [re, txt] of map) if (re.test(m)) return new Error(txt);
    return err instanceof Error ? err : new Error(m);
  }

  const wrap = (fn) => async (...args) => {
    try { return await fn(...args); } catch (e) { throw friendly(e); }
  };
  const must = ({ data, error }) => { if (error) throw error; return data; };

  // ---------------- Imagens fora do protótipo ----------------
  // O editor guarda imagens como texto base64 dentro do protótipo, o que deixa cada
  // salvamento pesado. Antes de salvar, cada imagem é enviada uma única vez para o
  // Supabase Storage e, no protótipo, fica só o link dela. Protótipos antigos são
  // convertidos sozinhos no próximo salvamento.
  const DATA_URL_RE = /^data:image\/(png|jpe?g|gif|webp);base64,/i;
  const MIN_SIZE = 4096; // imagens muito pequenas (ícones) continuam dentro do protótipo
  const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp" };
  const uploaded = new Map(); // base64 -> link, para não reenviar a mesma imagem

  function dataUrlToBytes(url) {
    const comma = url.indexOf(",");
    let mime = url.slice(5, url.indexOf(";")).toLowerCase();
    if (mime === "image/jpg") mime = "image/jpeg";
    const bin = atob(url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime };
  }
  async function sha256(bytes) {
    const h = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(h), (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const isImage = (v) => typeof v === "string" && v.length > MIN_SIZE && DATA_URL_RE.test(v);
  function collect(node, out) {
    if (isImage(node)) out.add(node);
    else if (Array.isArray(node)) node.forEach((n) => collect(n, out));
    else if (node && typeof node === "object") Object.values(node).forEach((n) => collect(n, out));
    return out;
  }
  function replace(node) {
    if (isImage(node)) return uploaded.get(node) || node;
    if (Array.isArray(node)) return node.map(replace);
    if (node && typeof node === "object") {
      const o = {};
      for (const k in node) o[k] = replace(node[k]);
      return o;
    }
    return node;
  }
  async function externalizeImages(snap, upload) {
    const pending = [...collect(snap, new Set())].filter((u) => !uploaded.has(u));
    // até 4 envios ao mesmo tempo
    let i = 0;
    const worker = async () => {
      while (i < pending.length) {
        const u = pending[i++];
        uploaded.set(u, await upload(u));
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, pending.length) }, worker));
    return replace(snap);
  }

  // ---------------- Supabase ----------------
  function supabaseApi() {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

    async function uploadImage(dataUrl) {
      const { bytes, mime } = dataUrlToBytes(dataUrl);
      const { data } = await sb.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) throw new Error("Sua sessão expirou. Entre de novo para salvar.");
      // O nome do arquivo é a "impressão digital" da imagem: a mesma imagem nunca é enviada duas vezes
      const path = `${uid}/${await sha256(bytes)}.${EXT[mime]}`;
      const { error } = await sb.storage.from(IMAGE_BUCKET).upload(path, new Blob([bytes], { type: mime }), {
        contentType: mime, cacheControl: "31536000", upsert: false,
      });
      if (error && !/already exists|duplicate/i.test(error.message) && String(error.statusCode) !== "409") throw error;
      return sb.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
    }

    return {
      mode: "supabase",
      async getUser() { const { data } = await sb.auth.getSession(); return data.session?.user || null; },
      onAuthChange(cb) {
        const { data } = sb.auth.onAuthStateChange((event, session) => cb(event, session?.user || null));
        return () => data.subscription.unsubscribe();
      },
      signIn: wrap(async (email, password) => must(await sb.auth.signInWithPassword({ email: email.trim(), password }))),
      signUp: wrap(async (email, password, name) => {
        checkDomain(email);
        const data = must(await sb.auth.signUp({
          email: email.trim(), password,
          options: { data: { name }, emailRedirectTo: location.origin + location.pathname },
        }));
        return { needsConfirmation: !data.session };
      }),
      signOut: wrap(async () => must(await sb.auth.signOut())),
      resetPassword: wrap(async (email) => must(await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: location.origin + location.pathname,
      }))),
      updatePassword: wrap(async (password) => must(await sb.auth.updateUser({ password }))),

      list: wrap(async () => must(await sb.from("prototypes").select(LIST_COLUMNS).order("updated_at", { ascending: false }))),
      get: wrap(async (id) => must(await sb.from("prototypes").select("*").eq("id", id).single())),
      create: wrap(async ({ name, data }) => must(await sb.from("prototypes").insert({ name, data }).select(LIST_COLUMNS).single())),
      prepareForSave: wrap(async (snap) => externalizeImages(snap, uploadImage)),
      update: wrap(async (id, patch) => must(await sb.from("prototypes").update(patch).eq("id", id).select(LIST_COLUMNS).single())),
      remove: wrap(async (id) => must(await sb.from("prototypes").delete().eq("id", id))),
      getShared: wrap(async (token) => {
        const rows = must(await sb.rpc("get_shared_prototype", { token }));
        return rows && rows[0] ? rows[0] : null;
      }),
    };
  }

  // ---------------- Modo local (sem Supabase) ----------------
  function localApi() {
    const KEY = "wppflow_local_db";
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { user: null, rows: [] }; } catch { return { user: null, rows: [] }; } };
    const save = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { throw new Error("O navegador não tem espaço para salvar (modo local)."); } };
    const listeners = new Set();
    const emit = (ev, u) => listeners.forEach((cb) => cb(ev, u));
    const now = () => new Date().toISOString();
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
    const pick = (r) => ({
      id: r.id, name: r.name, is_public: r.is_public, share_token: r.share_token,
      created_at: r.created_at, updated_at: r.updated_at,
      screen_count: (r.data && r.data.screens ? r.data.screens.length : 0),
    });
    const mine = (db) => db.rows.filter((r) => db.user && r.user_id === db.user.id);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    return {
      mode: "local",
      async getUser() { return load().user; },
      onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
      signIn: wrap(async (email) => { const db = load(); db.user = { id: "local-" + email.trim().toLowerCase(), email: email.trim() }; save(db); emit("SIGNED_IN", db.user); }),
      signUp: wrap(async (email, password, name) => {
        checkDomain(email);
        if ((password || "").length < 6) throw new Error("Password should be at least 6 characters");
        const db = load(); db.user = { id: "local-" + email.trim().toLowerCase(), email: email.trim(), user_metadata: { name } }; save(db); emit("SIGNED_IN", db.user);
        return { needsConfirmation: false };
      }),
      signOut: wrap(async () => { const db = load(); db.user = null; save(db); emit("SIGNED_OUT", null); }),
      resetPassword: wrap(async () => {}),
      updatePassword: wrap(async () => {}),
      list: wrap(async () => { await sleep(150); return mine(load()).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(pick); }),
      get: wrap(async (id) => { const r = mine(load()).find((x) => x.id === id); if (!r) throw new Error("Protótipo não encontrado."); return r; }),
      create: wrap(async ({ name, data }) => {
        const db = load();
        const r = { id: uid(), user_id: db.user.id, name, data: data || {}, is_public: false, share_token: uid(), created_at: now(), updated_at: now() };
        db.rows.push(r); save(db); return pick(r);
      }),
      update: wrap(async (id, patch) => {
        await sleep(200);
        const db = load(); const r = mine(db).find((x) => x.id === id);
        if (!r) throw new Error("Protótipo não encontrado.");
        Object.assign(r, patch, { updated_at: now() }); save(db); return pick(r);
      }),
      prepareForSave: async (snap) => snap, // no modo local as imagens ficam no navegador
      remove: wrap(async (id) => { const db = load(); db.rows = db.rows.filter((r) => r.id !== id); save(db); }),
      getShared: wrap(async (token) => { const r = load().rows.find((x) => x.share_token === token && x.is_public); return r ? { name: r.name, data: r.data, updated_at: r.updated_at } : null; }),
    };
  }

  const hasConfig = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  window.DB = hasConfig && window.supabase ? supabaseApi() : localApi();
  // Motivo do modo local, para a faixa amarela explicar o que falta
  window.DB.localReason = !hasConfig ? "config" : !window.supabase ? "sdk" : null;
})();
