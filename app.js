// WPP Flow — casca da plataforma: login, "Meus protótipos", editor com salvamento e link compartilhado.
// Escrito com htm (JSX sem build): html`<div>...</div>` funciona como JSX.
(function () {
  const { React, createRoot, Editor, Logo } = window.WPPFlow;
  const { useState, useEffect, useRef, useCallback } = React;
  const html = htm.bind(React.createElement);
  const DB = window.DB;
  const GRADIENT = "linear-gradient(120deg, #000050 0%, #241B7A 35%, #2F5BEA 70%, #16D2B0 105%)";
  const AUTOSAVE_MS = 2000;

  // ---------------- utilidades ----------------
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  function timeAgo(iso) {
    if (!iso) return "";
    const s = (new Date(iso).getTime() - Date.now()) / 1000;
    const steps = [[60, "second"], [3600, "minute", 60], [86400, "hour", 3600], [604800, "day", 86400]];
    if (Math.abs(s) < 45) return "agora mesmo";
    for (const [lim, unit, div = 1] of steps) if (Math.abs(s) < lim) return rtf.format(Math.round(s / div), unit);
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }
  const clock = (d) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const shareUrl = (token) => `${location.origin}${location.pathname}#/s/${token}`;
  const go = (hash) => { location.hash = hash; };

  function useRoute() {
    const parse = () => {
      const h = location.hash.replace(/^#/, "");
      let m;
      if ((m = h.match(/^\/s\/([\w-]+)/))) return { name: "shared", token: m[1] };
      if ((m = h.match(/^\/p\/([\w-]+)/))) return { name: "editor", id: m[1] };
      return { name: "home" };
    };
    const [route, setRoute] = useState(parse);
    useEffect(() => {
      const fn = () => setRoute(parse());
      window.addEventListener("hashchange", fn);
      return () => window.removeEventListener("hashchange", fn);
    }, []);
    return route;
  }

  // ---------------- ícones simples ----------------
  const I = {
    plus: html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    back: html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`,
    dots: html`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>`,
    search: html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
    link: html`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>`,
    check: html`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
    x: html`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>`,
    chat: html`<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.3 7.5L3 21l2-5.5A8.4 8.4 0 1 1 21 11.5Z"/></svg>`,
  };

  const Spinner = ({ size = 18, className = "" }) => html`
    <svg class=${"animate-spin " + className} width=${size} height=${size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.25" stroke-width="3"/>
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    </svg>`;

  // ---------------- toasts ----------------
  let pushToast = () => {};
  function Toasts() {
    const [items, setItems] = useState([]);
    pushToast = (text, kind = "ok") => {
      const id = Math.random();
      setItems((l) => [...l, { id, text, kind }]);
      setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), kind === "error" ? 6000 : 2800);
    };
    return html`<div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none px-4 w-full max-w-md">
      ${items.map((t) => html`<div key=${t.id} class=${"pointer-events-auto rounded-xl px-4 py-2.5 text-sm shadow-lg " + (t.kind === "error" ? "bg-red-600 text-white" : "bg-[#000050] text-white")}>${t.text}</div>`)}
    </div>`;
  }
  const toast = (t, k) => pushToast(t, k);

  // ---------------- modal ----------------
  function Modal({ title, onClose, children, width = "max-w-md" }) {
    useEffect(() => {
      const fn = (e) => e.key === "Escape" && onClose();
      window.addEventListener("keydown", fn);
      return () => window.removeEventListener("keydown", fn);
    }, [onClose]);
    return html`<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#000050]/40 backdrop-blur-[2px]" onMouseDown=${(e) => e.target === e.currentTarget && onClose()}>
      <div class=${"w-full " + width + " bg-white rounded-2xl shadow-2xl"} role="dialog" aria-modal="true">
        <div class="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 class="font-semibold text-[#000050]">${title}</h2>
          <button onClick=${onClose} class="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar">${I.x}</button>
        </div>
        <div class="px-5 pb-5">${children}</div>
      </div>
    </div>`;
  }

  const inputCls = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#16D2B0] focus:ring-2 focus:ring-[#16D2B0]/25";
  const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium bg-[#16D2B0] text-[#000050] hover:brightness-95 disabled:opacity-60 transition";
  const btnGhost = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition";

  function LocalModeBanner() {
    if (DB.mode !== "local") return null;
    return html`<div class="bg-amber-100 text-amber-900 text-xs text-center px-4 py-1.5">
      <strong>Modo local de teste:</strong> ${DB.localReason === "sdk"
        ? "o config.js está preenchido, mas a biblioteca do Supabase não carregou (verifique a internet/bloqueio de rede e recarregue)."
        : "o config.js publicado está sem a URL ou a chave do Supabase."} Os protótipos ficam salvos só neste navegador.
    </div>`;
  }

  // ---------------- login ----------------
  function AuthScreen({ recovery = false, onRecovered }) {
    const [tab, setTab] = useState(recovery ? "newpass" : "login");
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [pass, setPass] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const dom = (window.WPPFLOW_CONFIG || {}).ALLOWED_DOMAIN;

    const submit = async (e) => {
      e.preventDefault();
      setError(""); setInfo(""); setBusy(true);
      try {
        if (tab === "login") await DB.signIn(email, pass);
        else if (tab === "signup") {
          const r = await DB.signUp(email, pass, name);
          if (r.needsConfirmation) { setInfo("Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, é só entrar."); setTab("login"); }
        } else if (tab === "forgot") {
          await DB.resetPassword(email);
          setInfo("Se existir uma conta com esse e-mail, você vai receber um link para criar uma nova senha.");
        } else if (tab === "newpass") {
          await DB.updatePassword(pass);
          toast("Senha atualizada!");
          onRecovered && onRecovered();
        }
      } catch (err) { setError(err.message); }
      finally { setBusy(false); }
    };

    const titles = { login: "Entrar", signup: "Criar conta", forgot: "Recuperar senha", newpass: "Criar nova senha" };
    const cta = { login: "Entrar", signup: "Criar conta", forgot: "Enviar link", newpass: "Salvar nova senha" };
    const switchTab = (t) => { setTab(t); setError(""); setInfo(""); };

    return html`<div class="min-h-full flex flex-col">
      <${LocalModeBanner} />
      <div class="flex-1 grid lg:grid-cols-2">
        <div class="hidden lg:flex flex-col justify-between p-12 text-white" style=${{ background: GRADIENT }}>
          <div><${Logo} color="#fff" style=${{ height: 34, width: "auto" }} /></div>
          <div>
            <h1 class="text-4xl font-semibold leading-tight max-w-md">Protótipos de conversa no WhatsApp, prontos para apresentar.</h1>
            <p class="mt-4 text-white/75 max-w-md">Monte jornadas, telas de Flow, pagamento, menu e loja. Tudo salvo na sua conta para editar e compartilhar quando quiser.</p>
          </div>
          <p class="text-xs text-white/50">dti digital</p>
        </div>
        <div class="flex items-center justify-center p-6">
          <form onSubmit=${submit} class="w-full max-w-sm">
            <div class="lg:hidden rounded-2xl p-5 mb-8" style=${{ background: GRADIENT }}>
              <${Logo} color="#fff" style=${{ height: 26, width: "auto" }} />
            </div>
            <h2 class="text-2xl font-semibold text-[#000050]">${titles[tab]}</h2>
            <p class="text-sm text-slate-500 mt-1 mb-6">
              ${tab === "login" && "Acesse seus protótipos."}
              ${tab === "signup" && (dom ? `Use seu e-mail @${dom}.` : "Crie sua conta para salvar seus protótipos.")}
              ${tab === "forgot" && "Informe seu e-mail para receber o link."}
              ${tab === "newpass" && "Escolha uma nova senha para sua conta."}
            </p>

            ${tab === "signup" && html`<label class="block mb-3"><span class="text-xs font-medium text-slate-600">Nome</span>
              <input class=${inputCls + " mt-1"} value=${name} onInput=${(e) => setName(e.target.value)} autocomplete="name" /></label>`}
            ${tab !== "newpass" && html`<label class="block mb-3"><span class="text-xs font-medium text-slate-600">E-mail</span>
              <input class=${inputCls + " mt-1"} type="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder=${dom ? "voce@" + dom : "voce@empresa.com"} autocomplete="email" /></label>`}
            ${tab !== "forgot" && html`<label class="block mb-1"><span class="text-xs font-medium text-slate-600">${tab === "newpass" ? "Nova senha" : "Senha"}</span>
              <input class=${inputCls + " mt-1"} type="password" required minlength="6" value=${pass} onInput=${(e) => setPass(e.target.value)} autocomplete=${tab === "login" ? "current-password" : "new-password"} /></label>`}
            ${tab === "login" && html`<div class="text-right mb-4"><button type="button" onClick=${() => switchTab("forgot")} class="text-xs text-[#2F5BEA] hover:underline">Esqueci a senha</button></div>`}

            ${error && html`<p class="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">${error}</p>`}
            ${info && html`<p class="mt-3 text-sm text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2">${info}</p>`}

            <button type="submit" disabled=${busy} class=${btnPrimary + " w-full mt-4"}>${busy && html`<${Spinner} size=${16} />`}${cta[tab]}</button>

            <p class="text-sm text-slate-500 mt-6 text-center">
              ${tab === "login" && html`Ainda não tem conta? <button type="button" onClick=${() => switchTab("signup")} class="text-[#2F5BEA] font-medium hover:underline">Criar conta</button>`}
              ${(tab === "signup" || tab === "forgot") && html`Já tem conta? <button type="button" onClick=${() => switchTab("login")} class="text-[#2F5BEA] font-medium hover:underline">Entrar</button>`}
            </p>
          </form>
        </div>
      </div>
    </div>`;
  }

  // ---------------- topo do painel ----------------
  function TopBar({ user }) {
    const [open, setOpen] = useState(false);
    const label = user?.user_metadata?.name || user?.email || "";
    const initials = label.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join("");
    return html`<header class="py-3" style=${{ background: GRADIENT }}>
      <div class="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-3">
        <a href="#/" class="flex items-center gap-3">
          <${Logo} color="#fff" style=${{ height: 26, width: "auto" }} />
          <span class="text-white/40 text-lg font-light hidden sm:inline">/</span>
          <span class="font-medium text-sm text-white/85 hidden sm:inline">Protótipos de Conversa</span>
        </a>
        <div class="flex-1"></div>
        <div class="relative">
          <button onClick=${() => setOpen((o) => !o)} class="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 bg-white/10 hover:bg-white/20 text-white text-sm">
            <span class="w-7 h-7 rounded-full bg-[#16D2B0] text-[#000050] text-xs font-semibold flex items-center justify-center">${initials}</span>
            <span class="hidden sm:inline max-w-[200px] truncate">${label}</span>
          </button>
          ${open && html`<div class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-40" onMouseLeave=${() => setOpen(false)}>
            <div class="px-3 py-2 text-xs text-slate-500 truncate border-b border-slate-100">${user?.email}</div>
            <button onClick=${() => DB.signOut()} class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Sair</button>
          </div>`}
        </div>
      </div>
    </header>`;
  }

  // ---------------- card de protótipo ----------------
  function ProtoCard({ p, onRename, onDuplicate, onDelete }) {
    const [menu, setMenu] = useState(false);
    const [editing, setEditing] = useState(false);
    const commit = (v) => { setEditing(false); const n = v.trim(); if (n && n !== p.name) onRename(p, n); };
    return html`<div class="group relative bg-white rounded-2xl border border-slate-200 hover:border-[#16D2B0] hover:shadow-md transition overflow-hidden">
      <a href=${"#/p/" + p.id} class="block h-28 relative" style=${{ background: GRADIENT }} aria-label=${"Abrir " + p.name}>
        <div class="absolute inset-0 flex items-center justify-center gap-1.5">
          <span class="h-14 w-24 rounded-xl bg-white/15 border border-white/25 flex flex-col justify-center gap-1.5 px-2.5">
            <span class="h-2 w-12 rounded-full bg-white/70"></span>
            <span class="h-2 w-16 rounded-full bg-[#16D2B0] self-end"></span>
            <span class="h-2 w-10 rounded-full bg-white/50"></span>
          </span>
        </div>
        ${p.is_public && html`<span class="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 text-[#000050] text-[11px] font-medium px-2 py-0.5">${I.link} Link público</span>`}
      </a>
      <div class="p-3.5 pr-10">
        ${editing
          ? html`<input autoFocus defaultValue=${p.name} class=${inputCls + " !py-1 !px-2"} onBlur=${(e) => commit(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditing(false); }} />`
          : html`<a href=${"#/p/" + p.id} class="block font-medium text-[#000050] truncate" title=${p.name} onDblClick=${(e) => { e.preventDefault(); setEditing(true); }}>${p.name}</a>`}
        <p class="text-xs text-slate-500 mt-1">${p.screen_count || 0} ${p.screen_count === 1 ? "tela" : "telas"} · editado ${timeAgo(p.updated_at)}</p>
      </div>
      <button onClick=${() => setMenu((m) => !m)} class="absolute bottom-3 right-2 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Opções">${I.dots}</button>
      ${menu && html`<div class="absolute bottom-12 right-2 w-40 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-20" onMouseLeave=${() => setMenu(false)}>
        <a href=${"#/p/" + p.id} class="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Abrir</a>
        <button onClick=${() => { setMenu(false); setEditing(true); }} class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Renomear</button>
        <button onClick=${() => { setMenu(false); onDuplicate(p); }} class="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Duplicar</button>
        <button onClick=${() => { setMenu(false); onDelete(p); }} class="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Excluir</button>
      </div>`}
    </div>`;
  }

  // ---------------- Meus protótipos ----------------
  function Dashboard({ user }) {
    const [items, setItems] = useState(null);
    const [q, setQ] = useState("");
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [busy, setBusy] = useState(false);
    const [toDelete, setToDelete] = useState(null);

    const load = useCallback(async () => {
      try { setItems(await DB.list()); } catch (e) { toast(e.message, "error"); setItems([]); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async (e) => {
      e && e.preventDefault();
      setBusy(true);
      try {
        const p = await DB.create({ name: newName.trim() || "Protótipo sem título", data: {} });
        go("/p/" + p.id);
      } catch (err) { toast(err.message, "error"); setBusy(false); }
    };
    const rename = async (p, name) => {
      setItems((l) => l.map((x) => (x.id === p.id ? { ...x, name } : x)));
      try { await DB.update(p.id, { name }); toast("Nome atualizado"); } catch (e) { toast(e.message, "error"); load(); }
    };
    const duplicate = async (p) => {
      try {
        const full = await DB.get(p.id);
        const copy = await DB.create({ name: p.name + " (cópia)", data: full.data });
        setItems((l) => [copy, ...l]);
        toast("Protótipo duplicado");
      } catch (e) { toast(e.message, "error"); }
    };
    const remove = async () => {
      const p = toDelete; setToDelete(null);
      setItems((l) => l.filter((x) => x.id !== p.id));
      try { await DB.remove(p.id); toast("Protótipo excluído"); } catch (e) { toast(e.message, "error"); load(); }
    };

    const list = (items || []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    const first = (user?.user_metadata?.name || "").split(" ")[0];

    return html`<div class="min-h-full flex flex-col">
      <${LocalModeBanner} />
      <${TopBar} user=${user} />
      <main class="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        <div class="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div class="flex-1">
            <h1 class="text-2xl font-semibold text-[#000050]">${first ? `Olá, ${first}` : "Meus protótipos"}</h1>
            <p class="text-sm text-slate-500 mt-1">${items ? `${items.length} ${items.length === 1 ? "protótipo salvo" : "protótipos salvos"}` : "Carregando..."}</p>
          </div>
          ${items && items.length > 0 && html`<label class="relative sm:w-64">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${I.search}</span>
            <input class=${inputCls + " pl-9"} placeholder="Buscar por nome" value=${q} onInput=${(e) => setQ(e.target.value)} />
          </label>`}
          <button onClick=${() => { setNewName(""); setCreating(true); }} class=${btnPrimary}>${I.plus} Novo protótipo</button>
        </div>

        ${!items && html`<div class="flex justify-center py-24 text-[#2F5BEA]"><${Spinner} size=${28} /></div>`}

        ${items && items.length === 0 && html`<div class="text-center bg-white rounded-2xl border border-dashed border-slate-300 py-16 px-6">
          <div class="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4" style=${{ background: GRADIENT }}>${I.chat}</div>
          <h2 class="font-semibold text-[#000050]">Nenhum protótipo ainda</h2>
          <p class="text-sm text-slate-500 mt-1 mb-5">Crie o primeiro e ele fica salvo aqui na sua conta.</p>
          <button onClick=${() => { setNewName(""); setCreating(true); }} class=${btnPrimary}>${I.plus} Criar protótipo</button>
        </div>`}

        ${items && items.length > 0 && list.length === 0 && html`<p class="text-sm text-slate-500 py-10 text-center">Nenhum protótipo com “${q}”.</p>`}

        <div class="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          ${list.map((p) => html`<${ProtoCard} key=${p.id} p=${p} onRename=${rename} onDuplicate=${duplicate} onDelete=${setToDelete} />`)}
        </div>
      </main>

      ${creating && html`<${Modal} title="Novo protótipo" onClose=${() => setCreating(false)}>
        <form onSubmit=${create}>
          <label class="block"><span class="text-xs font-medium text-slate-600">Nome do projeto</span>
            <input autoFocus class=${inputCls + " mt-1"} value=${newName} onInput=${(e) => setNewName(e.target.value)} placeholder="Ex.: Airbnb — Check-in pelo WhatsApp" /></label>
          <div class="flex justify-end gap-2 mt-5">
            <button type="button" class=${btnGhost} onClick=${() => setCreating(false)}>Cancelar</button>
            <button type="submit" class=${btnPrimary} disabled=${busy}>${busy && html`<${Spinner} size=${16} />`}Criar</button>
          </div>
        </form>
      <//>`}

      ${toDelete && html`<${Modal} title="Excluir protótipo?" onClose=${() => setToDelete(null)}>
        <p class="text-sm text-slate-600">“${toDelete.name}” será excluído permanentemente${toDelete.is_public ? " e o link compartilhado deixa de funcionar" : ""}.</p>
        <div class="flex justify-end gap-2 mt-5">
          <button class=${btnGhost} onClick=${() => setToDelete(null)}>Cancelar</button>
          <button class="inline-flex items-center rounded-lg px-4 py-2.5 text-sm font-medium bg-red-600 text-white hover:bg-red-700" onClick=${remove}>Excluir</button>
        </div>
      <//>`}
    </div>`;
  }

  // ---------------- compartilhar ----------------
  function ShareModal({ proto, onChange, onClose }) {
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);
    const url = shareUrl(proto.share_token);
    const toggle = async () => {
      setBusy(true);
      try { onChange(await DB.update(proto.id, { is_public: !proto.is_public })); }
      catch (e) { toast(e.message, "error"); }
      finally { setBusy(false); }
    };
    const copy = async () => {
      try { await navigator.clipboard.writeText(url); } catch { const t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    };
    return html`<${Modal} title="Compartilhar protótipo" onClose=${onClose}>
      <div class="flex items-start gap-3 rounded-xl bg-slate-50 p-3.5">
        <div class="flex-1">
          <p class="text-sm font-medium text-[#000050]">Link de visualização</p>
          <p class="text-xs text-slate-500 mt-0.5">Quem tiver o link vê o protótipo, sem precisar de login e sem poder editar.</p>
        </div>
        <button role="switch" aria-checked=${proto.is_public} disabled=${busy} onClick=${toggle}
          class=${"relative shrink-0 w-11 h-6 rounded-full transition " + (proto.is_public ? "bg-[#16D2B0]" : "bg-slate-300")}>
          <span class=${"absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all " + (proto.is_public ? "left-[22px]" : "left-0.5")}></span>
        </button>
      </div>
      ${proto.is_public
        ? html`<div class="flex gap-2 mt-4">
            <input readOnly value=${url} class=${inputCls + " text-xs text-slate-600"} onFocus=${(e) => e.target.select()} />
            <button onClick=${copy} class=${btnPrimary + " shrink-0"}>${copied ? html`${I.check} Copiado` : "Copiar"}</button>
          </div>
          <p class="text-xs text-slate-500 mt-2">O link mostra sempre a última versão salva. Desligue a chave para desativá-lo.</p>`
        : html`<p class="text-xs text-slate-500 mt-4">O link está desativado. Só você vê este protótipo.</p>`}
    <//>`;
  }

  // ---------------- editor ----------------
  function EditorPage({ id, user }) {
    const [proto, setProto] = useState(null); // linha do banco (sem data)
    const [initial, setInitial] = useState(null);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("saved"); // saved | dirty | saving | error
    const [savedAt, setSavedAt] = useState(null);
    const [sharing, setSharing] = useState(false);
    const latest = useRef(null);
    const savedJson = useRef(null);
    const timer = useRef(null);
    const inflight = useRef(null);
    const emptyAtLoad = useRef(false);

    useEffect(() => {
      let alive = true;
      DB.get(id).then((row) => {
        if (!alive) return;
        const { data, ...meta } = row;
        emptyAtLoad.current = !(data && data.screens && data.screens.length);
        setProto(meta);
        setInitial(data || {});
        setSavedAt(new Date(row.updated_at));
        document.title = `${row.name} — WPP Flow`;
      }).catch((e) => alive && setError(e.message));
      return () => { alive = false; clearTimeout(timer.current); document.title = "WPP Flow — Protótipos de Conversa"; };
    }, [id]);

    const save = useCallback(async () => {
      clearTimeout(timer.current);
      if (inflight.current) await inflight.current;
      const snap = latest.current;
      if (!snap) return;
      const json = JSON.stringify(snap);
      if (json === savedJson.current) { setStatus("saved"); return; }
      setStatus("saving");
      const p = DB.update(id, { data: snap })
        .then((row) => {
          savedJson.current = json;
          setProto((old) => ({ ...old, ...row }));
          setSavedAt(new Date());
          setStatus(JSON.stringify(latest.current) === json ? "saved" : "dirty");
        })
        .catch((e) => { setStatus("error"); toast("Não foi possível salvar: " + e.message, "error"); });
      inflight.current = p;
      await p;
      inflight.current = null;
    }, [id]);

    const onChange = useCallback((snap) => {
      latest.current = snap;
      if (savedJson.current === null) {
        // primeira leitura do editor: vira a referência de "salvo"
        savedJson.current = emptyAtLoad.current ? "" : JSON.stringify(snap);
        if (!emptyAtLoad.current) return;
      }
      if (JSON.stringify(snap) === savedJson.current) { setStatus((s) => (s === "dirty" ? "saved" : s)); return; }
      setStatus("dirty");
      clearTimeout(timer.current);
      timer.current = setTimeout(save, AUTOSAVE_MS);
    }, [save]);

    // Ctrl/Cmd+S e aviso ao fechar a aba com alterações pendentes
    useEffect(() => {
      const key = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } };
      const leave = (e) => { if (status === "dirty" || status === "saving") { e.preventDefault(); e.returnValue = ""; } };
      window.addEventListener("keydown", key);
      window.addEventListener("beforeunload", leave);
      return () => { window.removeEventListener("keydown", key); window.removeEventListener("beforeunload", leave); };
    }, [save, status]);

    const back = async (e) => { e.preventDefault(); if (status === "dirty") await save(); go("/"); };
    const rename = async (v) => {
      const name = v.trim();
      if (!name || name === proto.name) return;
      setProto((p) => ({ ...p, name }));
      document.title = `${name} — WPP Flow`;
      try { await DB.update(id, { name }); } catch (err) { toast(err.message, "error"); }
    };
    const openShare = async () => { if (status === "dirty") await save(); setSharing(true); };

    if (error) return html`<div class="min-h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p class="text-slate-600">${error}</p><a href="#/" class=${btnPrimary}>Voltar para Meus protótipos</a></div>`;
    if (!proto) return html`<div class="min-h-full flex items-center justify-center text-[#2F5BEA]"><${Spinner} size=${28} /></div>`;

    const statusEl = {
      saved: html`<span class="text-white/60">Salvo${savedAt ? " às " + clock(savedAt) : ""}</span>`,
      dirty: html`<span class="text-amber-200">Alterações não salvas</span>`,
      saving: html`<span class="text-white/80 inline-flex items-center gap-1.5"><${Spinner} size=${12} /> Salvando...</span>`,
      error: html`<button onClick=${save} class="text-red-200 underline">Erro ao salvar · tentar de novo</button>`,
    }[status];

    return html`<div class="min-h-full lg:h-full flex flex-col">
      <${LocalModeBanner} />
      <div class="bg-[#000050] text-white px-4 py-1.5 flex items-center gap-3 text-xs">
        <a href="#/" onClick=${back} class="inline-flex items-center gap-1 text-white/80 hover:text-white shrink-0">${I.back} Meus protótipos</a>
        <span class="text-white/25">|</span>
        <input key=${proto.name} defaultValue=${proto.name} title="Clique para renomear o projeto"
          class="bg-transparent font-medium text-sm text-white outline-none rounded px-1.5 py-0.5 hover:bg-white/10 focus:bg-white/15 min-w-0 w-full max-w-sm truncate"
          onBlur=${(e) => rename(e.target.value)} onKeyDown=${(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { e.target.value = proto.name; e.target.blur(); } }} />
        <span class="flex-1"></span>
        <span class="shrink-0 hidden sm:inline">${statusEl}</span>
      </div>
      <div class="flex-1 lg:min-h-0 flex flex-col">
        <${Editor} key=${id}
          initialProfile=${initial.profile || null}
          initialScreens=${initial.screens || null}
          initialBriefing=${initial.briefing || null}
          onChange=${onChange}
          onSave=${save}
          onShare=${openShare}
          saving=${status === "saving"} />
      </div>
      ${sharing && html`<${ShareModal} proto=${proto} onChange=${(row) => setProto((p) => ({ ...p, ...row }))} onClose=${() => setSharing(false)} />`}
    </div>`;
  }

  // ---------------- visualização compartilhada ----------------
  function SharedView({ token }) {
    const [row, setRow] = useState(undefined);
    useEffect(() => { DB.getShared(token).then(setRow).catch(() => setRow(null)); }, [token]);
    if (row === undefined) return html`<div class="min-h-full flex items-center justify-center text-[#2F5BEA]"><${Spinner} size=${28} /></div>`;
    if (!row) return html`<div class="min-h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
      <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white" style=${{ background: GRADIENT }}>${I.link}</div>
      <h1 class="font-semibold text-[#000050]">Link indisponível</h1>
      <p class="text-sm text-slate-500 max-w-xs">Este protótipo não existe mais ou o compartilhamento foi desativado por quem o criou.</p>
    </div>`;
    document.title = `${row.name} — WPP Flow`;
    const d = row.data || {};
    return html`<div class="min-h-full lg:h-full flex flex-col">
      <div class="bg-[#000050] text-white px-4 py-1.5 flex items-center gap-2 text-xs">
        <span class="rounded-full bg-white/15 px-2 py-0.5">Somente visualização</span>
        <span class="font-medium text-sm truncate">${row.name}</span>
        <span class="flex-1"></span>
        <a href="#/" class="text-white/70 hover:text-white shrink-0">Criar meus protótipos →</a>
      </div>
      <div class="flex-1 lg:min-h-0 flex flex-col">
        <${Editor} readOnly=${true} initialProfile=${d.profile || null} initialScreens=${d.screens || null} initialBriefing=${d.briefing || null} />
      </div>
    </div>`;
  }

  // ---------------- app ----------------
  function App() {
    const route = useRoute();
    const [user, setUser] = useState(undefined);
    const [recovery, setRecovery] = useState(false);

    useEffect(() => {
      DB.getUser().then((u) => setUser((cur) => (cur === undefined ? u : cur)));
      return DB.onAuthChange((event, u) => {
        if (event === "PASSWORD_RECOVERY") setRecovery(true);
        setUser(u);
      });
    }, []);

    let page;
    if (route.name === "shared") page = html`<${SharedView} token=${route.token} />`;
    else if (user === undefined) page = html`<div class="min-h-full flex items-center justify-center text-[#2F5BEA]"><${Spinner} size=${28} /></div>`;
    else if (recovery) page = html`<${AuthScreen} recovery=${true} onRecovered=${() => { setRecovery(false); go("/"); }} />`;
    else if (!user) page = html`<${AuthScreen} />`;
    else if (route.name === "editor") page = html`<${EditorPage} key=${route.id} id=${route.id} user=${user} />`;
    else page = html`<${Dashboard} user=${user} />`;

    return html`${page}<${Toasts} />`;
  }

  createRoot(document.getElementById("root")).render(html`<${App} />`);
})();
