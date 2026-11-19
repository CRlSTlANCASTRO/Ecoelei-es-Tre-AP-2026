/* ==========================================================
   Galeria — lógica (Vanilla JS)
   Depende do array global FOTOS definido em dados.js
   ========================================================== */
(function () {
  "use strict";

  // ---------- Referências do DOM ----------
  const $ = (id) => document.getElementById(id);
  const grade = $("grade"), filtros = $("filtros"), busca = $("busca");
  const contador = $("contador"), vazio = $("vazio"), btnIniciar = $("btn-iniciar");
  const lightbox = $("lightbox"), palco = $("palco"), lbImg = $("lb-img");
  const lbTitulo = $("lb-titulo"), lbMeta = $("lb-meta");
  const btnFechar = $("lb-fechar"), btnTela = $("lb-tela");
  const btnAnt = $("lb-anterior"), btnProx = $("lb-proxima");

  // ---------- Estado ----------
  const TODAS = "Todas";
  const TEMPO_OCIOSO = 2000;          // ms sem mexer o mouse para esconder controles
  const LIMITE_SWIPE = 50;            // px mínimos para contar como deslize
  let categoriaAtiva = TODAS;
  let termoBusca = "";
  let visiveis = [];                  // fotos atualmente filtradas
  let indice = 0;                     // posição em `visiveis` no lightbox
  let timerOcioso = null;
  let fechouPeloUsuarioNaTela = false; // evita fechar o lightbox ao alternar tela cheia com F
  const cachePreload = new Map();     // mantém as imagens pré-carregadas na memória

  const fotos = typeof FOTOS !== "undefined" ? FOTOS : [];

  // Remove acentos e caixa para busca tolerante ("coracao" acha "Coração")
  const normalizar = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const rotuloId = (f) => "#" + String(f.id).padStart(3, "0");

  // ---------- Filtros de categoria ----------
  function criarFiltros() {
    const categorias = [TODAS, ...new Set(fotos.map((f) => f.categoria))];
    categorias.forEach((cat) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.textContent = cat;
      b.setAttribute("aria-pressed", String(cat === categoriaAtiva));
      b.addEventListener("click", () => {
        categoriaAtiva = cat;
        filtros.querySelectorAll("button").forEach((x) =>
          x.setAttribute("aria-pressed", String(x === b)));
        aplicarFiltros();
      });
      filtros.appendChild(b);
    });
    // Com uma única categoria, os botões não agregam nada
    if (categorias.length <= 2) filtros.hidden = true;
  }

  // ---------- Grade ----------
  function aplicarFiltros() {
    const termo = normalizar(termoBusca.trim());
    visiveis = fotos.filter((f) =>
      (categoriaAtiva === TODAS || f.categoria === categoriaAtiva) &&
      (!termo || normalizar(f.titulo).includes(termo)));

    // DocumentFragment: uma única inserção no DOM, mais rápido para ~120 itens
    const frag = document.createDocumentFragment();
    visiveis.forEach((foto, i) => frag.appendChild(criarMiniatura(foto, i)));
    grade.replaceChildren(frag);

    contador.textContent = `${visiveis.length} ${visiveis.length === 1 ? "foto" : "fotos"}`;
    vazio.hidden = visiveis.length > 0;
    btnIniciar.disabled = visiveis.length === 0;
  }

  function criarMiniatura(foto, i) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "miniatura";
    btn.setAttribute("aria-label", `Abrir ${foto.titulo}`);

    const img = document.createElement("img");
    img.src = foto.arquivo;
    img.alt = foto.titulo;
    img.loading = "lazy";
    img.decoding = "async";

    const badge = document.createElement("span");
    badge.className = "miniatura__badge";
    badge.textContent = rotuloId(foto);

    btn.append(img, badge);
    btn.addEventListener("click", () => abrirLightbox(i));
    return btn;
  }

  // ---------- Pré-carregamento ----------
  function preCarregar(i) {
    if (i < 0 || i >= visiveis.length) return;
    const url = visiveis[i].arquivo;
    if (cachePreload.has(url)) return;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    cachePreload.set(url, img); // guarda a referência para o navegador manter em cache
  }

  // ---------- Lightbox ----------
  function abrirLightbox(i) {
    if (!visiveis.length) return;
    lightbox.hidden = false;
    document.body.classList.add("sem-rolagem");
    mostrarFoto(i);
    mostrarControles();
    entrarTelaCheia(); // melhor esforço: se falhar, o lightbox já cobre 100vw x 100vh
  }

  function fecharLightbox() {
    lightbox.hidden = true;
    document.body.classList.remove("sem-rolagem");
    clearTimeout(timerOcioso);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }

  function mostrarFoto(i) {
    indice = Math.max(0, Math.min(i, visiveis.length - 1));
    const foto = visiveis[indice];

    lbImg.classList.remove("visivel");
    lbImg.onload = () => lbImg.classList.add("visivel");
    lbImg.onerror = () => lbImg.classList.add("visivel");
    lbImg.src = foto.arquivo;
    lbImg.alt = foto.titulo;

    lbTitulo.textContent = foto.titulo;
    lbMeta.textContent = `${foto.categoria}  ·  ${indice + 1} / ${visiveis.length}`;
    btnAnt.disabled = indice === 0;
    btnProx.disabled = indice === visiveis.length - 1;

    // Pré-carrega vizinhas para a troca ser instantânea
    preCarregar(indice + 1);
    preCarregar(indice - 1);
  }

  const proxima = () => { if (indice < visiveis.length - 1) mostrarFoto(indice + 1); };
  const anterior = () => { if (indice > 0) mostrarFoto(indice - 1); };

  // ---------- Tela cheia ----------
  function entrarTelaCheia() {
    if (!document.fullscreenElement && lightbox.requestFullscreen) {
      lightbox.requestFullscreen().catch(() => {});
    }
  }

  function alternarTelaCheia() {
    if (document.fullscreenElement) {
      fechouPeloUsuarioNaTela = true; // sair da tela cheia aqui NÃO fecha o lightbox
      document.exitFullscreen().catch(() => {});
    } else {
      entrarTelaCheia();
    }
  }

  // Se o usuário sair da tela cheia com Esc, o lightbox fecha junto (um Esc só).
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement) {
      if (!lightbox.hidden && !fechouPeloUsuarioNaTela) fecharLightbox();
      fechouPeloUsuarioNaTela = false;
    }
  });

  // ---------- Controles que somem por inatividade ----------
  function mostrarControles() {
    lightbox.classList.remove("ocioso");
    clearTimeout(timerOcioso);
    timerOcioso = setTimeout(() => lightbox.classList.add("ocioso"), TEMPO_OCIOSO);
  }

  ["mousemove", "mousedown", "touchstart", "keydown"].forEach((ev) =>
    lightbox.addEventListener(ev, mostrarControles, { passive: true }));

  // ---------- Eventos ----------
  btnFechar.addEventListener("click", fecharLightbox);
  btnTela.addEventListener("click", alternarTelaCheia);
  btnProx.addEventListener("click", proxima);
  btnAnt.addEventListener("click", anterior);
  btnIniciar.addEventListener("click", () => abrirLightbox(0));

  busca.addEventListener("input", () => { termoBusca = busca.value; aplicarFiltros(); });

  // Atalhos de teclado
  document.addEventListener("keydown", (e) => {
    if (lightbox.hidden) return;
    switch (e.key) {
      case "ArrowRight":
      case " ":
        e.preventDefault(); proxima(); break;
      case "ArrowLeft":
        e.preventDefault(); anterior(); break;
      case "Escape":
        fecharLightbox(); break;
      case "f":
      case "F":
        e.preventDefault(); alternarTelaCheia(); break;
    }
  });

  // Swipe (celular/tablet): deslizar para a esquerda = próxima
  let toqueX = 0, toqueY = 0;
  palco.addEventListener("touchstart", (e) => {
    toqueX = e.changedTouches[0].clientX;
    toqueY = e.changedTouches[0].clientY;
  }, { passive: true });

  palco.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - toqueX;
    const dy = e.changedTouches[0].clientY - toqueY;
    if (Math.abs(dx) > LIMITE_SWIPE && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? proxima() : anterior();
    }
  }, { passive: true });

  // ---------- Inicialização ----------
  criarFiltros();
  aplicarFiltros();
})();
