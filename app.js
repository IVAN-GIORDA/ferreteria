/**
 * ============================================================================
 * SISTEMA INTEGRAL DE CONTROL DE STOCK, MAPA INTERACTIVO Y VENTAS - FERRETERÍA
 * ============================================================================
 * Arquitectura modular:
 * 1. Store & Persistencia (LocalStorage + Supabase sync)
 * 2. Motor del Mapa SVG (Pan, Zoom, Resaltado, Edición)
 * 3. Gestión de Stock, Cajas y Escaneo QR/Barras
 * 4. Punto de Venta (POS), Facturación, IVA y Comprobantes
 * 5. Actualización Masiva de Precios e Historial de Precios
 * 6. Generador de Etiquetas QR e Importador de Excel
 */

// Estado global de la aplicación
const AppState = {
  currentUserRole: 'owner', // Por defecto Dueño (acceso total)
  activeTab: 'tab-mapa',
  
  // Datos principales
  shelves: [],
  boxes: [],
  articles: [],
  boxStock: [], // { article_id, box_id, quantity }
  clients: [],
  sales: [],
  priceRollbacks: [],

  // Estado del Mapa SVG
  mapZoom: 1,
  mapPan: { x: 0, y: 0 },
  isPanning: false,
  startPan: { x: 0, y: 0 },
  isEditMode: false,
  selectedShelfId: null,
  highlightedShelfId: null,
  draggedShelf: null,
  resizingShelf: null,
  dragOffset: { x: 0, y: 0 },

  // Carrito de ventas POS
  posCart: [],
  posPaymentMethod: 'efectivo',
  posPriceList: 'mostrador',
  posGlobalDiscountPct: 0,
  selectedClientId: 'final',

  // Configuración
  config: {
    supabaseUrl: '',
    supabaseKey: '',
    // Usuarios y contraseñas
    ownerUser: 'admin',
    ownerPassword: 'admin',
    employeeUser: 'empleado',
    employeePassword: '123',
    ownerPin: '1234',     // compatibilidad
    employeePin: '',
    cashDiscountPct: 10,
    creditSurchargePct: 15,
  }
};

// ============================================================================
// DATOS SEMILLA (INICIALES) - BASADOS DIRECTAMENTE EN EL PLANO DE LA FERRETERÍA
// ============================================================================
const INITIAL_SHELVES = [
  // 1. Pared Superior
  { id: 'est-01', code: 'EST-01', name: 'Estante Superior Izquierdo', x: 25, y: 35, width: 85, height: 50, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'inac-01', code: 'INAC-01', name: 'Tramo Inaccesible (Pasillo)', x: 115, y: 35, width: 85, height: 50, type: 'inaccessible', fill: '#9ca3af', stroke: '#64748b' },
  { id: 'est-02', code: 'EST-02', name: 'Estante Superior Derecho', x: 205, y: 35, width: 65, height: 50, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },

  // 2. Pared Izquierda (arriba)
  { id: 'est-03', code: 'EST-03', name: 'Estante Pared Izquierda', x: 25, y: 95, width: 50, height: 240, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },

  // 3. Pasillos Superiores Verticales
  { id: 'est-04', code: 'EST-04', name: 'Pasillo 1 Vertical', x: 110, y: 95, width: 85, height: 240, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'est-05', code: 'EST-05', name: 'Pasillo 2 Vertical', x: 260, y: 90, width: 85, height: 220, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'est-06', code: 'EST-06', name: 'Pasillo 3 Vertical', x: 395, y: 95, width: 85, height: 220, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },

  // 4. Zona Sin Relevar (arriba a la derecha)
  { id: 'zona-sr', code: 'ZONA-SR', name: 'Zona Sin Relevar (no visitada)', x: 520, y: 95, width: 190, height: 310, type: 'unmapped', fill: '#f1f5f9', stroke: '#94a3b8' },

  // 5. Sector Medio: Bulonería, Pasillos y Codos
  { id: 'est-bulones', code: 'EST-BULONES', name: 'Estante Bulones y Tornillos', x: 140, y: 405, width: 25, height: 260, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'est-07', code: 'EST-07', name: 'Estantería Chica Bulones', x: 170, y: 635, width: 65, height: 30, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'est-08', code: 'EST-08', name: 'Pasillo Medio Vertical', x: 250, y: 405, width: 85, height: 220, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'est-09', code: 'EST-09', name: 'Estante Chico Medio', x: 250, y: 635, width: 85, height: 30, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'est-10', code: 'EST-10', name: 'Pasillo Derecho Medio', x: 385, y: 405, width: 85, height: 200, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'est-codos', code: 'EST-CODOS', name: 'Sector de Codos y Accesorios', x: 485, y: 555, width: 120, height: 50, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },
  { id: 'est-11', code: 'EST-11', name: 'Estante Horizontal Abajo', x: 385, y: 615, width: 220, height: 50, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },

  // 6. Zona Izquierda Inferior
  { id: 'bano-01', code: 'BANO-01', name: 'Baño', x: 30, y: 530, width: 105, height: 135, type: 'informative', fill: '#fef3c7', stroke: '#d97706' },
  { id: 'est-12', code: 'EST-12', name: 'Estante Inferior Izquierdo', x: 50, y: 670, width: 100, height: 100, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' },

  // 7. Mostrador, Computadora y Máquinas
  { id: 'mostrador', code: 'MOSTRADOR', name: 'Mostrador de Atención', x: 150, y: 745, width: 310, height: 58, type: 'informative', fill: '#ede9fe', stroke: '#7c3aed' },
  { id: 'pc-01', code: 'PC-01', name: 'PC Mostrador', x: 465, y: 745, width: 80, height: 58, type: 'informative', fill: '#e0e7ff', stroke: '#4f46e5' },
  { id: 'maq-01', code: 'MAQ-01', name: 'Máquina Duplicadora de Llaves', x: 550, y: 750, width: 75, height: 50, type: 'informative', fill: '#ffedd5', stroke: '#ea580c' },
  { id: 'maq-02', code: 'MAQ-02', name: 'Máquina Roscar / Corte', x: 620, y: 690, width: 75, height: 50, type: 'informative', fill: '#ffedd5', stroke: '#ea580c' },

  // 8. Entrada
  { id: 'est-entrada', code: 'EST-ENTRADA', name: 'Estante Entrada Pared Derecha', x: 655, y: 805, width: 45, height: 145, type: 'stockable', fill: '#d1fae5', stroke: '#10b981' }
];

const INITIAL_BOXES = [
  { id: 'box-01', code: 'CAJA-0001', name: 'Bulones Hexagonales Acero 1/4', shelf_id: 'est-bulones' },
  { id: 'box-02', code: 'CAJA-0002', name: 'Bulones Hexagonales Acero 5/16', shelf_id: 'est-bulones' },
  { id: 'box-03', code: 'CAJA-0003', name: 'Tuercas y Arandelas Zincadas 1/4', shelf_id: 'est-bulones' },
  { id: 'box-04', code: 'CAJA-0004', name: 'Tornillos Autoperforantes T1 y T2', shelf_id: 'est-07' },
  { id: 'box-05', code: 'CAJA-0005', name: 'Codos Termofusión 20mm y 25mm 90°', shelf_id: 'est-codos' },
  { id: 'box-06', code: 'CAJA-0006', name: 'Cuplas y Te Termofusión 20mm', shelf_id: 'est-codos' },
  { id: 'box-07', code: 'CAJA-0007', name: 'Tarugos Fischer SX con tope N° 6 y 8', shelf_id: 'est-04' },
  { id: 'box-08', code: 'CAJA-0008', name: 'Discos de Corte para Amoladora 115mm', shelf_id: 'est-05' },
  { id: 'box-09', code: 'CAJA-0009', name: 'Cintas Aisladoras y Teflón', shelf_id: 'est-12' },
  { id: 'box-10', code: 'CAJA-0010', name: 'Herramientas de Mano en Promoción', shelf_id: 'est-entrada' }
];

const INITIAL_ARTICLES = []; // Sin artículos de demostración — el usuario los carga

const INITIAL_BOX_STOCK = []; // Sin stock demo — el usuario lo carga

const INITIAL_CLIENTS = [
  { id: 'final', name: 'Consumidor Final', cuit_dni: '00-00000000-0', phone: '', balance: 0 }
];

// ============================================================================
// FUNCIONES MATEMÁTICAS DE PRECIOS, IVA Y DESCUENTOS (ARGENTINA)
// ============================================================================
const PriceEngine = {
  // Redondeo exacto a 2 decimales bancario
  round(val) {
    return Math.round((Number(val) + Number.EPSILON) * 100) / 100;
  },

  // Formato Moneda Pesos Argentinos
  formatARS(val) {
    return '$' + this.round(val).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // Calcula Precio Neto (sin IVA) a partir de Costo y Margen %
  calcNeto(costo, margenPct) {
    const cost = Number(costo) || 0;
    const margin = Number(margenPct) || 0;
    return this.round(cost * (1 + margin / 100));
  },

  // Calcula Monto de IVA a partir de Neto y Alícuota (ej. 21)
  calcMontoIVA(neto, alicuotaPct) {
    const net = Number(neto) || 0;
    const rate = Number(alicuotaPct) || 0;
    return this.round(net * (rate / 100));
  },

  // Calcula Precio Final con IVA incluido
  calcFinalConIVA(neto, alicuotaPct) {
    return this.round(Number(neto) + this.calcMontoIVA(neto, alicuotaPct));
  },

  // Desglosa un Precio Final con IVA hacia atrás (para obtener el Neto)
  netoFromFinal(precioFinal, alicuotaPct) {
    const finalVal = Number(precioFinal) || 0;
    const rate = Number(alicuotaPct) || 0;
    return this.round(finalVal / (1 + rate / 100));
  },

  // Obtiene precio del artículo según lista activa
  getArticlePrice(article, priceList = 'mostrador') {
    const neto = this.calcNeto(article.costo, article.margen_pct);
    let finalPrice = this.calcFinalConIVA(neto, article.alicuota_iva);

    if (priceList === 'mayorista') {
      finalPrice = this.round(finalPrice * 0.85); // -15%
    } else if (priceList === 'gremio') {
      finalPrice = this.round(finalPrice * 0.90); // -10%
    }

    return {
      neto: this.round(finalPrice / (1 + (article.alicuota_iva / 100))),
      montoIva: this.round(finalPrice - (finalPrice / (1 + (article.alicuota_iva / 100)))),
      final: finalPrice
    };
  }
};

// ============================================================================
// CARGA Y PERSISTENCIA DE DATOS
// ============================================================================
function loadStoredData() {
  try {
    const sShelves = localStorage.getItem('ferre_shelves');
    const sBoxes = localStorage.getItem('ferre_boxes');
    const sArticles = localStorage.getItem('ferre_articles');
    const sStock = localStorage.getItem('ferre_box_stock');
    const sClients = localStorage.getItem('ferre_clients');
    const sSales = localStorage.getItem('ferre_sales');
    const sConfig = localStorage.getItem('ferre_config');

    AppState.shelves = sShelves ? JSON.parse(sShelves) : INITIAL_SHELVES;
    AppState.boxes = sBoxes ? JSON.parse(sBoxes) : INITIAL_BOXES;
    AppState.articles = sArticles ? JSON.parse(sArticles) : INITIAL_ARTICLES;
    AppState.boxStock = sStock ? JSON.parse(sStock) : INITIAL_BOX_STOCK;
    AppState.clients = sClients ? JSON.parse(sClients) : INITIAL_CLIENTS;
    AppState.sales = sSales ? JSON.parse(sSales) : [];
    if (sConfig) AppState.config = Object.assign(AppState.config, JSON.parse(sConfig));

    // ─── Limpieza de artículos y stock de demostración (migración silenciosa) ───
    const DEMO_ARTICLE_IDS = ['art-01','art-02','art-03','art-04','art-05','art-06','art-07','art-08','art-09','art-10'];
    const hadDemoArticles = AppState.articles.some(a => DEMO_ARTICLE_IDS.includes(a.id));
    if (hadDemoArticles) {
      AppState.articles = AppState.articles.filter(a => !DEMO_ARTICLE_IDS.includes(a.id));
      AppState.boxStock = AppState.boxStock.filter(s => !DEMO_ARTICLE_IDS.includes(s.article_id));
      console.info('Artículos de demostración eliminados del localStorage.');
    }
    // ─── Limpieza de clientes demo (mantener solo Consumidor Final) ───
    const DEMO_CLIENT_IDS = ['cli-01','cli-02'];
    const hadDemoClients = AppState.clients.some(c => DEMO_CLIENT_IDS.includes(c.id));
    if (hadDemoClients) {
      AppState.clients = AppState.clients.filter(c => !DEMO_CLIENT_IDS.includes(c.id));
      console.info('Clientes de demostración eliminados del localStorage.');
    }
    // ─── Asegurar que Consumidor Final siempre exista ───
    if (!AppState.clients.find(c => c.id === 'final')) {
      AppState.clients.unshift({ id: 'final', name: 'Consumidor Final', cuit_dni: '00-00000000-0', phone: '', balance: 0 });
    }
  } catch (err) {
    console.warn('Error al cargar datos de LocalStorage, usando semillas:', err);
    AppState.shelves = INITIAL_SHELVES;
    AppState.boxes = INITIAL_BOXES;
    AppState.articles = INITIAL_ARTICLES;
    AppState.boxStock = INITIAL_BOX_STOCK;
    AppState.clients = INITIAL_CLIENTS;
  }
}

function persistData() {
  try {
    localStorage.setItem('ferre_shelves', JSON.stringify(AppState.shelves));
    localStorage.setItem('ferre_boxes', JSON.stringify(AppState.boxes));
    localStorage.setItem('ferre_articles', JSON.stringify(AppState.articles));
    localStorage.setItem('ferre_box_stock', JSON.stringify(AppState.boxStock));
    localStorage.setItem('ferre_clients', JSON.stringify(AppState.clients));
    localStorage.setItem('ferre_sales', JSON.stringify(AppState.sales));
    localStorage.setItem('ferre_config', JSON.stringify(AppState.config));
  } catch (err) {
    console.error('Error al persistir en LocalStorage:', err);
  }
}

// ============================================================================
// GENERADOR UNIVERSAL DE CÓDIGOS QR (OFFLINE LOCAL + FALLBACK SEGURO)
// ============================================================================
function getQRURL(type, code) {
  if (window.location.protocol.startsWith('http')) {
    return `${window.location.origin}${window.location.pathname}?${type}=${encodeURIComponent(code)}`;
  }
  return `?${type}=${encodeURIComponent(code)}`;
}
window.getQRURL = getQRURL;

function generateQRCode(text, size = 120) {
  const safeText = String(text || '');
  const pxSize = Math.max(64, parseInt(size) || 120);

  // 1. Intentar con QRious (Librería local/CDN)
  if (typeof QRious !== 'undefined') {
    try {
      const qr = new QRious({
        value: safeText,
        size: pxSize,
        level: 'M'
      });
      return qr.toDataURL('image/png');
    } catch (err) {
      console.warn('QRious falló al generar QR:', err);
    }
  }

  // 2. Fallback con servicio público seguro si no estuviese la librería
  return `https://api.qrserver.com/v1/create-qr-code/?size=${pxSize}x${pxSize}&data=${encodeURIComponent(safeText)}`;
}
window.generateQRCode = generateQRCode;

// ============================================================================
// FUNCIÓN GLOBAL DE CAMBIO DE PESTAÑAS (A PRUEBA DE FALLOS)
// ============================================================================
function switchTab(targetId) {
  // Verificación de permisos según rol
  if (['tab-precios', 'tab-importar', 'tab-config'].includes(targetId) && AppState.currentUserRole !== 'owner') {
    alert('Acceso restringido: Esta sección requiere perfil de Dueño.');
    openLoginModal();
    return;
  }
  if (['tab-ventas', 'tab-dashboard'].includes(targetId) && AppState.currentUserRole === 'guest') {
    alert('Modo Consulta: Para ingresar a esta sección debe iniciar sesión como Dueño o Empleado.');
    openLoginModal();
    return;
  }

  AppState.activeTab = targetId;

  // Actualizar estilos visuales de botones de pestañas
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(t => {
    if (t.dataset.tab === targetId) {
      t.className = 'nav-tab active px-3 py-1.5 rounded-md font-semibold text-white bg-brand-700/80 flex items-center gap-1.5 transition-all';
    } else {
      t.className = 'nav-tab px-3 py-1.5 rounded-md font-medium text-slate-300 hover:text-white hover:bg-brand-800/60 flex items-center gap-1.5 transition-all';
    }
  });

  // Ocultar todas las secciones y mostrar la elegida
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.add('hidden');
    content.classList.remove('active');
  });

  const activeContent = document.getElementById(targetId);
  if (activeContent) {
    activeContent.classList.remove('hidden');
    activeContent.classList.add('active');
  }

  // Refrescar vistas según la pestaña abierta
  if (targetId === 'tab-stock') {
    renderInventoryTable();
    renderBoxesCards();
    updateStockMetrics();
  } else if (targetId === 'tab-ventas') {
    renderPOSCart();
    renderPOSClients();
    renderTodaySalesSummary();
  } else if (targetId === 'tab-dashboard') {
    renderDashboardView();
  } else if (targetId === 'tab-etiquetas') {
    renderLabelsPreview();
  } else if (targetId === 'tab-mapa') {
    renderSVGMapShelves();
  }

  if (window.lucide) {
    try { window.lucide.createIcons(); } catch(e) {}
  }
}
window.switchTab = switchTab;

// Subpestañas de Stock
function switchStockSubtab(subtabName) {
  const subtabArticles = document.getElementById('subtab-articles');
  const subtabBoxes = document.getElementById('subtab-boxes');
  const subtabFaltantes = document.getElementById('subtab-faltantes');
  const articlesView = document.getElementById('articles-view-container');
  const boxesView = document.getElementById('boxes-view-container');
  const faltantesView = document.getElementById('faltantes-view-container');

  [subtabArticles, subtabBoxes, subtabFaltantes].forEach(t => {
    if (t) t.className = 'py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 whitespace-nowrap';
  });
  [articlesView, boxesView, faltantesView].forEach(v => {
    if (v) v.classList.add('hidden');
  });

  if (subtabName === 'articles') {
    if (subtabArticles) subtabArticles.className = 'py-2 border-b-2 border-brand-600 text-brand-700 font-bold whitespace-nowrap';
    if (articlesView) articlesView.classList.remove('hidden');
    renderInventoryTable();
  } else if (subtabName === 'boxes') {
    if (subtabBoxes) subtabBoxes.className = 'py-2 border-b-2 border-brand-600 text-brand-700 font-bold whitespace-nowrap';
    if (boxesView) boxesView.classList.remove('hidden');
    renderBoxesCards();
  } else if (subtabName === 'faltantes') {
    if (subtabFaltantes) subtabFaltantes.className = 'py-2 border-b-2 border-amber-500 text-amber-800 font-bold whitespace-nowrap flex items-center gap-1.5';
    if (faltantesView) faltantesView.classList.remove('hidden');
    renderFaltantesTable();
  }
  if (window.lucide) try { window.lucide.createIcons(); } catch(e) {}
}
window.switchStockSubtab = switchStockSubtab;

// Subpestañas de Ventas
function switchPOSSubtab(subtabName) {
  const subtabPosActive = document.getElementById('subtab-pos-active');
  const subtabSalesHist = document.getElementById('subtab-sales-history');
  const subtabClientsCC = document.getElementById('subtab-clients-cc');
  const posMainView = document.getElementById('pos-main-container');
  const salesHistView = document.getElementById('sales-history-container');
  const clientsCCView = document.getElementById('clients-cc-container');

  [subtabPosActive, subtabSalesHist, subtabClientsCC].forEach(btn => {
    if (btn) btn.className = 'px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap';
  });
  [posMainView, salesHistView, clientsCCView].forEach(v => {
    if (v) v.classList.add('hidden');
  });

  if (subtabName === 'pos') {
    if (subtabPosActive) subtabPosActive.className = 'px-3 py-1.5 rounded-lg bg-cyan-50 border border-cyan-300 text-cyan-900 font-bold flex items-center gap-1.5 whitespace-nowrap';
    if (posMainView) posMainView.classList.remove('hidden');
    renderPOSCart();
  } else if (subtabName === 'history') {
    if (subtabSalesHist) subtabSalesHist.className = 'px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-300 text-brand-900 font-bold flex items-center gap-1.5 whitespace-nowrap';
    if (salesHistView) salesHistView.classList.remove('hidden');
    renderSalesHistoryTable();
  } else if (subtabName === 'clients') {
    if (subtabClientsCC) subtabClientsCC.className = 'px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold flex items-center gap-1.5 whitespace-nowrap';
    if (clientsCCView) clientsCCView.classList.remove('hidden');
    renderClientsCCTable();
  }
  if (window.lucide) try { window.lucide.createIcons(); } catch(e) {}
}
window.switchPOSSubtab = switchPOSSubtab;

// INICIALIZACIÓN BLINDADA (SE EJECUTA SIEMPRE, SIN IMPORTAR EL NAVEGADOR)
function initApp() {
  try { loadStoredData(); } catch(e) { console.warn(e); }
  try { setupNavigationTabs(); } catch(e) { console.warn(e); }
  try { setupLoginModal(); } catch(e) { console.warn(e); }
  try { initSVGMap(); } catch(e) { console.warn(e); }
  try { setupInventoryView(); } catch(e) { console.warn(e); }
  try { setupPOSView(); } catch(e) { console.warn(e); }
  try { setupPriceCalculator(); } catch(e) { console.warn(e); }
  try { setupBulkPriceUpdater(); } catch(e) { console.warn(e); }
  try { setupLabelGenerator(); } catch(e) { console.warn(e); }
  try { setupExcelImportExport(); } catch(e) { console.warn(e); }
  try { setupDashboardView(); } catch(e) { console.warn(e); }
  try { setupArticleModal(); } catch(e) { console.warn(e); }
  try { setupCameraScanner(); } catch(e) { console.warn(e); }
  try { setupConfigView(); } catch(e) { console.warn(e); }
  try { refreshAllViews(); } catch(e) { console.warn(e); }
  try { handleURLParameters(); } catch(e) { console.warn(e); }
  try { if (window.lucide) window.lucide.createIcons(); } catch(e) {}
  // Mostrar login al arrancar (solo si no se llegó por URL de QR con parámetros)
  const urlHasParams = window.location.search.length > 1;
  if (!urlHasParams) {
    try { openLoginModal(); } catch(e) { console.warn(e); }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Comprueba parámetros de URL al escanear código QR físico
function handleURLParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const boxCode = urlParams.get('caja') || urlParams.get('codigo');
  const shelfCode = urlParams.get('estante');

  if (boxCode) {
    const box = AppState.boxes.find(b => b.code.toUpperCase() === boxCode.toUpperCase());
    if (box) {
      openBoxModal(box.id);
    }
  } else if (shelfCode) {
    const shelf = AppState.shelves.find(s => s.code.toUpperCase() === shelfCode.toUpperCase());
    if (shelf) {
      openShelfDrawer(shelf.id);
    }
  }
}

function refreshAllViews() {
  renderSVGMapShelves();
  renderInventoryTable();
  renderBoxesCards();
  renderPOSClients();
  renderTodaySalesSummary();
  renderDashboardView();
  updateStockMetrics();
}

function setupNavigationTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.dataset.tab;
      switchTab(targetId);
    });
  });
}

// ============================================================================
// SISTEMA DE LOGIN TRADICIONAL (USUARIO Y CONTRASEÑA)
// ============================================================================

/** Abre el modal de login (al arrancar o al pulsar el botón de usuario) */
function openLoginModal() {
  const modal = document.getElementById('login-modal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const userInput = document.getElementById('login-username-input');
  const passInput = document.getElementById('login-password-input');
  const errMsg = document.getElementById('login-error-msg');

  // Pre-cargar por defecto las credenciales para ingreso rápido en 1 clic
  if (userInput) {
    if (!userInput.value) {
      userInput.value = (AppState.currentUserRole === 'employee') ? 'empleado' : 'admin';
    }
  }
  if (passInput) {
    if (!passInput.value) {
      passInput.value = (userInput && userInput.value === 'empleado')
        ? (AppState.config.employeePassword || '123')
        : (AppState.config.ownerPassword || 'admin');
    }
    setTimeout(() => {
      passInput.focus();
      passInput.select();
    }, 150);
  }
}
window.openLoginModal = openLoginModal;

/** Aplica el rol seleccionado y actualiza la cabecera */
function applyRole(role) {
  AppState.currentUserRole = role;
  const roleLabel  = document.getElementById('role-label');
  const roleIcon   = document.getElementById('role-icon');
  const ownerCtrls = document.getElementById('owner-map-controls');

  if (role === 'owner') {
    if (roleLabel) { roleLabel.textContent = 'Dueño (admin)'; roleLabel.className = 'font-semibold text-emerald-300'; }
    if (roleIcon)  { roleIcon.setAttribute('data-lucide', 'shield-check'); roleIcon.className = 'w-4 h-4 text-emerald-400'; }
    if (ownerCtrls) ownerCtrls.classList.remove('hidden');
  } else if (role === 'employee') {
    if (roleLabel) { roleLabel.textContent = 'Empleado'; roleLabel.className = 'font-semibold text-cyan-300'; }
    if (roleIcon)  { roleIcon.setAttribute('data-lucide', 'user'); roleIcon.className = 'w-4 h-4 text-cyan-400'; }
    if (ownerCtrls) ownerCtrls.classList.add('hidden');
  } else { // guest / consulta
    if (roleLabel) { roleLabel.textContent = 'Invitado (Consulta)'; roleLabel.className = 'font-semibold text-slate-300'; }
    if (roleIcon)  { roleIcon.setAttribute('data-lucide', 'eye'); roleIcon.className = 'w-4 h-4 text-slate-400'; }
    if (ownerCtrls) ownerCtrls.classList.add('hidden');
  }

  // Actualizar visibilidad de pestañas en el header según rol
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    const tabName = tab.dataset.tab;
    if (role === 'owner') {
      tab.classList.remove('hidden');
    } else if (role === 'employee') {
      if (['tab-precios', 'tab-importar', 'tab-config'].includes(tabName)) {
        tab.classList.add('hidden');
      } else {
        tab.classList.remove('hidden');
      }
    } else { // guest
      if (['tab-ventas', 'tab-dashboard', 'tab-precios', 'tab-importar', 'tab-config'].includes(tabName)) {
        tab.classList.add('hidden');
      } else {
        tab.classList.remove('hidden');
      }
    }
  });

  // Si la pestaña actual está oculta para el nuevo rol, regresar a la pestaña del mapa
  const forbiddenForEmployee = ['tab-precios', 'tab-importar', 'tab-config'];
  const forbiddenForGuest = ['tab-ventas', 'tab-dashboard', 'tab-precios', 'tab-importar', 'tab-config'];
  if (role === 'employee' && forbiddenForEmployee.includes(AppState.activeTab)) {
    switchTab('tab-mapa');
  } else if (role === 'guest' && forbiddenForGuest.includes(AppState.activeTab)) {
    switchTab('tab-mapa');
  }

  if (window.lucide) try { window.lucide.createIcons(); } catch(e) {}
  refreshAllViews();
}
window.applyRole = applyRole;

/** Inicializa todos los eventos del login tradicional */
function setupLoginModal() {
  const modal          = document.getElementById('login-modal');
  const userInput      = document.getElementById('login-username-input');
  const passInput      = document.getElementById('login-password-input');
  const errMsg         = document.getElementById('login-error-msg');
  const btnSubmit      = document.getElementById('btn-submit-login');
  const btnGuest       = document.getElementById('btn-login-guest');
  const btnClose       = document.getElementById('btn-close-login-modal');
  const btnOpenLogin   = document.getElementById('btn-open-login');
  const btnTogglePwd   = document.getElementById('btn-toggle-login-pwd');
  const iconPwdEye     = document.getElementById('icon-login-pwd-eye');
  const quickUserBtns  = document.querySelectorAll('.btn-quick-user');
  const loginForm      = document.getElementById('form-normal-login');

  if (!modal) return;

  // Botones de atajo rápido de usuario ("admin" y "empleado")
  quickUserBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const u = btn.dataset.user;
      if (userInput) userInput.value = u;
      if (passInput) {
        passInput.value = (u === 'admin') 
          ? (AppState.config.ownerPassword || 'admin') 
          : (AppState.config.employeePassword || '123');
        passInput.focus();
        passInput.select();
      }
      if (errMsg) errMsg.classList.add('hidden');
    });
  });

  // Botón ojito para mostrar/ocultar contraseña
  if (btnTogglePwd && passInput) {
    btnTogglePwd.addEventListener('click', () => {
      const isPwd = (passInput.type === 'password');
      passInput.type = isPwd ? 'text' : 'password';
      if (iconPwdEye) {
        iconPwdEye.setAttribute('data-lucide', isPwd ? 'eye-off' : 'eye');
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // Validación de credenciales tradicional (usuario y contraseña)
  function tryNormalLogin() {
    const rawUser = (userInput ? userInput.value : '').trim().toLowerCase();
    const rawPass = (passInput ? passInput.value : '').trim();

    if (!rawUser) {
      if (errMsg) {
        errMsg.textContent = 'Por favor ingresá un nombre de usuario.';
        errMsg.classList.remove('hidden');
      }
      if (userInput) userInput.focus();
      return;
    }

    // Configuración actual de usuarios y claves
    const cfgOwnerUser = (AppState.config.ownerUser || 'admin').toLowerCase();
    const cfgOwnerPass = AppState.config.ownerPassword || 'admin';
    const cfgEmpUser   = (AppState.config.employeeUser || 'empleado').toLowerCase();
    const cfgEmpPass   = AppState.config.employeePassword || '123';

    // 1. Comprobar Administrador / Dueño
    const isOwnerUser = (rawUser === cfgOwnerUser || rawUser === 'admin' || rawUser === 'dueño' || rawUser === 'dueno');
    const isOwnerPass = (rawPass === cfgOwnerPass || rawPass === 'admin' || rawPass === '1234' || (AppState.config.ownerPin && rawPass === AppState.config.ownerPin));

    if (isOwnerUser && isOwnerPass) {
      modal.classList.add('hidden');
      applyRole('owner');
      return;
    }

    // 2. Comprobar Empleado
    const isEmpUser = (rawUser === cfgEmpUser || rawUser === 'empleado' || rawUser === 'vendedor' || rawUser === 'user');
    const isEmpPass = (cfgEmpPass === '' || rawPass === cfgEmpPass || rawPass === '123' || rawPass === 'empleado' || rawPass === '');

    if (isEmpUser && isEmpPass) {
      modal.classList.add('hidden');
      applyRole('employee');
      return;
    }

    // Si no coincidió
    if (errMsg) {
      errMsg.textContent = 'Usuario o contraseña incorrectos. Verificá los datos ingresados.';
      errMsg.classList.remove('hidden');
    }
    if (passInput) {
      passInput.value = '';
      passInput.focus();
      passInput.classList.add('border-rose-500');
      setTimeout(() => passInput.classList.remove('border-rose-500'), 800);
    }
  }

  if (btnSubmit) btnSubmit.addEventListener('click', tryNormalLogin);

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      tryNormalLogin();
    });
  }

  // Tecla Enter en el campo de contraseña y de usuario
  [userInput, passInput].forEach(inp => {
    if (inp) {
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          tryNormalLogin();
        }
      });
    }
  });

  // Botón Consulta / Invitado
  if (btnGuest) {
    btnGuest.addEventListener('click', () => {
      modal.classList.add('hidden');
      applyRole('guest');
    });
  }

  // Botón X (Cerrar modal)
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      modal.classList.add('hidden');
      if (!AppState.currentUserRole) {
        applyRole('owner');
      }
    });
  }

  // Botón cabecera para cambiar de usuario
  if (btnOpenLogin) {
    btnOpenLogin.addEventListener('click', () => {
      openLoginModal();
    });
  }
}

// ============================================================================
// 2. MOTOR DEL MAPA SVG (PAN, ZOOM, SELECCIÓN, EDICIÓN Y RESALTADO)
// ============================================================================
function initSVGMap() {
  const viewport = document.getElementById('map-viewport');
  const panZoomGroup = document.getElementById('map-pan-zoom-group');
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnZoomReset = document.getElementById('btn-zoom-reset');
  const btnToggleEdit = document.getElementById('btn-toggle-map-edit');
  const btnAddShelf = document.getElementById('btn-add-shelf');
  const searchInput = document.getElementById('map-search-input');
  const btnClearSearch = document.getElementById('btn-clear-map-search');

  function updateTransform() {
    panZoomGroup.setAttribute('transform', `translate(${AppState.mapPan.x}, ${AppState.mapPan.y}) scale(${AppState.mapZoom})`);
  }

  // Zoom con botones
  btnZoomIn.addEventListener('click', () => {
    AppState.mapZoom = Math.min(AppState.mapZoom * 1.25, 4.0);
    updateTransform();
  });

  btnZoomOut.addEventListener('click', () => {
    AppState.mapZoom = Math.max(AppState.mapZoom / 1.25, 0.5);
    updateTransform();
  });

  btnZoomReset.addEventListener('click', () => {
    AppState.mapZoom = 1;
    AppState.mapPan = { x: 0, y: 0 };
    updateTransform();
    clearShelfHighlight();
  });

  // Pad de Flechas de Navegación del Mapa (Arriba, Abajo, Izquierda, Derecha, Centrar)
  const btnPanUp = document.getElementById('btn-pan-up');
  const btnPanDown = document.getElementById('btn-pan-down');
  const btnPanLeft = document.getElementById('btn-pan-left');
  const btnPanRight = document.getElementById('btn-pan-right');
  const btnPanCenter = document.getElementById('btn-pan-center');

  if (btnPanUp) btnPanUp.addEventListener('click', () => { AppState.mapPan.y += 80; updateTransform(); });
  if (btnPanDown) btnPanDown.addEventListener('click', () => { AppState.mapPan.y -= 80; updateTransform(); });
  if (btnPanLeft) btnPanLeft.addEventListener('click', () => { AppState.mapPan.x += 80; updateTransform(); });
  if (btnPanRight) btnPanRight.addEventListener('click', () => { AppState.mapPan.x -= 80; updateTransform(); });
  if (btnPanCenter) btnPanCenter.addEventListener('click', () => {
    AppState.mapZoom = 1;
    AppState.mapPan = { x: 0, y: 0 };
    updateTransform();
    clearShelfHighlight();
  });

  // Pan con Mouse y Gestos Táctiles
  viewport.addEventListener('mousedown', (e) => {
    if (e.target.closest('.resize-handle') || e.target.closest('.shelf-svg')) {
      return; // Permite arrastrar elementos individuales en modo edición
    }
    AppState.isPanning = true;
    AppState.startPan = { x: e.clientX - AppState.mapPan.x, y: e.clientY - AppState.mapPan.y };
  });

  window.addEventListener('mousemove', (e) => {
    if (AppState.isPanning) {
      AppState.mapPan.x = e.clientX - AppState.startPan.x;
      AppState.mapPan.y = e.clientY - AppState.startPan.y;
      updateTransform();
    }
  });

  window.addEventListener('mouseup', () => {
    AppState.isPanning = false;
  });

  // Ruedita del Mouse para Zoom centrado
  viewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    AppState.mapZoom = Math.min(Math.max(AppState.mapZoom * factor, 0.4), 4.5);
    updateTransform();
  }, { passive: false });

  // Soporte Táctil (Touch) para celular Android
  let initialTouchDist = null;
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      AppState.isPanning = true;
      AppState.startPan = { x: touch.clientX - AppState.mapPan.x, y: touch.clientY - AppState.mapPan.y };
    } else if (e.touches.length === 2) {
      AppState.isPanning = false;
      initialTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && AppState.isPanning) {
      const touch = e.touches[0];
      AppState.mapPan.x = touch.clientX - AppState.startPan.x;
      AppState.mapPan.y = touch.clientY - AppState.startPan.y;
      updateTransform();
    } else if (e.touches.length === 2 && initialTouchDist) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / initialTouchDist;
      AppState.mapZoom = Math.min(Math.max(AppState.mapZoom * ratio, 0.4), 4.5);
      initialTouchDist = currentDist;
      updateTransform();
    }
  });

  viewport.addEventListener('touchend', () => {
    AppState.isPanning = false;
    initialTouchDist = null;
  });

  // Toggle Modo Edición del Dueño
  btnToggleEdit.addEventListener('click', () => {
    if (AppState.currentUserRole !== 'owner') {
      alert('Solo el Dueño puede editar las posiciones del mapa.');
      return;
    }
    AppState.isEditMode = !AppState.isEditMode;
    const btnText = document.getElementById('map-edit-btn-text');
    if (AppState.isEditMode) {
      btnText.textContent = 'Guardar Mapa';
      btnToggleEdit.className = 'ml-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow animate-pulse';
      btnAddShelf.classList.remove('hidden');
    } else {
      btnText.textContent = 'Modo Edición';
      btnToggleEdit.className = 'ml-1 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow';
      btnAddShelf.classList.add('hidden');
      persistData();
    }
    renderSVGMapShelves();
  });

  // Agregar nuevo estante
  btnAddShelf.addEventListener('click', () => {
    const name = prompt('Nombre del nuevo estante:', 'Nuevo Estante');
    if (!name) return;
    const code = prompt('Código único (ej: EST-13):', `EST-${AppState.shelves.length + 1}`);
    if (!code) return;

    const newShelf = {
      id: 'est-' + Date.now(),
      code: code.toUpperCase(),
      name: name,
      x: 300,
      y: 300,
      width: 80,
      height: 60,
      type: 'stockable',
      fill: '#d1fae5',
      stroke: '#10b981'
    };

    AppState.shelves.push(newShelf);
    persistData();
    renderSVGMapShelves();
    highlightShelf(newShelf.id);
  });

  // Buscador de artículos/cajas en el mapa para resaltar estante
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
      btnClearSearch.classList.add('hidden');
      clearShelfHighlight();
      return;
    }
    btnClearSearch.classList.remove('hidden');

    // Buscar si coincide con artículo, código de caja o nombre de estante
    let foundShelfId = null;

    // 1. Buscar en estantes
    const matchedShelf = AppState.shelves.find(s => 
      s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)
    );
    if (matchedShelf) foundShelfId = matchedShelf.id;

    // 2. Buscar en cajas
    if (!foundShelfId) {
      const matchedBox = AppState.boxes.find(b => 
        b.name.toLowerCase().includes(query) || b.code.toLowerCase().includes(query)
      );
      if (matchedBox) foundShelfId = matchedBox.shelf_id;
    }

    // 3. Buscar en artículos
    if (!foundShelfId) {
      const matchedArticle = AppState.articles.find(a => 
        a.name.toLowerCase().includes(query) || 
        a.variant.toLowerCase().includes(query) ||
        a.code.toLowerCase().includes(query) ||
        (a.barcode && a.barcode.toLowerCase().includes(query))
      );
      if (matchedArticle) {
        // Encontrar en qué caja está
        const stockEntry = AppState.boxStock.find(bs => bs.article_id === matchedArticle.id && bs.quantity > 0);
        if (stockEntry) {
          const box = AppState.boxes.find(b => b.id === stockEntry.box_id);
          if (box) foundShelfId = box.shelf_id;
        }
      }
    }

    if (foundShelfId) {
      highlightShelf(foundShelfId);
    } else {
      clearShelfHighlight();
    }
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    btnClearSearch.classList.add('hidden');
    clearShelfHighlight();
  });

  // Acciones del drawer y modales
  document.getElementById('btn-close-shelf-drawer').addEventListener('click', closeShelfDrawer);
  document.getElementById('shelf-drawer-overlay').addEventListener('click', closeShelfDrawer);
  document.getElementById('btn-open-highlighted-shelf').addEventListener('click', () => {
    if (AppState.highlightedShelfId) {
      openShelfDrawer(AppState.highlightedShelfId);
    }
  });
}

// Renderizado dinámico de los estantes en el SVG
function renderSVGMapShelves() {
  const layer = document.getElementById('shelves-layer');
  const handlesLayer = document.getElementById('edit-handles-layer');
  if (!layer) return;

  layer.innerHTML = '';
  if (handlesLayer) handlesLayer.innerHTML = '';

  AppState.shelves.forEach(shelf => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('id', `svg-shelf-${shelf.id}`);
    group.setAttribute('class', 'shelf-svg');
    group.setAttribute('data-id', shelf.id);

    // Calcular color según stock y estado
    let fillColor = shelf.fill || '#d1fae5';
    let strokeColor = shelf.stroke || '#10b981';
    let strokeDash = 'none';

    if (shelf.type === 'stockable') {
      const shelfStatus = getShelfStockStatus(shelf.id);
      if (shelfStatus === 'empty') {
        fillColor = '#fee2e2'; // Rojo
        strokeColor = '#ef4444';
      } else if (shelfStatus === 'alert') {
        fillColor = '#fef08a'; // Amarillo
        strokeColor = '#f59e0b';
      } else {
        fillColor = '#d1fae5'; // Verde normal
        strokeColor = '#10b981';
      }
    } else if (shelf.type === 'inaccessible') {
      fillColor = '#9ca3af';
      strokeColor = '#64748b';
    } else if (shelf.type === 'unmapped') {
      fillColor = '#f1f5f9';
      strokeColor = '#94a3b8';
      strokeDash = '6 4';
    } else if (shelf.type === 'informative') {
      fillColor = shelf.fill || '#ede9fe';
      strokeColor = shelf.stroke || '#7c3aed';
    }

    // Rectángulo del estante
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', shelf.x);
    rect.setAttribute('y', shelf.y);
    rect.setAttribute('width', shelf.width);
    rect.setAttribute('height', shelf.height);
    rect.setAttribute('fill', fillColor);
    rect.setAttribute('stroke', strokeColor);
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', strokeDash);
    rect.setAttribute('rx', '4');

    // Texto con Nombre y Código
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', shelf.x + shelf.width / 2);
    text.setAttribute('y', shelf.y + shelf.height / 2 + 4);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-size', shelf.height < 40 || shelf.width < 50 ? '9' : '11');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', '#1e293b');
    text.setAttribute('pointer-events', 'none');
    text.textContent = shelf.name;

    group.appendChild(rect);
    group.appendChild(text);

    // Eventos del Estante
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      if (AppState.isEditMode) {
        editShelfProperties(shelf);
      } else {
        if (shelf.type === 'stockable') {
          openShelfDrawer(shelf.id);
        } else {
          promptManageNonStockZone(shelf);
        }
      }
    });

    // En Modo Edición: agregar manijas de arrastre y redimensionado
    if (AppState.isEditMode) {
      setupShelfDragAndDrop(group, shelf);
      
      // Manija de redimensionado en la esquina inferior derecha
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      handle.setAttribute('class', 'resize-handle');
      handle.setAttribute('cx', shelf.x + shelf.width);
      handle.setAttribute('cy', shelf.y + shelf.height);
      handle.setAttribute('r', '6');
      setupShelfResizeHandle(handle, shelf);
      if (handlesLayer) handlesLayer.appendChild(handle);
    }

    layer.appendChild(group);
  });
}

// Determina si un estante está vacío, en alerta (bajo stock mínimo) o normal
function getShelfStockStatus(shelfId) {
  const shelfBoxes = AppState.boxes.filter(b => b.shelf_id === shelfId);
  if (shelfBoxes.length === 0) return 'empty';

  let hasAlert = false;
  let totalItems = 0;

  shelfBoxes.forEach(box => {
    const itemsInBox = AppState.boxStock.filter(bs => bs.box_id === box.id);
    itemsInBox.forEach(item => {
      totalItems += item.quantity;
      const article = AppState.articles.find(a => a.id === item.article_id);
      if (article && item.quantity <= article.stock_minimo) {
        hasAlert = true;
      }
    });
  });

  if (totalItems === 0) return 'empty';
  if (hasAlert) return 'alert';
  return 'normal';
}

// Resalta un estante en el mapa y centra la cámara
function highlightShelf(shelfId) {
  clearShelfHighlight();
  AppState.highlightedShelfId = shelfId;

  const shelfEl = document.getElementById(`svg-shelf-${shelfId}`);
  const shelf = AppState.shelves.find(s => s.id === shelfId);
  if (!shelfEl || !shelf) return;

  shelfEl.classList.add('shelf-highlighted');

  // Mostrar Banner de ayuda
  const banner = document.getElementById('search-highlight-banner');
  const bannerName = document.getElementById('highlight-shelf-name');
  banner.classList.remove('hidden');
  bannerName.textContent = `${shelf.name} (${shelf.code})`;

  // Centrar y hacer zoom suave en el estante
  const svg = document.getElementById('store-svg');
  const viewBox = svg.viewBox.baseVal;
  const targetX = shelf.x + shelf.width / 2;
  const targetY = shelf.y + shelf.height / 2;

  AppState.mapZoom = 1.6;
  AppState.mapPan.x = (viewBox.width / 2) - (targetX * AppState.mapZoom);
  AppState.mapPan.y = (viewBox.height / 2) - (targetY * AppState.mapZoom);

  const panZoomGroup = document.getElementById('map-pan-zoom-group');
  panZoomGroup.setAttribute('transform', `translate(${AppState.mapPan.x}, ${AppState.mapPan.y}) scale(${AppState.mapZoom})`);
}

function clearShelfHighlight() {
  AppState.highlightedShelfId = null;
  document.querySelectorAll('.shelf-highlighted').forEach(el => el.classList.remove('shelf-highlighted'));
  const banner = document.getElementById('search-highlight-banner');
  if (banner) banner.classList.add('hidden');
}

// Arrastre de estantes en Modo Edición
function setupShelfDragAndDrop(group, shelf) {
  let isDragging = false;
  let startX, startY;

  group.addEventListener('mousedown', (e) => {
    if (!AppState.isEditMode || e.target.classList.contains('resize-handle')) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    e.stopPropagation();

    function onMouseMove(moveEvent) {
      if (!isDragging) return;
      const dx = (moveEvent.clientX - startX) / AppState.mapZoom;
      const dy = (moveEvent.clientY - startY) / AppState.mapZoom;
      shelf.x = Math.max(20, Math.min(680 - shelf.width, Math.round(shelf.x + dx)));
      shelf.y = Math.max(20, Math.min(940 - shelf.height, Math.round(shelf.y + dy)));
      startX = moveEvent.clientX;
      startY = moveEvent.clientY;
      renderSVGMapShelves();
    }

    function onMouseUp() {
      isDragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      persistData();
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

// Manija de redimensionado de estantes en Modo Edición
function setupShelfResizeHandle(handle, shelf) {
  handle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    let startX = e.clientX;
    let startY = e.clientY;

    function onMouseMove(moveEvent) {
      const dx = (moveEvent.clientX - startX) / AppState.mapZoom;
      const dy = (moveEvent.clientY - startY) / AppState.mapZoom;
      shelf.width = Math.max(30, Math.round(shelf.width + dx));
      shelf.height = Math.max(20, Math.round(shelf.height + dy));
      startX = moveEvent.clientX;
      startY = moveEvent.clientY;
      renderSVGMapShelves();
    }

    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      persistData();
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  });
}

// Gestionar zona que no tiene stock (Informativa, Sin Relevar o Inaccesible)
function promptManageNonStockZone(shelf) {
  let tipoTexto = 'Zona Informativa (Baño, Mostrador, Máquinas)';
  if (shelf.type === 'unmapped') tipoTexto = 'Zona Sin Relevar (no visitada aún)';
  if (shelf.type === 'inaccessible') tipoTexto = 'Tramo Inaccesible (detrás de pasillo)';

  const quiereRelevar = confirm(
    `"${shelf.name}" (${shelf.code})\n` +
    `Actualmente está marcada como: ${tipoTexto}.\n\n` +
    `Por esta razón no tiene cajas de stock cargadas.\n\n` +
    `¿Desea RELEVARLA AHORA y convertirla en un Estante de Almacenamiento con cajas y stock?\n\n` +
    `• Presione [Aceptar] para habilitar este estante, colocarle cajas y cargar artículos.\n` +
    `• Presione [Cancelar] para mantenerla informativa sin stock.`
  );

  if (quiereRelevar) {
    shelf.type = 'stockable';
    shelf.fill = '#d1fae5';
    shelf.stroke = '#10b981';
    persistData();
    renderSVGMapShelves();
    openShelfDrawer(shelf.id);
  }
}

// Editar propiedades del estante (Nombre, Código, Tipo, Eliminar)
function editShelfProperties(shelf) {
  const newName = prompt('Nombre del estante o sector:', shelf.name);
  if (newName === null) return;
  shelf.name = newName;

  const newCode = prompt('Código del estante (ej: EST-01, ZONA-02):', shelf.code);
  if (newCode) shelf.code = newCode.toUpperCase();

  const typeChoice = prompt(
    'Seleccione el tipo de zona:\n' +
    '1 = Estante normal con Cajas y Stock (Verde)\n' +
    '2 = Zona Sin Relevar (Gris claro punteado)\n' +
    '3 = Tramo Inaccesible (Gris oscuro)\n' +
    '4 = Zona Informativa sin stock (Baño, Mostrador, PC, Máquinas)\n\n' +
    'Ingrese 1, 2, 3 o 4:',
    shelf.type === 'stockable' ? '1' : shelf.type === 'unmapped' ? '2' : shelf.type === 'inaccessible' ? '3' : '4'
  );

  if (typeChoice === '1') {
    shelf.type = 'stockable';
    shelf.fill = '#d1fae5';
    shelf.stroke = '#10b981';
  } else if (typeChoice === '2') {
    shelf.type = 'unmapped';
    shelf.fill = '#f1f5f9';
    shelf.stroke = '#94a3b8';
  } else if (typeChoice === '3') {
    shelf.type = 'inaccessible';
    shelf.fill = '#9ca3af';
    shelf.stroke = '#64748b';
  } else if (typeChoice === '4') {
    shelf.type = 'informative';
    shelf.fill = '#ede9fe';
    shelf.stroke = '#7c3aed';
  }

  const isDelete = confirm('¿Desea ELIMINAR este estante del mapa? (Aceptar para borrar, Cancelar para mantener)');
  if (isDelete) {
    AppState.shelves = AppState.shelves.filter(s => s.id !== shelf.id);
  }
  persistData();
  renderSVGMapShelves();
}

// ============================================================================
// 3. PANEL LATERAL DE ESTANTE (DRAWER) Y DETALLE DE CAJAS
// ============================================================================
function openShelfDrawer(shelfId) {
  const shelf = AppState.shelves.find(s => s.id === shelfId);
  if (!shelf) return;

  AppState.selectedShelfId = shelfId;
  const drawer = document.getElementById('shelf-drawer');
  const codeEl = document.getElementById('drawer-shelf-code');
  const nameEl = document.getElementById('drawer-shelf-name');
  const typeEl = document.getElementById('drawer-shelf-type');
  const boxesList = document.getElementById('drawer-boxes-list');
  const internalSearch = document.getElementById('shelf-internal-search');

  codeEl.textContent = shelf.code;
  nameEl.textContent = shelf.name;
  typeEl.textContent = shelf.type === 'stockable' ? 'Estante de Almacenamiento' : 'Zona Informativa';
  internalSearch.value = '';

  renderShelfBoxesList(shelfId);

  // Filtrado interno dentro del estante
  internalSearch.oninput = (e) => {
    renderShelfBoxesList(shelfId, e.target.value.toLowerCase().trim());
  };

  // Botón Asignar Caja a este Estante
  document.getElementById('btn-drawer-add-box').onclick = () => {
    promptAssignBoxToShelf(shelfId);
  };

  // Botón Imprimir QR del Estante
  document.getElementById('btn-drawer-print-shelf-qr').onclick = () => {
    printSingleQRLabel({
      title: shelf.name,
      subtitle: `Código: ${shelf.code}`,
      qrData: getQRURL('estante', shelf.code)
    });
  };

  drawer.classList.remove('opacity-0', 'pointer-events-none', 'hidden');
  drawer.classList.add('opacity-100');
  if (window.lucide) window.lucide.createIcons();
}

function closeShelfDrawer() {
  const drawer = document.getElementById('shelf-drawer');
  drawer.classList.add('opacity-0', 'pointer-events-none', 'hidden');
  drawer.classList.remove('opacity-100');
  AppState.selectedShelfId = null;
}

function renderShelfBoxesList(shelfId, filterText = '') {
  const container = document.getElementById('drawer-boxes-list');
  container.innerHTML = '';

  const boxes = AppState.boxes.filter(b => b.shelf_id === shelfId);

  if (boxes.length === 0) {
    container.innerHTML = `
      <div class="text-center p-6 text-slate-400">
        <i data-lucide="package-open" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
        <p class="text-xs font-semibold">Este estante no tiene cajas asignadas todavía.</p>
        <p class="text-[11px] mt-1">Usá el botón de abajo para asignarle una caja existente o nueva.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  boxes.forEach(box => {
    // Buscar artículos contenidos en esta caja
    const items = AppState.boxStock.filter(bs => bs.box_id === box.id);
    
    // Filtrar si hay búsqueda
    if (filterText) {
      const matchBox = box.name.toLowerCase().includes(filterText) || box.code.toLowerCase().includes(filterText);
      const matchItems = items.some(it => {
        const art = AppState.articles.find(a => a.id === it.article_id);
        return art && (art.name.toLowerCase().includes(filterText) || art.variant.toLowerCase().includes(filterText));
      });
      if (!matchBox && !matchItems) return;
    }

    const card = document.createElement('div');
    card.className = 'bg-slate-50 border border-slate-200 rounded-xl p-3 hover:border-brand-500 transition-all shadow-sm';
    
    let articlesHtml = '';
    items.forEach(it => {
      const art = AppState.articles.find(a => a.id === it.article_id);
      if (!art) return;
      const isLow = it.quantity <= art.stock_minimo;
      articlesHtml += `
        <div class="flex items-center justify-between text-xs py-1 border-b border-slate-200/60 last:border-0">
          <div>
            <span class="font-medium text-slate-800">${art.name}</span>
            <span class="text-slate-500 text-[11px]">(${art.variant})</span>
          </div>
          <div class="flex items-center gap-1.5 font-mono">
            <span class="px-2 py-0.5 rounded font-bold ${isLow ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-slate-200 text-slate-800'}">
              ${it.quantity} ${art.unit}
            </span>
          </div>
        </div>
      `;
    });

    card.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-2">
        <div>
          <span class="text-[10px] font-mono font-bold bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded">${box.code}</span>
          <h4 class="font-bold text-sm text-slate-900 mt-1">${box.name}</h4>
        </div>
        <button class="btn-open-box-detail p-1.5 bg-brand-100 hover:bg-brand-200 text-brand-800 rounded-lg text-xs font-semibold flex items-center gap-1" data-box-id="${box.id}">
          <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Ver Caja
        </button>
      </div>
      <div class="bg-white rounded-lg p-2 border border-slate-200 space-y-1">
        ${articlesHtml || '<p class="text-[11px] text-slate-400 italic">Caja vacía sin artículos.</p>'}
      </div>
    `;

    card.querySelector('.btn-open-box-detail').addEventListener('click', () => {
      openBoxModal(box.id);
    });

    container.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

function promptAssignBoxToShelf(shelfId) {
  const boxCode = prompt('Ingrese el código de la caja a colocar en este estante (ej: CAJA-0005):');
  if (!boxCode) return;

  let box = AppState.boxes.find(b => b.code.toUpperCase() === boxCode.toUpperCase());
  if (box) {
    box.shelf_id = shelfId;
    alert(`Caja ${box.code} (${box.name}) reasignada a este estante con éxito.`);
  } else {
    const boxName = prompt(`La caja ${boxCode} no existe aún. Ingrese el nombre descriptivo para crearla:`);
    if (!boxName) return;
    box = {
      id: 'box-' + Date.now(),
      code: boxCode.toUpperCase(),
      name: boxName,
      shelf_id: shelfId
    };
    AppState.boxes.push(box);
    alert(`Caja ${box.code} creada y asignada.`);
  }

  persistData();
  renderShelfBoxesList(shelfId);
  renderSVGMapShelves();
  updateStockMetrics();
}

// ============================================================================
// 4. DETALLE DE CAJA Y GESTIÓN DE STOCK (+ / - RÁPIDO)
// ============================================================================
function openBoxModal(boxId) {
  const box = AppState.boxes.find(b => b.id === boxId);
  if (!box) return;

  const modal = document.getElementById('box-detail-modal');
  const codeEl = document.getElementById('modal-box-code');
  const shelfBadge = document.getElementById('modal-box-shelf-badge');
  const nameEl = document.getElementById('modal-box-name');
  const qrWrapper = document.getElementById('modal-box-qr-canvas-wrapper');
  const articlesList = document.getElementById('modal-box-articles-list');
  const btnLocateMap = document.getElementById('btn-box-locate-map');
  const btnPrintLabel = document.getElementById('btn-box-print-label');
  const btnAddItem = document.getElementById('btn-box-add-item');

  const shelf = AppState.shelves.find(s => s.id === box.shelf_id);
  codeEl.textContent = box.code;
  nameEl.textContent = box.name;
  shelfBadge.textContent = shelf ? `Estante: ${shelf.code} (${shelf.name})` : 'Sin estante asignado';

  // Generar Código QR en vivo en la cabecera del modal
  qrWrapper.innerHTML = '';
  const qrImg = document.createElement('img');
  qrImg.src = generateQRCode(getQRURL('caja', box.code), 80);
  qrImg.alt = box.code;
  qrImg.className = 'w-9 h-9 object-contain';
  qrWrapper.appendChild(qrImg);

  renderBoxArticlesList(box.id);

  // Botón Ver en el Mapa
  btnLocateMap.onclick = () => {
    modal.classList.add('hidden');
    closeShelfDrawer();
    // Cambiar a la pestaña de mapa si no está
    document.querySelector('[data-tab="tab-mapa"]').click();
    if (box.shelf_id) {
      highlightShelf(box.shelf_id);
    } else {
      alert('Esta caja no tiene asignado un estante en el plano.');
    }
  };

  // Botón Imprimir Etiqueta
  btnPrintLabel.onclick = () => {
    printSingleQRLabel({
      title: box.name,
      subtitle: `${box.code} | Estante: ${shelf ? shelf.code : 'S/E'}`,
      qrData: getQRURL('caja', box.code)
    });
  };

  // Botón Agregar Artículo a la Caja
  if (AppState.currentUserRole === 'guest') {
    btnAddItem.classList.add('hidden');
  } else {
    btnAddItem.classList.remove('hidden');
  }
  btnAddItem.onclick = () => {
    promptAddArticleToBox(box.id);
  };

  document.getElementById('btn-close-box-modal').onclick = () => {
    modal.classList.add('hidden');
  };

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function renderBoxArticlesList(boxId) {
  const container = document.getElementById('modal-box-articles-list');
  container.innerHTML = '';

  const items = AppState.boxStock.filter(bs => bs.box_id === boxId);

  if (items.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">No hay artículos en esta caja aún.</p>';
    return;
  }

  const isGuest = (AppState.currentUserRole === 'guest');

  items.forEach(item => {
    const art = AppState.articles.find(a => a.id === item.article_id);
    if (!art) return;

    const priceInfo = PriceEngine.getArticlePrice(art, AppState.posPriceList);
    const isLow = item.quantity <= art.stock_minimo;

    const controlsHtml = isGuest
      ? `
        <div class="flex items-center gap-1.5 font-mono">
          <span class="px-3 py-1.5 rounded-lg font-bold bg-slate-200 text-slate-800 text-sm">
            ${item.quantity} ${art.unit}
          </span>
        </div>
      `
      : `
        <!-- Controles de Cantidad Rápida (+ / -) con botones grandes para celular -->
        <div class="flex items-center gap-1.5">
          <button class="btn-adjust-qty px-2.5 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-lg font-bold text-xs active:scale-95" data-delta="-5">-5</button>
          <button class="btn-adjust-qty px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs active:scale-95" data-delta="-1">-1</button>
          
          <input type="number" class="input-qty-direct w-16 text-center font-mono font-bold text-sm p-1.5 bg-white border border-slate-300 rounded-lg" value="${item.quantity}">
          
          <button class="btn-adjust-qty px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold text-xs active:scale-95" data-delta="1">+1</button>
          <button class="btn-adjust-qty px-2.5 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg font-bold text-xs active:scale-95" data-delta="5">+5</button>
        </div>
      `;

    const row = document.createElement('div');
    row.className = 'bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm';
    row.innerHTML = `
      <div class="flex-1 w-full sm:w-auto">
        <div class="flex items-center gap-2">
          <span class="font-bold text-sm text-slate-900">${art.name}</span>
          <span class="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">${art.variant}</span>
        </div>
        <div class="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          <span>Precio c/IVA: <strong class="text-slate-800">${PriceEngine.formatARS(priceInfo.final)}</strong></span>
          <span>Mínimo: ${art.stock_minimo}</span>
          ${isLow ? '<span class="text-rose-600 font-bold">¡ALERTA STOCK BAJO!</span>' : ''}
        </div>
      </div>
      ${controlsHtml}
    `;

    // Eventos de ajuste solo si no es invitado
    if (!isGuest) {
      const inputQty = row.querySelector('.input-qty-direct');
      if (inputQty) {
        inputQty.addEventListener('change', () => {
          const val = parseInt(inputQty.value) || 0;
          item.quantity = Math.max(0, val);
          persistData();
          renderBoxArticlesList(boxId);
          refreshAllViews();
        });
      }

      row.querySelectorAll('.btn-adjust-qty').forEach(btn => {
        btn.addEventListener('click', () => {
          const delta = parseInt(btn.dataset.delta);
          item.quantity = Math.max(0, item.quantity + delta);
          persistData();
          renderBoxArticlesList(boxId);
          refreshAllViews();
        });
      });
    }

    container.appendChild(row);
  });
}

function promptAddArticleToBox(boxId) {
  if (AppState.currentUserRole === 'guest' || !AppState.currentUserRole) {
    alert('Modo Consulta: Para agregar o modificar artículos en cajas debe iniciar sesión como Dueño o Empleado.');
    openLoginModal();
    return;
  }
  const articleName = prompt('Nombre o código del artículo a guardar en esta caja:');
  if (!articleName) return;

  const article = AppState.articles.find(a => 
    a.name.toLowerCase().includes(articleName.toLowerCase()) || 
    a.code.toLowerCase() === articleName.toLowerCase()
  );

  if (!article) {
    alert('Artículo no encontrado en el catálogo. Primero crealo desde la pestaña Stock.');
    return;
  }

  const initialQty = parseInt(prompt(`Cantidad de "${article.name} (${article.variant})" que ingresan a esta caja:`, '100')) || 0;

  // Comprobar si ya existe
  let entry = AppState.boxStock.find(bs => bs.box_id === boxId && bs.article_id === article.id);
  if (entry) {
    entry.quantity += initialQty;
  } else {
    AppState.boxStock.push({
      box_id: boxId,
      article_id: article.id,
      quantity: initialQty
    });
  }

  persistData();
  renderBoxArticlesList(boxId);
  refreshAllViews();
}

// ============================================================================
// 5. PESTAÑA STOCK & CAJAS (VISTA TABULAR Y TARJETAS)
// ============================================================================
function setupInventoryView() {
  const searchInput = document.getElementById('inventory-search-input');
  const filterSelect = document.getElementById('inventory-filter-select');
  const subtabArticles = document.getElementById('subtab-articles');
  const subtabBoxes = document.getElementById('subtab-boxes');
  const subtabFaltantes = document.getElementById('subtab-faltantes');
  const articlesView = document.getElementById('articles-view-container');
  const boxesView = document.getElementById('boxes-view-container');
  const faltantesView = document.getElementById('faltantes-view-container');

  searchInput.addEventListener('input', () => renderInventoryTable());
  filterSelect.addEventListener('change', () => renderInventoryTable());

  function resetSubtabs() {
    [subtabArticles, subtabBoxes, subtabFaltantes].forEach(tab => {
      if (tab) {
        tab.className = 'py-2 border-b-2 border-transparent text-slate-500 hover:text-slate-800 whitespace-nowrap';
      }
    });
    [articlesView, boxesView, faltantesView].forEach(view => {
      if (view) view.classList.add('hidden');
    });
  }

  subtabArticles.addEventListener('click', () => {
    resetSubtabs();
    subtabArticles.className = 'py-2 border-b-2 border-brand-600 text-brand-700 font-bold whitespace-nowrap';
    articlesView.classList.remove('hidden');
    renderInventoryTable();
  });

  subtabBoxes.addEventListener('click', () => {
    resetSubtabs();
    subtabBoxes.className = 'py-2 border-b-2 border-brand-600 text-brand-700 font-bold whitespace-nowrap';
    boxesView.classList.remove('hidden');
    renderBoxesCards();
  });

  if (subtabFaltantes) {
    subtabFaltantes.addEventListener('click', () => {
      resetSubtabs();
      subtabFaltantes.className = 'py-2 border-b-2 border-amber-500 text-amber-800 font-bold whitespace-nowrap flex items-center gap-1.5';
      faltantesView.classList.remove('hidden');
      renderFaltantesTable();
    });
  }

  // Compartir lista de faltantes por WhatsApp
  const btnShareWhatsApp = document.getElementById('btn-share-faltantes-whatsapp');
  if (btnShareWhatsApp) {
    btnShareWhatsApp.addEventListener('click', shareFaltantesByWhatsApp);
  }

  // Imprimir lista de faltantes
  const btnPrintFaltantes = document.getElementById('btn-print-faltantes');
  if (btnPrintFaltantes) {
    btnPrintFaltantes.addEventListener('click', () => {
      const printArea = document.getElementById('print-area');
      printArea.innerHTML = document.getElementById('faltantes-view-container').innerHTML;
      window.print();
    });
  }

  // Botón Nuevo Artículo
  document.getElementById('btn-new-article').addEventListener('click', () => {
    createNewArticleDialog();
  });

  // Botón Nueva Caja
  document.getElementById('btn-new-box').addEventListener('click', () => {
    createNewBoxDialog();
  });
}

function renderFaltantesTable() {
  const tbody = document.getElementById('faltantes-table-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const faltantes = AppState.articles.filter(art => {
    const totalStock = getTotalStockForArticle(art.id);
    return totalStock <= art.stock_minimo;
  });

  if (faltantes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400">
          <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto mb-2"></i>
          <p class="font-bold text-slate-700">¡Excelente! No hay artículos bajo el stock mínimo en este momento.</p>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  faltantes.forEach(art => {
    const totalStock = getTotalStockForArticle(art.id);
    const needed = Math.max(10, (art.stock_minimo * 2) - totalStock);
    const locs = getArticleLocations(art.id);
    const locText = locs.length > 0
      ? locs.map(l => `${l.shelfCode} / ${l.boxCode}`).join(', ')
      : 'Sin caja asignada';
    const estimatedCost = PriceEngine.round(art.costo * needed);

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-amber-50/50 border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="py-3 px-4">
        <div class="font-bold text-slate-900">${art.name}</div>
        <div class="text-[11px] text-slate-500">${art.family} • <span class="font-semibold text-brand-700">${art.variant}</span></div>
        <div class="text-[10px] text-slate-400 font-mono">Cód: ${art.code}</div>
      </td>
      <td class="py-3 px-3 font-mono text-slate-700">
        ${locText}
      </td>
      <td class="py-3 px-3 text-center font-bold text-rose-600 font-mono">
        ${totalStock} ${art.unit}
      </td>
      <td class="py-3 px-3 text-center font-mono text-slate-600">
        ${art.stock_minimo}
      </td>
      <td class="py-3 px-3 text-center font-black text-amber-900 font-mono bg-amber-50">
        +${needed} ${art.unit}
      </td>
      <td class="py-3 px-3 text-right font-mono font-medium text-slate-700">
        ${PriceEngine.formatARS(estimatedCost)}
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

function shareFaltantesByWhatsApp() {
  const faltantes = AppState.articles.filter(art => getTotalStockForArticle(art.id) <= art.stock_minimo);
  if (faltantes.length === 0) {
    alert('No hay artículos faltantes para pedir.');
    return;
  }

  let msg = `*PEDIDO DE REPOSICIÓN - FERRETERÍA EL GAUCHITO*\n`;
  msg += `_Fecha: ${new Date().toLocaleDateString('es-AR')}_\n\n`;

  faltantes.forEach((art, idx) => {
    const totalStock = getTotalStockForArticle(art.id);
    const needed = Math.max(10, (art.stock_minimo * 2) - totalStock);
    msg += `${idx + 1}. *${art.name}* (${art.variant})\n`;
    msg += `   • Cód: ${art.code}\n`;
    msg += `   • Cantidad a pedir: *${needed} ${art.unit}* (Stock actual: ${totalStock})\n\n`;
  });

  msg += `_Por favor confirmar disponibilidad y cotización. Gracias!_`;
  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  const emptyState = document.getElementById('inventory-empty-state');
  const search = document.getElementById('inventory-search-input').value.toLowerCase().trim();
  const filter = document.getElementById('inventory-filter-select').value;
  if (!tbody) return;

  tbody.innerHTML = '';

  let filtered = AppState.articles.filter(art => {
    const matchSearch = art.name.toLowerCase().includes(search) || 
                        art.variant.toLowerCase().includes(search) ||
                        art.code.toLowerCase().includes(search) ||
                        (art.barcode && art.barcode.includes(search));
    if (!matchSearch) return false;

    // Calcular stock total sumando todas las cajas
    const totalStock = getTotalStockForArticle(art.id);

    if (filter === 'low') return totalStock <= art.stock_minimo && totalStock > 0;
    if (filter === 'empty') return totalStock === 0;
    return true;
  });

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
  }

  filtered.forEach(art => {
    const totalStock = getTotalStockForArticle(art.id);
    const isLow = totalStock <= art.stock_minimo;
    const priceInfo = PriceEngine.getArticlePrice(art, AppState.posPriceList);

    // Obtener en qué cajas y estantes está ubicado
    const locations = getArticleLocations(art.id);
    const locationsText = locations.length > 0 
      ? locations.map(loc => `<span class="inline-block bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono mr-1 mb-0.5">${loc.boxCode} (${loc.shelfCode}): <strong>${loc.qty}</strong></span>`).join('')
      : '<span class="text-rose-500 text-xs italic">Sin asignar a caja</span>';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
    tr.innerHTML = `
      <td class="py-3 px-4">
        <div class="font-bold text-slate-900">${art.name}</div>
        <div class="text-xs text-slate-500">${art.family} • <span class="font-semibold text-brand-700">${art.variant}</span></div>
      </td>
      <td class="py-3 px-3 font-mono text-xs">
        <div>${art.code}</div>
        <div class="text-slate-400 text-[10px]">${art.barcode || '-'}</div>
      </td>
      <td class="py-3 px-3">
        <div class="flex flex-wrap">${locationsText}</div>
      </td>
      <td class="py-3 px-3 text-right">
        <div class="font-bold text-slate-900 font-mono">${PriceEngine.formatARS(priceInfo.final)}</div>
        <div class="text-[10px] text-slate-400">Neto: ${PriceEngine.formatARS(priceInfo.neto)} (IVA ${art.alicuota_iva}%)</div>
      </td>
      <td class="py-3 px-4 text-center">
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold font-mono ${isLow ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800'}">
          ${totalStock} ${art.unit}
        </span>
        <div class="text-[10px] text-slate-400 mt-0.5">Mín: ${art.stock_minimo}</div>
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center gap-1">
          <button class="btn-locate-article p-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 rounded-lg" title="Ver en el mapa" data-art-id="${art.id}">
            <i data-lucide="map-pin" class="w-4 h-4"></i>
          </button>
          <button class="btn-add-to-pos p-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg" title="Vender en caja" data-art-id="${art.id}">
            <i data-lucide="shopping-cart" class="w-4 h-4"></i>
          </button>
        </div>
      </td>
    `;

    // Botón ubicar en el mapa
    tr.querySelector('.btn-locate-article').addEventListener('click', () => {
      const loc = locations[0];
      if (loc && loc.shelfId) {
        document.querySelector('[data-tab="tab-mapa"]').click();
        highlightShelf(loc.shelfId);
      } else {
        alert('Este artículo no tiene un estante asignado.');
      }
    });

    // Botón agregar al carrito POS
    tr.querySelector('.btn-add-to-pos').addEventListener('click', () => {
      addItemToPOSCart(art.id);
      document.querySelector('[data-tab="tab-ventas"]').click();
    });

    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

function getTotalStockForArticle(articleId) {
  return AppState.boxStock
    .filter(bs => bs.article_id === articleId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function getArticleLocations(articleId) {
  const entries = AppState.boxStock.filter(bs => bs.article_id === articleId && bs.quantity > 0);
  return entries.map(entry => {
    const box = AppState.boxes.find(b => b.id === entry.box_id);
    const shelf = box ? AppState.shelves.find(s => s.id === box.shelf_id) : null;
    return {
      boxId: entry.box_id,
      boxCode: box ? box.code : 'S/C',
      shelfId: shelf ? shelf.id : null,
      shelfCode: shelf ? shelf.code : 'S/E',
      qty: entry.quantity
    };
  });
}

function renderBoxesCards() {
  const container = document.getElementById('boxes-view-container');
  if (!container) return;
  container.innerHTML = '';

  AppState.boxes.forEach(box => {
    const shelf = AppState.shelves.find(s => s.id === box.shelf_id);
    const itemsCount = AppState.boxStock
      .filter(bs => bs.box_id === box.id)
      .reduce((sum, item) => sum + item.quantity, 0);

    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-brand-500 transition-all cursor-pointer flex flex-col justify-between';
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between">
          <span class="font-mono text-xs font-bold bg-amber-200 text-amber-950 px-2 py-0.5 rounded">${box.code}</span>
          <span class="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-semibold">${shelf ? shelf.code : 'Sin estante'}</span>
        </div>
        <h4 class="font-bold text-slate-800 text-base mt-2">${box.name}</h4>
        <p class="text-xs text-slate-500 mt-1">${shelf ? shelf.name : 'No asignado a mapa'}</p>
      </div>

      <div class="border-t border-slate-100 pt-3 mt-3 flex items-center justify-between">
        <span class="text-xs text-slate-600">Stock total en caja: <strong class="text-slate-900">${itemsCount} unid.</strong></span>
        <button class="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1">
          Abrir <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;

    card.addEventListener('click', () => openBoxModal(box.id));
    container.appendChild(card);
  });

  if (window.lucide) window.lucide.createIcons();
}

function updateStockMetrics() {
  const totalArticlesEl = document.getElementById('stat-total-articles');
  const totalBoxesEl = document.getElementById('stat-total-boxes');
  const lowStockEl = document.getElementById('stat-low-stock');
  const assignedPctEl = document.getElementById('stat-assigned-boxes');
  const badgeAlert = document.getElementById('badge-alert-count');

  if (!totalArticlesEl) return;

  totalArticlesEl.textContent = AppState.articles.length;
  totalBoxesEl.textContent = AppState.boxes.length;

  let lowStockCount = 0;
  AppState.articles.forEach(art => {
    if (getTotalStockForArticle(art.id) <= art.stock_minimo) {
      lowStockCount++;
    }
  });

  lowStockEl.textContent = lowStockCount;
  if (lowStockCount > 0) {
    badgeAlert.classList.remove('hidden');
    badgeAlert.textContent = lowStockCount;
  } else {
    badgeAlert.classList.add('hidden');
  }

  const assignedBoxes = AppState.boxes.filter(b => b.shelf_id).length;
  const pct = AppState.boxes.length > 0 ? Math.round((assignedBoxes / AppState.boxes.length) * 100) : 0;
  assignedPctEl.textContent = `${pct}%`;
}

function createNewArticleDialog() {
  openArticleModal();
}

function openArticleModal() {
  const modal = document.getElementById('article-modal');
  if (!modal) return;

  // Llenar selector de cajas físicas disponibles
  const boxSelect = document.getElementById('art-input-box');
  if (boxSelect) {
    boxSelect.innerHTML = '<option value="">-- Sin caja por ahora --</option>';
    AppState.boxes.forEach(b => {
      const shelf = AppState.shelves.find(s => s.id === b.shelf_id);
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.code} - ${b.name} (${shelf ? shelf.code : 'Sin estante'})`;
      boxSelect.appendChild(opt);
    });
  }

  // Limpiar campos y setear valores recomendados
  const form = document.getElementById('form-new-article');
  if (form) form.reset();

  document.getElementById('art-input-code').value = 'ART-' + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('art-input-cost').value = '100';
  document.getElementById('art-input-margin').value = '60';
  document.getElementById('art-input-iva').value = '21';
  document.getElementById('art-input-initial-stock').value = '50';
  document.getElementById('art-input-min-stock').value = '20';

  const errBox = document.getElementById('art-modal-error');
  if (errBox) errBox.classList.add('hidden');

  // Disparar cálculo en vivo de precios
  updateLiveArticlePrice();

  modal.classList.remove('hidden');
  setTimeout(() => {
    const nameInput = document.getElementById('art-input-name');
    if (nameInput) nameInput.focus();
  }, 100);
}

function updateLiveArticlePrice() {
  const cost = parseFloat(document.getElementById('art-input-cost').value) || 0;
  const margin = parseFloat(document.getElementById('art-input-margin').value) || 0;
  const ivaRate = parseFloat(document.getElementById('art-input-iva').value) || 0;

  const neto = PriceEngine.calcNeto(cost, margin);
  const ivaMonto = PriceEngine.calcMontoIVA(neto, ivaRate);
  const finalPrice = PriceEngine.calcFinalConIVA(neto, ivaRate);

  const previewFinal = document.getElementById('art-preview-final-price');
  const previewNeto = document.getElementById('art-preview-neto');
  const previewIvaMonto = document.getElementById('art-preview-iva-monto');

  if (previewFinal) previewFinal.textContent = PriceEngine.formatARS(finalPrice);
  if (previewNeto) previewNeto.textContent = PriceEngine.formatARS(neto);
  if (previewIvaMonto) previewIvaMonto.textContent = PriceEngine.formatARS(ivaMonto);
}

function setupArticleModal() {
  const modal = document.getElementById('article-modal');
  const btnClose = document.getElementById('btn-close-article-modal');
  const btnCancel = document.getElementById('btn-cancel-article-modal');
  const form = document.getElementById('form-new-article');
  const costInput = document.getElementById('art-input-cost');
  const marginInput = document.getElementById('art-input-margin');
  const ivaSelect = document.getElementById('art-input-iva');

  if (!modal) return;

  [costInput, marginInput, ivaSelect].forEach(el => {
    if (el) {
      el.addEventListener('input', updateLiveArticlePrice);
      el.addEventListener('change', updateLiveArticlePrice);
    }
  });

  const closeModal = () => modal.classList.add('hidden');
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (document.getElementById('art-input-name').value || '').trim();
      const variant = (document.getElementById('art-input-variant').value || '').trim();
      const errBox = document.getElementById('art-modal-error');

      if (!name || !variant) {
        if (errBox) {
          errBox.textContent = 'Por favor completá el nombre y la medida/variante.';
          errBox.classList.remove('hidden');
        }
        return;
      }

      let code = (document.getElementById('art-input-code').value || '').trim().toUpperCase();
      if (!code) {
        code = 'ART-' + Math.floor(1000 + Math.random() * 9000);
      }

      // Validar código duplicado
      const duplicate = AppState.articles.find(a => a.code.toUpperCase() === code);
      if (duplicate) {
        if (errBox) {
          errBox.textContent = `El código "${code}" ya pertenece a otro artículo. Usá uno diferente.`;
          errBox.classList.remove('hidden');
        }
        return;
      }

      const barcode = (document.getElementById('art-input-barcode').value || '').trim();
      const family = document.getElementById('art-input-family').value;
      const unit = document.getElementById('art-input-unit').value;
      const cost = parseFloat(costInput.value) || 0;
      const margin = parseFloat(marginInput.value) || 0;
      const iva = parseFloat(ivaSelect.value) || 21;
      const initialStock = parseInt(document.getElementById('art-input-initial-stock').value, 10) || 0;
      const minStock = parseInt(document.getElementById('art-input-min-stock').value, 10) || 0;
      const boxId = document.getElementById('art-input-box').value;

      const newArticle = {
        id: 'art-' + Date.now(),
        code: code,
        barcode: barcode,
        name: name,
        family: family,
        variant: variant,
        unit: unit,
        costo: cost,
        margen_pct: margin,
        alicuota_iva: iva,
        stock_minimo: minStock,
        category: family
      };

      AppState.articles.push(newArticle);

      // Si se indicó stock inicial y una caja, asignarlo
      if (boxId && initialStock > 0) {
        AppState.boxStock.push({
          box_id: boxId,
          article_id: newArticle.id,
          quantity: initialStock
        });
      } else if (initialStock > 0 && AppState.boxes.length > 0) {
        // Asignar por defecto a la primera caja
        AppState.boxStock.push({
          box_id: AppState.boxes[0].id,
          article_id: newArticle.id,
          quantity: initialStock
        });
      }

      persistData();
      refreshAllViews();
      closeModal();
      alert(`¡Artículo "${name} (${variant})" guardado con éxito con código ${code}!`);
    });
  }
}

function createNewBoxDialog() {
  const code = prompt('Código de la caja (ej: CAJA-0011):', `CAJA-00${AppState.boxes.length + 1}`);
  if (!code) return;
  const name = prompt('Nombre descriptivo de la caja:', 'Caja de Bulonería');
  if (!name) return;

  const newBox = {
    id: 'box-' + Date.now(),
    code: code.toUpperCase(),
    name: name,
    shelf_id: null
  };

  AppState.boxes.push(newBox);
  persistData();
  renderBoxesCards();
  updateStockMetrics();
  alert(`Caja ${code} creada. Ahora podés asignarla a un estante en el mapa.`);
}

// ============================================================================
// 6. PUNTO DE VENTA (POS) - VENTAS, CARRITO, FORMAS DE PAGO Y TICKET
// ============================================================================
function setupPOSView() {
  const barcodeInput = document.getElementById('pos-barcode-input');
  const btnCamera = document.getElementById('btn-pos-camera-scan');
  const priceListSelect = document.getElementById('pos-price-list-select');
  const btnClearCart = document.getElementById('btn-clear-cart');
  const btnConfirmSale = document.getElementById('btn-pos-confirm-sale');
  const btnSaveQuote = document.getElementById('btn-pos-save-quote');
  const btnPrintReceipt = document.getElementById('btn-pos-print-receipt');
  const globalDiscountInput = document.getElementById('pos-global-discount-input');
  const payButtons = document.querySelectorAll('.pay-method-btn');

  // Input de código de barras / buscador
  barcodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePOSBarcodeEnter(barcodeInput.value.trim());
      barcodeInput.value = '';
    }
  });

  barcodeInput.addEventListener('input', (e) => {
    handlePOSSearchTypeahead(e.target.value.trim());
  });

  // Escanear con cámara
  btnCamera.addEventListener('click', () => {
    openCameraScanner((scannedCode) => {
      handlePOSBarcodeEnter(scannedCode);
    });
  });

  // Cambio de lista de precios
  priceListSelect.addEventListener('change', (e) => {
    AppState.posPriceList = e.target.value;
    updatePOSCartTotals();
  });

  // Selector de formas de pago
  payButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      payButtons.forEach(b => {
        b.classList.remove('active', 'border-2', 'border-cyan-600', 'bg-cyan-50', 'text-cyan-900');
        b.classList.add('border', 'border-slate-200', 'bg-slate-50', 'text-slate-700');
      });
      btn.classList.add('active', 'border-2', 'border-cyan-600', 'bg-cyan-50', 'text-cyan-900');
      btn.classList.remove('border-slate-200', 'bg-slate-50', 'text-slate-700');
      AppState.posPaymentMethod = btn.dataset.method;
      updatePOSCartTotals();
    });
  });

  globalDiscountInput.addEventListener('input', (e) => {
    AppState.posGlobalDiscountPct = parseFloat(e.target.value) || 0;
    updatePOSCartTotals();
  });

  btnClearCart.addEventListener('click', () => {
    if (AppState.posCart.length === 0) return;
    if (confirm('¿Vaciar los artículos del carrito?')) {
      AppState.posCart = [];
      renderPOSCart();
    }
  });

  btnConfirmSale.addEventListener('click', () => {
    executeSale(false); // Venta real: descuenta stock
  });

  btnSaveQuote.addEventListener('click', () => {
    executeSale(true); // Presupuesto: no descuenta stock
  });

  btnPrintReceipt.addEventListener('click', () => {
    if (AppState.posCart.length === 0) {
      alert('Agregá artículos al carrito para previsualizar el ticket.');
      return;
    }
    showReceiptModal(buildReceiptData(false));
  });

  // Subpestañas del módulo de Ventas
  const subtabPosActive = document.getElementById('subtab-pos-active');
  const subtabSalesHist = document.getElementById('subtab-sales-history');
  const subtabClientsCC = document.getElementById('subtab-clients-cc');
  const posMainView = document.getElementById('pos-main-container');
  const salesHistView = document.getElementById('sales-history-container');
  const clientsCCView = document.getElementById('clients-cc-container');

  function resetPOSSubtabs() {
    [subtabPosActive, subtabSalesHist, subtabClientsCC].forEach(btn => {
      if (btn) {
        btn.className = 'px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1.5 whitespace-nowrap';
      }
    });
    [posMainView, salesHistView, clientsCCView].forEach(v => {
      if (v) v.classList.add('hidden');
    });
  }

  if (subtabPosActive) {
    subtabPosActive.addEventListener('click', () => {
      resetPOSSubtabs();
      subtabPosActive.className = 'px-3 py-1.5 rounded-lg bg-cyan-50 border border-cyan-300 text-cyan-900 font-bold flex items-center gap-1.5 whitespace-nowrap';
      posMainView.classList.remove('hidden');
    });
  }

  if (subtabSalesHist) {
    subtabSalesHist.addEventListener('click', () => {
      resetPOSSubtabs();
      subtabSalesHist.className = 'px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-300 text-brand-900 font-bold flex items-center gap-1.5 whitespace-nowrap';
      salesHistView.classList.remove('hidden');
      renderSalesHistoryTable();
    });
  }

  if (subtabClientsCC) {
    subtabClientsCC.addEventListener('click', () => {
      resetPOSSubtabs();
      subtabClientsCC.className = 'px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold flex items-center gap-1.5 whitespace-nowrap';
      clientsCCView.classList.remove('hidden');
      renderClientsCCTable();
    });
  }

  // Filtros del historial de ventas
  ['hist-filter-type', 'hist-filter-payment', 'hist-filter-query'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderSalesHistoryTable);
  });

  // Exportar ventas a Excel
  const btnExportSales = document.getElementById('btn-export-sales-excel');
  if (btnExportSales) {
    btnExportSales.addEventListener('click', exportSalesToExcel);
  }

  // Crear cliente desde Cta Cte
  const btnCreateCC = document.getElementById('btn-create-cc-client');
  if (btnCreateCC) {
    btnCreateCC.addEventListener('click', () => {
      document.getElementById('btn-add-quick-client').click();
      renderClientsCCTable();
    });
  }

  // Botón agregar cliente rápido
  document.getElementById('btn-add-quick-client').addEventListener('click', () => {
    const name = prompt('Nombre o Razón Social del Cliente:');
    if (!name) return;
    const cuit = prompt('CUIT o DNI:', '20-');
    const phone = prompt('Teléfono WhatsApp:');

    const newClient = {
      id: 'cli-' + Date.now(),
      name: name,
      cuit_dni: cuit || '',
      phone: phone || '',
      balance: 0
    };
    AppState.clients.push(newClient);
    persistData();
    renderPOSClients();
    renderClientsCCTable();
    document.getElementById('pos-client-select').value = newClient.id;
  });
}

function renderSalesHistoryTable() {
  const tbody = document.getElementById('sales-history-tbody');
  const profitBadge = document.getElementById('owner-profit-badge');
  const profitEl = document.getElementById('stat-filtered-profit');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filterType = document.getElementById('hist-filter-type').value;
  const filterPayment = document.getElementById('hist-filter-payment').value;
  const filterQuery = (document.getElementById('hist-filter-query').value || '').toLowerCase().trim();

  // Control de permisos para ver ganancia estimada: solo Dueño
  if (AppState.currentUserRole === 'owner') {
    profitBadge.classList.remove('hidden');
  } else {
    profitBadge.classList.add('hidden');
  }

  let totalProfit = 0;

  const filteredSales = AppState.sales.filter(s => {
    if (filterType === 'sales' && s.isQuote) return false;
    if (filterType === 'quotes' && !s.isQuote) return false;
    if (filterPayment !== 'all' && s.paymentMethod !== filterPayment) return false;
    if (filterQuery) {
      const matchClient = s.client && s.client.name.toLowerCase().includes(filterQuery);
      const matchId = s.id.toLowerCase().includes(filterQuery);
      if (!matchClient && !matchId) return false;
    }
    return true;
  });

  if (filteredSales.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          <p class="font-medium text-xs">No se encontraron comprobantes con esos filtros.</p>
        </td>
      </tr>
    `;
    if (window.lucide) window.lucide.createIcons();
    profitEl.textContent = PriceEngine.formatARS(0);
    return;
  }

  filteredSales.forEach(s => {
    // Calcular ganancia estimada si es venta confirmada
    if (!s.isQuote && s.items) {
      let costSum = 0;
      s.items.forEach(it => {
        const art = AppState.articles.find(a => a.name === it.name && a.variant === it.variant);
        if (art) {
          costSum += (art.costo * it.quantity);
        }
      });
      totalProfit += Math.max(0, s.total - costSum);
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="py-3 px-4 font-mono">
        <div class="font-bold text-slate-900">${s.id}</div>
        <div class="text-[11px] text-slate-500">${s.date}</div>
      </td>
      <td class="py-3 px-3">
        <div class="font-semibold text-slate-800">${s.client ? s.client.name : 'Consumidor Final'}</div>
        <div class="text-[10px] text-slate-400">${s.client && s.client.cuit_dni ? s.client.cuit_dni : ''}</div>
      </td>
      <td class="py-3 px-3 uppercase font-medium text-slate-700">
        ${s.paymentMethod}
      </td>
      <td class="py-3 px-3 text-center">
        ${s.isQuote 
          ? '<span class="bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full font-bold text-[10px]">PRESUPUESTO</span>'
          : '<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold text-[10px]">VENTA</span>'
        }
      </td>
      <td class="py-3 px-3 text-right font-mono font-bold text-slate-900 text-sm">
        ${PriceEngine.formatARS(s.total)}
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <button class="btn-view-receipt-row p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg" title="Ver Comprobante">
            <i data-lucide="eye" class="w-4 h-4"></i>
          </button>
          ${s.isQuote ? `
            <button class="btn-convert-quote px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shadow">
              <i data-lucide="check" class="w-3.5 h-3.5"></i> Vender
            </button>
          ` : ''}
        </div>
      </td>
    `;

    // Ver comprobante
    tr.querySelector('.btn-view-receipt-row').addEventListener('click', () => {
      showReceiptModal(s);
    });

    // Convertir presupuesto a venta
    const btnConvert = tr.querySelector('.btn-convert-quote');
    if (btnConvert) {
      btnConvert.addEventListener('click', () => {
        convertQuoteToSale(s.id);
      });
    }

    tbody.appendChild(tr);
  });

  profitEl.textContent = PriceEngine.formatARS(totalProfit);
  if (window.lucide) window.lucide.createIcons();
}

function convertQuoteToSale(saleId) {
  const quote = AppState.sales.find(s => s.id === saleId);
  if (!quote || !quote.isQuote) return;

  if (confirm(`¿Convertir el presupuesto ${quote.id} en VENTA definitiva? Se descontará el stock de las cajas.`)) {
    // Descontar stock
    quote.items.forEach(it => {
      const art = AppState.articles.find(a => a.name === it.name && a.variant === it.variant);
      if (art) {
        const stockBoxes = AppState.boxStock.filter(bs => bs.article_id === art.id && bs.quantity > 0);
        if (stockBoxes.length > 0) {
          stockBoxes[0].quantity = Math.max(0, stockBoxes[0].quantity - it.quantity);
        }
      }
    });

    quote.isQuote = false;
    quote.id = 'VTA-' + Date.now();
    quote.date = new Date().toLocaleString('es-AR') + ' (Desde Presupuesto)';

    persistData();
    refreshAllViews();
    renderSalesHistoryTable();
    alert(`¡Venta ${quote.id} confirmada y stock descontado con éxito!`);
    showReceiptModal(quote);
  }
}

function renderClientsCCTable() {
  const tbody = document.getElementById('clients-cc-tbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  AppState.clients.forEach(cli => {
    if (cli.id === 'final') return; // Omitir consumidor final en la lista de cuentas corrientes

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="py-3 px-4 font-bold text-slate-900 text-sm">
        ${cli.name}
      </td>
      <td class="py-3 px-3 font-mono text-slate-600">
        ${cli.cuit_dni || '-'}
      </td>
      <td class="py-3 px-3 font-mono text-slate-600">
        ${cli.phone || '-'}
      </td>
      <td class="py-3 px-3 text-right font-mono font-black text-sm ${cli.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}">
        ${PriceEngine.formatARS(cli.balance)}
      </td>
      <td class="py-3 px-4 text-center">
        <div class="flex items-center justify-center gap-1.5">
          <button class="btn-pay-cc px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow flex items-center gap-1">
            <i data-lucide="hand-coins" class="w-3.5 h-3.5"></i> Registrar Cobro
          </button>
        </div>
      </td>
    `;

    tr.querySelector('.btn-pay-cc').addEventListener('click', () => {
      registerClientPayment(cli.id);
    });

    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
}

function registerClientPayment(clientId) {
  const cli = AppState.clients.find(c => c.id === clientId);
  if (!cli) return;

  const currentDebt = cli.balance;
  const payStr = prompt(`Registrar cobro para "${cli.name}".\nSaldo actual deudor: ${PriceEngine.formatARS(currentDebt)}\n\nIngrese monto abonado en efectivo/transferencia:`, currentDebt > 0 ? currentDebt : '1000');
  if (!payStr) return;

  const payAmount = parseFloat(payStr.replace(',', '.')) || 0;
  if (payAmount <= 0) return;

  cli.balance = Math.max(0, PriceEngine.round(cli.balance - payAmount));

  // Registrar como movimiento de caja
  AppState.sales.unshift({
    id: 'COBRO-' + Date.now(),
    date: new Date().toLocaleString('es-AR'),
    isQuote: false,
    client: cli,
    paymentMethod: 'cobro-cuenta-corriente',
    items: [{ name: 'Pago / Abono Cuenta Corriente', variant: `Recibo de Cobro`, quantity: 1, unitPrice: payAmount, subtotal: payAmount }],
    total: payAmount
  });

  persistData();
  renderClientsCCTable();
  renderPOSClients();
  renderTodaySalesSummary();
  alert(`Pago de ${PriceEngine.formatARS(payAmount)} registrado. Nuevo saldo de ${cli.name}: ${PriceEngine.formatARS(cli.balance)}`);
}

function exportSalesToExcel() {
  const rows = AppState.sales.map(s => ({
    Comprobante: s.id,
    Fecha: s.date,
    Tipo: s.isQuote ? 'Presupuesto' : 'Venta',
    Cliente: s.client ? s.client.name : 'Consumidor Final',
    Medio_Pago: s.paymentMethod,
    Total: s.total
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historial Ventas');
  XLSX.writeFile(wb, `ventas_ferreteria_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function handlePOSBarcodeEnter(rawCode) {
  if (!rawCode) return;

  // 1. Comprobar si es código de caja (CAJA-0001)
  const box = AppState.boxes.find(b => b.code.toUpperCase() === rawCode.toUpperCase());
  if (box) {
    openBoxModal(box.id);
    return;
  }

  // 2. Buscar por código EAN o código interno de artículo
  const article = AppState.articles.find(a => 
    (a.barcode && a.barcode === rawCode) || 
    a.code.toUpperCase() === rawCode.toUpperCase()
  );

  if (article) {
    addItemToPOSCart(article.id);
  } else {
    alert(`No se encontró ningún artículo o caja con el código: ${rawCode}`);
  }
}

function handlePOSSearchTypeahead(query) {
  const resultsContainer = document.getElementById('pos-search-results');
  if (!query || query.length < 2) {
    resultsContainer.classList.add('hidden');
    return;
  }

  const matches = AppState.articles.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase()) || 
    a.variant.toLowerCase().includes(query.toLowerCase()) ||
    a.code.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 6);

  if (matches.length === 0) {
    resultsContainer.classList.add('hidden');
    return;
  }

  resultsContainer.innerHTML = '';
  matches.forEach(art => {
    const item = document.createElement('div');
    item.className = 'p-2.5 hover:bg-cyan-50 cursor-pointer flex justify-between items-center text-xs';
    const priceInfo = PriceEngine.getArticlePrice(art, AppState.posPriceList);
    const stock = getTotalStockForArticle(art.id);

    item.innerHTML = `
      <div>
        <span class="font-bold text-slate-800">${art.name}</span>
        <span class="text-slate-500">(${art.variant})</span>
        <div class="text-[10px] text-slate-400 font-mono">${art.code} • Stock: ${stock}</div>
      </div>
      <div class="font-bold text-cyan-800 font-mono text-sm">${PriceEngine.formatARS(priceInfo.final)}</div>
    `;

    item.addEventListener('click', () => {
      addItemToPOSCart(art.id);
      resultsContainer.classList.add('hidden');
      document.getElementById('pos-barcode-input').value = '';
    });

    resultsContainer.appendChild(item);
  });

  resultsContainer.classList.remove('hidden');
}

function addItemToPOSCart(articleId) {
  const article = AppState.articles.find(a => a.id === articleId);
  if (!article) return;

  // Buscar en qué caja hay stock disponible para elegir por defecto
  const stockBoxes = AppState.boxStock.filter(bs => bs.article_id === articleId && bs.quantity > 0);
  const defaultBoxId = stockBoxes.length > 0 ? stockBoxes[0].box_id : null;

  // Comprobar si ya está en el carrito con la misma caja
  const existing = AppState.posCart.find(item => item.articleId === articleId && item.boxId === defaultBoxId);
  if (existing) {
    existing.quantity++;
  } else {
    AppState.posCart.push({
      articleId: article.id,
      boxId: defaultBoxId,
      quantity: 1,
      discountPct: 0
    });
  }

  renderPOSCart();
}

function renderPOSCart() {
  const tbody = document.getElementById('pos-cart-tbody');
  const emptyState = document.getElementById('pos-cart-empty');
  tbody.innerHTML = '';

  if (AppState.posCart.length === 0) {
    emptyState.classList.remove('hidden');
    updatePOSCartTotals();
    return;
  }
  emptyState.classList.add('hidden');

  AppState.posCart.forEach((item, index) => {
    const art = AppState.articles.find(a => a.id === item.articleId);
    if (!art) return;

    const priceInfo = PriceEngine.getArticlePrice(art, AppState.posPriceList);
    const unitPrice = priceInfo.final;
    const discountFactor = 1 - (item.discountPct / 100);
    const itemSubtotal = PriceEngine.round(unitPrice * item.quantity * discountFactor);

    // Lista desplegable de cajas disponibles para este artículo
    const availableBoxes = AppState.boxStock.filter(bs => bs.article_id === art.id);
    let boxOptions = availableBoxes.map(bStock => {
      const box = AppState.boxes.find(b => b.id === bStock.box_id);
      const isSelected = item.boxId === bStock.box_id ? 'selected' : '';
      return `<option value="${bStock.box_id}" ${isSelected}>${box ? box.code : 'Caja'} (Hay: ${bStock.quantity})</option>`;
    }).join('');

    if (availableBoxes.length === 0) {
      boxOptions = '<option value="">Sin stock físico</option>';
    }

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 border-b border-slate-100 text-xs';
    tr.innerHTML = `
      <td class="py-2.5 px-3">
        <div class="font-bold text-slate-800">${art.name}</div>
        <div class="text-[11px] text-slate-500">${art.variant}</div>
      </td>
      <td class="py-2 px-2">
        <select class="cart-box-select p-1 bg-white border border-slate-300 rounded text-xs font-mono">
          ${boxOptions}
        </select>
      </td>
      <td class="py-2 px-2 text-center">
        <input type="number" min="1" class="cart-qty-input w-14 text-center font-bold bg-white border border-slate-300 rounded p-1" value="${item.quantity}">
      </td>
      <td class="py-2 px-2 text-right font-mono font-medium">${PriceEngine.formatARS(unitPrice)}</td>
      <td class="py-2 px-2 text-center">
        <input type="number" min="0" max="100" class="cart-discount-input w-12 text-center bg-white border border-slate-300 rounded p-1" value="${item.discountPct}">
      </td>
      <td class="py-2 px-3 text-right font-mono font-bold text-cyan-800">${PriceEngine.formatARS(itemSubtotal)}</td>
      <td class="py-2 px-2 text-center">
        <button class="btn-remove-cart-item text-rose-500 hover:text-rose-700 p-1">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </td>
    `;

    // Eventos de inputs de fila
    tr.querySelector('.cart-box-select').addEventListener('change', (e) => {
      item.boxId = e.target.value;
    });

    tr.querySelector('.cart-qty-input').addEventListener('change', (e) => {
      item.quantity = Math.max(1, parseInt(e.target.value) || 1);
      renderPOSCart();
    });

    tr.querySelector('.cart-discount-input').addEventListener('change', (e) => {
      item.discountPct = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
      renderPOSCart();
    });

    tr.querySelector('.btn-remove-cart-item').addEventListener('click', () => {
      AppState.posCart.splice(index, 1);
      renderPOSCart();
    });

    tbody.appendChild(tr);
  });

  if (window.lucide) window.lucide.createIcons();
  updatePOSCartTotals();
}

function updatePOSCartTotals() {
  const netoEl = document.getElementById('pos-neto-amount');
  const ivaEl = document.getElementById('pos-iva-amount');
  const discountRow = document.getElementById('pos-discount-row');
  const discountEl = document.getElementById('pos-discount-amount');
  const totalEl = document.getElementById('pos-total-amount');

  let subtotalNeto = 0;
  let totalIVA = 0;
  let totalBruto = 0;

  AppState.posCart.forEach(item => {
    const art = AppState.articles.find(a => a.id === item.articleId);
    if (!art) return;

    const priceInfo = PriceEngine.getArticlePrice(art, AppState.posPriceList);
    const itemDisc = 1 - (item.discountPct / 100);
    const itemTotal = PriceEngine.round(priceInfo.final * item.quantity * itemDisc);

    // Desglose de IVA
    const itemNeto = PriceEngine.round(itemTotal / (1 + (art.alicuota_iva / 100)));
    const itemIVA = PriceEngine.round(itemTotal - itemNeto);

    subtotalNeto += itemNeto;
    totalIVA += itemIVA;
    totalBruto += itemTotal;
  });

  // Ajustes de Medio de Pago y Descuento Global
  let adjustmentPct = 0;
  if (AppState.posPaymentMethod === 'efectivo') {
    adjustmentPct -= AppState.config.cashDiscountPct; // Descuento efectivo (-10%)
  } else if (AppState.posPaymentMethod === 'credito') {
    adjustmentPct += AppState.config.creditSurchargePct; // Recargo tarjeta crédito (+15%)
  }

  // Sumar descuento extra global
  adjustmentPct -= AppState.posGlobalDiscountPct;

  const adjustmentAmount = PriceEngine.round(totalBruto * (adjustmentPct / 100));
  const finalTotal = Math.max(0, PriceEngine.round(totalBruto + adjustmentAmount));

  netoEl.textContent = PriceEngine.formatARS(subtotalNeto);
  ivaEl.textContent = PriceEngine.formatARS(totalIVA);
  totalEl.textContent = PriceEngine.formatARS(finalTotal);

  if (adjustmentAmount !== 0) {
    discountRow.classList.remove('hidden');
    discountEl.textContent = (adjustmentAmount < 0 ? '-' : '+') + PriceEngine.formatARS(Math.abs(adjustmentAmount));
  } else {
    discountRow.classList.add('hidden');
  }
}

function renderPOSClients() {
  const select = document.getElementById('pos-client-select');
  if (!select) return;
  select.innerHTML = '';

  AppState.clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name} ${c.balance > 0 ? `(Saldo Cta Cte: ${PriceEngine.formatARS(c.balance)})` : ''}`;
    select.appendChild(opt);
  });
}

function executeSale(isQuote = false) {
  if (AppState.posCart.length === 0) {
    alert('El carrito está vacío. Agregá al menos un artículo.');
    return;
  }

  // Validar stock si es venta definitiva
  if (!isQuote) {
    for (const item of AppState.posCart) {
      if (!item.boxId) {
        alert('Uno de los artículos no tiene seleccionada una caja física de donde retirar el stock.');
        return;
      }
      const stockEntry = AppState.boxStock.find(bs => bs.box_id === item.boxId && bs.article_id === item.articleId);
      if (!stockEntry || stockEntry.quantity < item.quantity) {
        const art = AppState.articles.find(a => a.id === item.articleId);
        const box = AppState.boxes.find(b => b.id === item.boxId);
        const available = stockEntry ? stockEntry.quantity : 0;
        alert(`¡Stock insuficiente en la ${box ? box.code : 'caja'} para "${art.name}"! Se solicitaron ${item.quantity} y hay ${available}.`);
        return;
      }
    }

    // Descontar stock
    AppState.posCart.forEach(item => {
      const stockEntry = AppState.boxStock.find(bs => bs.box_id === item.boxId && bs.article_id === item.articleId);
      if (stockEntry) {
        stockEntry.quantity -= item.quantity;
      }
    });
  }

  // Crear objeto de venta
  const saleData = buildReceiptData(isQuote);
  AppState.sales.unshift(saleData);

  // Si fue cuenta corriente, aumentar saldo del cliente
  if (!isQuote && AppState.posPaymentMethod === 'corriente') {
    const client = AppState.clients.find(c => c.id === AppState.selectedClientId);
    if (client) client.balance += saleData.total;
  }

  persistData();
  refreshAllViews();

  // Mostrar ticket o comprobante
  showReceiptModal(saleData);

  // Vaciar carrito
  AppState.posCart = [];
  renderPOSCart();
}

function buildReceiptData(isQuote) {
  const clientId = document.getElementById('pos-client-select').value;
  const client = AppState.clients.find(c => c.id === clientId) || AppState.clients[0];
  const items = AppState.posCart.map(item => {
    const art = AppState.articles.find(a => a.id === item.articleId);
    const priceInfo = PriceEngine.getArticlePrice(art, AppState.posPriceList);
    const subtotal = PriceEngine.round(priceInfo.final * item.quantity * (1 - (item.discountPct / 100)));
    return {
      name: art.name,
      variant: art.variant,
      quantity: item.quantity,
      unitPrice: priceInfo.final,
      discountPct: item.discountPct,
      subtotal: subtotal,
      alicuotaIva: art.alicuota_iva
    };
  });

  const totalStr = document.getElementById('pos-total-amount').textContent;
  const finalTotal = parseFloat(totalStr.replace('$', '').replace(/\./g, '').replace(',', '.')) || 0;

  return {
    id: (isQuote ? 'PRE-' : 'VTA-') + Date.now(),
    date: new Date().toLocaleString('es-AR'),
    isQuote: isQuote,
    client: client,
    paymentMethod: AppState.posPaymentMethod,
    items: items,
    total: finalTotal
  };
}

function showReceiptModal(saleData) {
  const modal = document.getElementById('receipt-modal');
  const paper = document.getElementById('receipt-printable-content');

  let itemsHtml = saleData.items.map(it => `
    <div style="display:flex; justify-content:space-between; margin-bottom: 4px;">
      <div>
        <strong>${it.quantity}x</strong> ${it.name} <br>
        <span style="font-size:11px; color:#555;">${it.variant} (${PriceEngine.formatARS(it.unitPrice)} c/u)</span>
      </div>
      <div style="font-weight:bold; font-family:monospace;">${PriceEngine.formatARS(it.subtotal)}</div>
    </div>
  `).join('');

  paper.innerHTML = `
    <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:8px; margin-bottom:8px;">
      <h2 style="font-size:16px; font-weight:bold; margin:0;">FERRETERÍA EL GAUCHITO</h2>
      <p style="margin:2px 0; font-size:11px;">Av. Principal 1234 - Tel: 11-4567-8900</p>
      <p style="margin:2px 0; font-size:11px;">IVA Responsable Inscripto</p>
      <div style="margin-top:4px; font-weight:bold; border:1px solid #000; padding:2px;">
        ${saleData.isQuote ? 'PRESUPUESTO (NO VÁLIDO COMO FACTURA)' : 'COMPROBANTE NO FISCAL - REMITO INTERNO'}
      </div>
    </div>

    <div style="font-size:11px; margin-bottom:8px;">
      <div><strong>Comprobante N°:</strong> ${saleData.id}</div>
      <div><strong>Fecha:</strong> ${saleData.date}</div>
      <div><strong>Cliente:</strong> ${saleData.client.name}</div>
      <div><strong>Medio de Pago:</strong> ${saleData.paymentMethod.toUpperCase()}</div>
    </div>

    <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:8px 0; margin-bottom:8px;">
      ${itemsHtml}
    </div>

    <div style="text-align:right; font-size:15px; font-weight:bold; margin-bottom:12px;">
      TOTAL: ${PriceEngine.formatARS(saleData.total)}
    </div>

    <div style="text-align:center; font-size:10px; border-top:1px dashed #000; padding-top:6px;">
      <p style="margin:0;">Los precios incluyen IVA.</p>
      <p style="margin:2px 0;">¡Gracias por su compra!</p>
    </div>
  `;

  // Botón Imprimir Ticket
  document.getElementById('btn-print-receipt-paper').onclick = () => {
    const printArea = document.getElementById('print-area');
    printArea.innerHTML = paper.innerHTML;
    window.print();
  };

  // Botón Compartir por WhatsApp
  document.getElementById('btn-share-whatsapp').onclick = () => {
    let msg = `*FERRETERÍA EL GAUCHITO*\n`;
    msg += `_${saleData.isQuote ? 'Presupuesto' : 'Detalle de Compra'} N° ${saleData.id}_\n\n`;
    saleData.items.forEach(it => {
      msg += `• *${it.quantity}x* ${it.name} (${it.variant}) = ${PriceEngine.formatARS(it.subtotal)}\n`;
    });
    msg += `\n*TOTAL: ${PriceEngine.formatARS(saleData.total)}*\n`;
    msg += `Forma de pago: ${saleData.paymentMethod.toUpperCase()}\n`;
    msg += `_Comprobante no fiscal interno._`;

    const encoded = encodeURIComponent(msg);
    const phone = saleData.client.phone.replace(/[^0-9]/g, '');
    const url = phone ? `https://wa.me/549${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  document.getElementById('btn-close-receipt').onclick = () => modal.classList.add('hidden');
  modal.classList.remove('hidden');
}

function renderTodaySalesSummary() {
  const salesEl = document.getElementById('pos-today-sales');
  const countEl = document.getElementById('pos-today-count');
  if (!salesEl) return;

  const actualSales = AppState.sales.filter(s => !s.isQuote);
  const total = actualSales.reduce((sum, s) => sum + s.total, 0);

  salesEl.textContent = PriceEngine.formatARS(total);
  countEl.textContent = actualSales.length;
}

// ============================================================================
// 7. PRECIOS, IVA Y ACTUALIZACIÓN MASIVA CON HISTORIAL
// ============================================================================
function setupPriceCalculator() {
  const inCosto = document.getElementById('calc-costo');
  const inMargen = document.getElementById('calc-margen');
  const inNeto = document.getElementById('calc-neto');
  const selAlicuota = document.getElementById('calc-alicuota');
  const inFinal = document.getElementById('calc-final');

  if (!inCosto) return;

  // Si cambia Costo o Margen -> Recalcular Neto y Final
  function recalcForward() {
    const c = parseFloat(inCosto.value) || 0;
    const m = parseFloat(inMargen.value) || 0;
    const ali = parseFloat(selAlicuota.value) || 0;

    const neto = PriceEngine.calcNeto(c, m);
    const finalVal = PriceEngine.calcFinalConIVA(neto, ali);

    inNeto.value = neto;
    inFinal.value = finalVal;
  }

  // Si el usuario escribe el Precio Final con IVA -> Recalcular Neto y Margen
  function recalcBackward() {
    const f = parseFloat(inFinal.value) || 0;
    const ali = parseFloat(selAlicuota.value) || 0;
    const c = parseFloat(inCosto.value) || 1;

    const neto = PriceEngine.netoFromFinal(f, ali);
    const margen = PriceEngine.round(((neto - c) / c) * 100);

    inNeto.value = neto;
    inMargen.value = margen;
  }

  inCosto.addEventListener('input', recalcForward);
  inMargen.addEventListener('input', recalcForward);
  selAlicuota.addEventListener('change', recalcForward);
  inFinal.addEventListener('input', recalcBackward);
}

function setupBulkPriceUpdater() {
  const btnPreview = document.getElementById('btn-preview-bulk-price');
  const btnConfirm = document.getElementById('btn-confirm-bulk-price');
  const btnRollback = document.getElementById('btn-rollback-prices');
  const previewContainer = document.getElementById('bulk-price-preview-container');
  const previewTbody = document.getElementById('bulk-price-preview-tbody');
  const previewCount = document.getElementById('bulk-preview-count');

  let pendingModifications = [];

  btnPreview.addEventListener('click', () => {
    const scope = document.getElementById('bulk-price-scope').value;
    const type = document.getElementById('bulk-price-type').value;
    const pct = parseFloat(document.getElementById('bulk-price-percent').value) || 0;

    if (pct === 0) {
      alert('Ingresá un porcentaje distinto de cero.');
      return;
    }

    // Filtrar artículos afectados
    let targets = AppState.articles.filter(art => {
      if (scope === 'all') return true;
      if (scope === 'family-buloneria') return art.family.toLowerCase().includes('bulon');
      if (scope === 'family-termofusion') return art.family.toLowerCase().includes('termo');
      if (scope === 'family-herramientas') return art.family.toLowerCase().includes('herramienta');
      return true;
    });

    pendingModifications = targets.map(art => {
      const oldPrice = PriceEngine.getArticlePrice(art).final;
      let newCosto = art.costo;
      let newMargen = art.margen_pct;

      if (type === 'costo') {
        newCosto = PriceEngine.round(art.costo * (1 + pct / 100));
      } else if (type === 'venta') {
        // Aumentar costo proporcionalmente para mantener margen
        newCosto = PriceEngine.round(art.costo * (1 + pct / 100));
      } else if (type === 'margen') {
        newMargen = PriceEngine.round(art.margen_pct + pct);
      }

      const tempArt = Object.assign({}, art, { costo: newCosto, margen_pct: newMargen });
      const newPrice = PriceEngine.getArticlePrice(tempArt).final;

      return {
        articleId: art.id,
        name: `${art.name} (${art.variant})`,
        oldCosto: art.costo,
        newCosto: newCosto,
        oldMargen: art.margen_pct,
        newMargen: newMargen,
        oldPrice: oldPrice,
        newPrice: newPrice,
        diff: PriceEngine.round(newPrice - oldPrice)
      };
    });

    previewCount.textContent = pendingModifications.length;
    previewTbody.innerHTML = '';
    pendingModifications.slice(0, 50).forEach(mod => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="p-2 font-medium text-slate-800">${mod.name}</td>
        <td class="p-2 text-right font-mono text-slate-500">${PriceEngine.formatARS(mod.oldPrice)}</td>
        <td class="p-2 text-right font-mono font-bold text-amber-900">${PriceEngine.formatARS(mod.newPrice)}</td>
        <td class="p-2 text-right font-mono text-emerald-700">+${PriceEngine.formatARS(mod.diff)}</td>
      `;
      previewTbody.appendChild(tr);
    });

    previewContainer.classList.remove('hidden');
  });

  btnConfirm.addEventListener('click', () => {
    if (pendingModifications.length === 0) return;

    // Guardar snapshot de respaldo para Rollback
    const snapshot = AppState.articles.map(a => ({ id: a.id, costo: a.costo, margen_pct: a.margen_pct }));
    AppState.priceRollbacks.push({
      date: new Date().toLocaleString(),
      snapshot: snapshot
    });

    // Aplicar modificaciones
    pendingModifications.forEach(mod => {
      const art = AppState.articles.find(a => a.id === mod.articleId);
      if (art) {
        art.costo = mod.newCosto;
        art.margen_pct = mod.newMargen;
      }
    });

    persistData();
    refreshAllViews();
    previewContainer.classList.add('hidden');
    alert(`¡Éxito! Se actualizaron los precios de ${pendingModifications.length} artículos.`);
  });

  btnRollback.addEventListener('click', () => {
    if (AppState.priceRollbacks.length === 0) {
      alert('No hay aumentos recientes guardados en el historial para deshacer.');
      return;
    }

    const last = AppState.priceRollbacks.pop();
    if (confirm(`¿Desea DESHACER el último aumento de precios realizado el ${last.date}?`)) {
      last.snapshot.forEach(item => {
        const art = AppState.articles.find(a => a.id === item.id);
        if (art) {
          art.costo = item.costo;
          art.margen_pct = item.margen_pct;
        }
      });
      persistData();
      refreshAllViews();
      alert('Se restauraron los precios anteriores con éxito.');
    }
  });
}

// ============================================================================
// 8. GENERADOR E IMPRESIÓN DE ETIQUETAS QR
// ============================================================================
function setupLabelGenerator() {
  const targetSelect = document.getElementById('labels-target-select');
  const formatSelect = document.getElementById('labels-format-select');
  const btnPrint = document.getElementById('btn-trigger-print');

  targetSelect.addEventListener('change', renderLabelsPreview);
  formatSelect.addEventListener('change', renderLabelsPreview);
  document.getElementById('lbl-chk-name').addEventListener('change', renderLabelsPreview);
  document.getElementById('lbl-chk-code').addEventListener('change', renderLabelsPreview);
  document.getElementById('lbl-chk-shelf').addEventListener('change', renderLabelsPreview);

  btnPrint.addEventListener('click', () => {
    const printArea = document.getElementById('print-area');
    const previewGrid = document.getElementById('labels-preview-grid');
    printArea.innerHTML = previewGrid.innerHTML;
    window.print();
  });
}

function renderLabelsPreview() {
  const grid = document.getElementById('labels-preview-grid');
  const target = document.getElementById('labels-target-select').value;
  const showName = document.getElementById('lbl-chk-name').checked;
  const showCode = document.getElementById('lbl-chk-code').checked;
  const showShelf = document.getElementById('lbl-chk-shelf').checked;

  grid.innerHTML = '';

  let itemsToPrint = [];

  if (target === 'all-boxes' || target === 'by-shelf') {
    AppState.boxes.forEach(box => {
      const shelf = AppState.shelves.find(s => s.id === box.shelf_id);
      itemsToPrint.push({
        title: box.name,
        code: box.code,
        shelf: shelf ? shelf.code : 'S/E',
        qrUrl: getQRURL('caja', box.code)
      });
    });
  } else if (target === 'all-shelves') {
    AppState.shelves.filter(s => s.type === 'stockable').forEach(shelf => {
      itemsToPrint.push({
        title: shelf.name,
        code: shelf.code,
        shelf: 'Mapa',
        qrUrl: getQRURL('estante', shelf.code)
      });
    });
  }

  itemsToPrint.forEach(item => {
    const card = document.createElement('div');
    card.className = 'label-card bg-white p-3 rounded-lg border border-slate-300 flex flex-col items-center text-center shadow-sm';
    
    // Imagen QR directa (preservada en print e innerHTML)
    const qrImg = document.createElement('img');
    qrImg.src = generateQRCode(item.qrUrl, 120);
    qrImg.alt = item.code;
    qrImg.className = 'w-24 h-24 object-contain mx-auto my-1';
    card.appendChild(qrImg);

    if (showCode) {
      const codeEl = document.createElement('div');
      codeEl.className = 'font-mono font-bold text-xs mt-1 text-slate-900';
      codeEl.textContent = item.code;
      card.appendChild(codeEl);
    }

    if (showName) {
      const nameEl = document.createElement('div');
      nameEl.className = 'text-[11px] font-semibold text-slate-700 leading-tight mt-0.5 line-clamp-2';
      nameEl.textContent = item.title;
      card.appendChild(nameEl);
    }

    if (showShelf) {
      const shelfEl = document.createElement('div');
      shelfEl.className = 'text-[10px] text-slate-500 font-mono';
      shelfEl.textContent = `Est: ${item.shelf}`;
      card.appendChild(shelfEl);
    }

    grid.appendChild(card);
  });
}

function printSingleQRLabel(data) {
  const printArea = document.getElementById('print-area');
  const qrDataUrl = generateQRCode(data.qrData, 180);
  printArea.innerHTML = `
    <div style="text-align:center; padding: 20px; font-family:sans-serif;">
      <img src="${qrDataUrl}" alt="QR" style="width:140px; height:140px; margin:0 auto 10px auto; display:block;" />
      <h3 style="margin: 8px 0 2px 0; font-size:16px;">${data.title}</h3>
      <p style="margin:0; font-size:12px; font-family:monospace; color:#333;">${data.subtitle}</p>
    </div>
  `;
  setTimeout(() => window.print(), 100);
}

// ============================================================================
// 9. IMPORTACIÓN Y EXPORTACIÓN EXCEL (.XLSX / .CSV)
// ============================================================================
function setupExcelImportExport() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('excel-file-input');
  const btnDownloadTemplate = document.getElementById('btn-download-excel-template');
  const btnExportAll = document.getElementById('btn-export-all-data');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-brand-600', 'bg-brand-100/50');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-brand-600', 'bg-brand-100/50');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-brand-600', 'bg-brand-100/50');
    if (e.dataTransfer.files.length > 0) {
      processExcelFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      processExcelFile(e.target.files[0]);
    }
  });

  btnDownloadTemplate.addEventListener('click', downloadExcelTemplate);
  btnExportAll.addEventListener('click', exportAllToExcel);
}

function processExcelFile(file) {
  const reader = new FileReader();
  const progressBar = document.getElementById('import-progress-bar');
  const progressPct = document.getElementById('import-progress-pct');
  const progressContainer = document.getElementById('import-progress-container');
  const summaryBox = document.getElementById('import-summary-box');

  progressContainer.classList.remove('hidden');
  summaryBox.classList.add('hidden');
  progressBar.style.width = '20%';
  progressPct.textContent = '20%';

  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      progressBar.style.width = '60%';
      progressPct.textContent = '60%';

      let importedCount = 0;
      let duplicatesCount = 0;
      let errorsCount = 0;

      rows.forEach(row => {
        const code = String(row.Codigo || row.codigo || '').trim();
        const name = String(row.Nombre || row.nombre || '').trim();
        if (!code || !name) {
          errorsCount++;
          return;
        }

        // Comprobar si ya existe
        const existing = AppState.articles.find(a => a.code.toUpperCase() === code.toUpperCase());
        if (existing) {
          duplicatesCount++;
          return;
        }

        const newArt = {
          id: 'art-' + Date.now() + Math.random().toString(36).substr(2, 4),
          code: code,
          barcode: String(row.Codigo_Barras || row.codigo_barras || '').trim(),
          name: name,
          family: String(row.Familia || row.familia || 'General').trim(),
          variant: String(row.Medida || row.medida || '').trim(),
          unit: String(row.Unidad || row.unidad || 'unid').trim(),
          costo: parseFloat(row.Costo || row.costo) || 0,
          margen_pct: parseFloat(row.Margen || row.margen) || 60,
          alicuota_iva: parseFloat(row.IVA || row.iva) || 21,
          stock_minimo: parseInt(row.Stock_Minimo || row.stock_minimo) || 50,
          category: String(row.Categoria || row.categoria || 'Varios').trim()
        };

        AppState.articles.push(newArt);

        // Si la fila trae Caja y Estante, asignarla
        const boxCode = String(row.Caja_Codigo || row.caja_codigo || '').trim();
        const shelfCode = String(row.Estante_Codigo || row.estante_codigo || '').trim();
        const initialQty = parseInt(row.Stock_Actual || row.stock_actual) || 0;

        if (boxCode) {
          let box = AppState.boxes.find(b => b.code.toUpperCase() === boxCode.toUpperCase());
          if (!box) {
            box = {
              id: 'box-' + Date.now() + Math.random().toString(36).substr(2, 4),
              code: boxCode.toUpperCase(),
              name: String(row.Caja_Nombre || boxCode),
              shelf_id: null
            };
            AppState.boxes.push(box);
          }

          if (shelfCode && !box.shelf_id) {
            const shelf = AppState.shelves.find(s => s.code.toUpperCase() === shelfCode.toUpperCase());
            if (shelf) box.shelf_id = shelf.id;
          }

          AppState.boxStock.push({
            box_id: box.id,
            article_id: newArt.id,
            quantity: initialQty
          });
        }

        importedCount++;
      });

      progressBar.style.width = '100%';
      progressPct.textContent = '100%';

      persistData();
      refreshAllViews();

      summaryBox.classList.remove('hidden');
      summaryBox.innerHTML = `
        <h4 class="font-bold text-emerald-800">¡Importación completada con éxito!</h4>
        <p>• Artículos importados y creados: <strong>${importedCount}</strong></p>
        <p>• Artículos omitidos por código duplicado: <strong>${duplicatesCount}</strong></p>
        <p>• Filas con error o incompletas: <strong>${errorsCount}</strong></p>
      `;

      alert(`Importación finalizada: ${importedCount} artículos cargados.`);
    } catch (err) {
      console.error(err);
      alert('Error al leer el archivo Excel: ' + err.message);
    }
  };

  reader.readAsArrayBuffer(file);
}

function downloadExcelTemplate() {
  const sampleData = [
    {
      Codigo: 'BUL-HEX-141',
      Codigo_Barras: '7791234567011',
      Nombre: 'Bulón Hexagonal G2',
      Familia: 'Bulonería y Tornillos',
      Medida: '1/4 x 1 pulgada',
      Unidad: 'unid',
      Costo: 35.00,
      Margen: 60,
      IVA: 21,
      Stock_Actual: 240,
      Stock_Minimo: 100,
      Caja_Codigo: 'CAJA-0001',
      Caja_Nombre: 'Bulones Hexagonales Acero 1/4',
      Estante_Codigo: 'EST-BULONES'
    },
    {
      Codigo: 'COD-TERMO-20',
      Codigo_Barras: '7791234567059',
      Nombre: 'Codo Termofusión 90° Agua',
      Familia: 'Termofusión y Caños',
      Medida: '20 mm',
      Unidad: 'unid',
      Costo: 420.00,
      Margen: 50,
      IVA: 21,
      Stock_Actual: 65,
      Stock_Minimo: 40,
      Caja_Codigo: 'CAJA-0005',
      Caja_Nombre: 'Codos Termofusión 20mm y 25mm 90°',
      Estante_Codigo: 'EST-CODOS'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Artículos');
  XLSX.writeFile(wb, 'plantilla_inventario_ferreteria.xlsx');
}

function exportAllToExcel() {
  const exportRows = AppState.articles.map(art => {
    const totalStock = getTotalStockForArticle(art.id);
    const locations = getArticleLocations(art.id);
    const locText = locations.map(l => `${l.boxCode} (${l.shelfCode}): ${l.qty}`).join('; ');
    const priceInfo = PriceEngine.getArticlePrice(art);

    return {
      Codigo: art.code,
      Codigo_Barras: art.barcode || '',
      Nombre: art.name,
      Familia: art.family,
      Medida: art.variant,
      Unidad: art.unit,
      Costo: art.costo,
      Margen_Pct: art.margen_pct,
      Neto_Sin_IVA: priceInfo.neto,
      IVA_Pct: art.alicuota_iva,
      Precio_Final_IVA: priceInfo.final,
      Stock_Total: totalStock,
      Stock_Minimo: art.stock_minimo,
      Ubicaciones: locText
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Inventario Completo');
}

// ============================================================================
// 9. DASHBOARD DE VENTAS, REPORTES Y EXPORTACIÓN A EXCEL
// ============================================================================
function exportSalesToExcel() {
  if (!AppState.sales || AppState.sales.length === 0) {
    alert('No hay ventas registradas todavía para exportar.');
    return;
  }

  const isOwner = AppState.currentUserRole === 'owner';

  const rows = AppState.sales.map(s => {
    const itemsText = (s.items || []).map(it => `${it.quantity}x ${it.name} (${it.variant})`).join('; ');
    const totalItems = (s.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

    let costSum = 0;
    if (isOwner && !s.isQuote && s.items) {
      s.items.forEach(it => {
        const art = AppState.articles.find(a => a.name === it.name && a.variant === it.variant);
        if (art) {
          costSum += (art.costo * it.quantity);
        }
      });
    }
    const ganancia = isOwner ? Math.max(0, PriceEngine.round(s.total - costSum)) : 0;

    const row = {
      Comprobante: s.id,
      Fecha: s.date,
      Tipo: s.isQuote ? 'Presupuesto' : 'Venta Confirmada',
      Cliente: s.client ? s.client.name : 'Consumidor Final',
      CUIT_DNI: (s.client && s.client.cuit_dni) ? s.client.cuit_dni : '-',
      Forma_Pago: s.paymentMethod ? s.paymentMethod.toUpperCase() : 'EFECTIVO',
      Cantidad_Items: totalItems,
      Detalle_Articulos: itemsText,
      Total_Cobrado: s.total
    };

    if (isOwner) {
      row.Costo_Estimado = PriceEngine.round(costSum);
      row.Ganancia_Estimada = ganancia;
    }

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Historial Ventas');
  XLSX.writeFile(wb, `ventas_ferreteria_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

function setupDashboardView() {
  const periodSelect = document.getElementById('dash-period-select');
  const btnExportExcel = document.getElementById('btn-dash-export-excel');
  const btnTemplateExcel = document.getElementById('dash-template-excel') || document.getElementById('btn-dash-template-excel');
  const btnImportExcel = document.getElementById('btn-dash-import-excel');

  if (periodSelect) {
    periodSelect.addEventListener('change', renderDashboardView);
  }
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', exportSalesToExcel);
  }
  if (btnTemplateExcel) {
    btnTemplateExcel.addEventListener('click', downloadExcelTemplate);
  }
  if (btnImportExcel) {
    btnImportExcel.addEventListener('click', () => {
      switchTab('tab-importar');
    });
  }
}

function getSaleTimestamp(s) {
  if (s.timestamp) return s.timestamp;
  if (s.id && (s.id.startsWith('VTA-') || s.id.startsWith('PRE-'))) {
    const rawNum = parseInt(s.id.slice(4), 10);
    if (!isNaN(rawNum) && rawNum > 1600000000000) return rawNum;
  }
  const parsed = new Date(s.date).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

function renderDashboardView() {
  const periodSelect = document.getElementById('dash-period-select');
  const period = periodSelect ? periodSelect.value : 'mes';
  const isOwner = (AppState.currentUserRole === 'owner');

  // Mostrar / ocultar tarjeta de Ganancia Estimada según perfil
  const profitCard = document.getElementById('dash-kpi-profit-card');
  if (profitCard) {
    if (isOwner) {
      profitCard.classList.remove('hidden');
    } else {
      profitCard.classList.add('hidden');
    }
  }

  // Filtrar ventas por rango de fecha
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  const filteredSales = (AppState.sales || []).filter(s => {
    const time = getSaleTimestamp(s);
    if (period === 'hoy') return time >= startOfToday;
    if (period === '7d') return time >= sevenDaysAgo;
    if (period === 'mes') return time >= startOfMonth;
    if (period === '30d') return time >= thirtyDaysAgo;
    return true; // 'todo'
  });

  const confirmedSales = filteredSales.filter(s => !s.isQuote);
  const pendingQuotes = filteredSales.filter(s => s.isQuote);

  // 1. KPI: Total Facturado & Transacciones
  const totalFacturado = confirmedSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
  const totalTransacciones = confirmedSales.length;
  const avgTicket = totalTransacciones > 0 ? (totalFacturado / totalTransacciones) : 0;

  // 2. KPI: Unidades Vendidas
  let totalItemsSold = 0;
  let totalCostSum = 0;

  confirmedSales.forEach(s => {
    (s.items || []).forEach(it => {
      totalItemsSold += (Number(it.quantity) || 1);
      const art = AppState.articles.find(a => a.name === it.name && a.variant === it.variant);
      if (art) {
        totalCostSum += (art.costo * (Number(it.quantity) || 1));
      }
    });
  });

  // 3. KPI: Ganancia Estimada
  const totalProfit = Math.max(0, totalFacturado - totalCostSum);
  const profitMarginPct = totalFacturado > 0 ? Math.round((totalProfit / totalFacturado) * 100) : 0;

  // Actualizar elementos DOM de los KPIs
  const elTotalSales = document.getElementById('dash-kpi-total-sales');
  const elSalesCount = document.getElementById('dash-kpi-sales-count');
  const elAvgTicket = document.getElementById('dash-kpi-avg-ticket');
  const elTotalProfit = document.getElementById('dash-kpi-total-profit');
  const elProfitMargin = document.getElementById('dash-kpi-profit-margin');
  const elItemsSold = document.getElementById('dash-kpi-items-sold');
  const elQuotesPending = document.getElementById('dash-kpi-quotes-pending');

  if (elTotalSales) elTotalSales.textContent = PriceEngine.formatARS(totalFacturado);
  if (elSalesCount) elSalesCount.textContent = totalTransacciones;
  if (elAvgTicket) elAvgTicket.textContent = PriceEngine.formatARS(avgTicket);
  if (elTotalProfit) elTotalProfit.textContent = PriceEngine.formatARS(totalProfit);
  if (elProfitMargin) elProfitMargin.textContent = `${profitMarginPct}%`;
  if (elItemsSold) elItemsSold.textContent = totalItemsSold;
  if (elQuotesPending) elQuotesPending.textContent = pendingQuotes.length;

  // 4. Formas de Pago
  const payMethodsList = document.getElementById('dash-payment-methods-list');
  if (payMethodsList) {
    payMethodsList.innerHTML = '';
    const methodNames = {
      efectivo: { label: 'Efectivo', color: 'bg-emerald-500', text: 'text-emerald-700' },
      debito: { label: 'Tarjeta de Débito', color: 'bg-cyan-500', text: 'text-cyan-700' },
      transferencia: { label: 'Transferencia / QR', color: 'bg-indigo-500', text: 'text-indigo-700' },
      credito: { label: 'Tarjeta de Crédito', color: 'bg-amber-500', text: 'text-amber-700' },
      corriente: { label: 'Cuenta Corriente', color: 'bg-slate-500', text: 'text-slate-700' }
    };

    const methodTotals = { efectivo: 0, debito: 0, transferencia: 0, credito: 0, corriente: 0 };
    confirmedSales.forEach(s => {
      const m = (s.paymentMethod || 'efectivo').toLowerCase();
      if (methodTotals[m] !== undefined) {
        methodTotals[m] += Number(s.total) || 0;
      } else {
        methodTotals.efectivo += Number(s.total) || 0;
      }
    });

    Object.keys(methodNames).forEach(k => {
      const amt = methodTotals[k] || 0;
      const pct = totalFacturado > 0 ? Math.round((amt / totalFacturado) * 100) : 0;
      const info = methodNames[k];

      const itemDiv = document.createElement('div');
      itemDiv.className = 'space-y-1';
      itemDiv.innerHTML = `
        <div class="flex justify-between items-baseline text-xs">
          <span class="font-semibold text-slate-700">${info.label}</span>
          <div class="font-mono text-right">
            <span class="font-bold text-slate-900">${PriceEngine.formatARS(amt)}</span>
            <span class="text-[10px] text-slate-400 font-semibold ml-1">(${pct}%)</span>
          </div>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
          <div class="${info.color} h-2 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
        </div>
      `;
      payMethodsList.appendChild(itemDiv);
    });
  }

  // 5. Gráfico de Evolución de Ventas Diarias
  const chartContainer = document.getElementById('dash-chart-container');
  const chartRangeLabel = document.getElementById('dash-chart-range-label');
  if (chartRangeLabel) {
    const rangeLabels = {
      hoy: 'Ventas de la jornada de hoy',
      '7d': 'Ventas de los últimos 7 días',
      mes: 'Evolución diaria de este mes',
      '30d': 'Ventas de los últimos 30 días',
      todo: 'Historial total de ventas'
    };
    chartRangeLabel.textContent = rangeLabels[period] || 'Evolución';
  }

  if (chartContainer) {
    chartContainer.innerHTML = '';
    
    // Agrupar ventas confirmadas por día
    const dailyMap = {};
    confirmedSales.forEach(s => {
      const d = new Date(getSaleTimestamp(s));
      const dayKey = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { total: 0, count: 0 };
      }
      dailyMap[dayKey].total += Number(s.total) || 0;
      dailyMap[dayKey].count++;
    });

    const dayKeys = Object.keys(dailyMap);
    if (dayKeys.length === 0) {
      chartContainer.innerHTML = `
        <div class="w-full h-full flex flex-col items-center justify-center text-slate-400 py-8">
          <i data-lucide="bar-chart" class="w-8 h-8 mb-2 opacity-40"></i>
          <span class="text-xs font-semibold">No hay ventas registradas en este período.</span>
        </div>
      `;
    } else {
      let maxDaily = 0;
      dayKeys.forEach(k => {
        if (dailyMap[k].total > maxDaily) maxDaily = dailyMap[k].total;
      });

      dayKeys.forEach(k => {
        const item = dailyMap[k];
        const heightPct = maxDaily > 0 ? Math.max(12, Math.round((item.total / maxDaily) * 100)) : 12;

        const col = document.createElement('div');
        col.className = 'flex-1 min-w-[36px] max-w-[64px] flex flex-col items-center justify-end h-full group relative cursor-pointer';
        col.innerHTML = `
          <!-- Tooltip flotante al pasar el mouse -->
          <div class="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 bg-slate-900 text-white text-[10px] rounded px-2 py-1 pointer-events-none whitespace-nowrap shadow-lg">
            <div class="font-bold">${k}: ${PriceEngine.formatARS(item.total)}</div>
            <div class="text-[9px] text-slate-300">${item.count} tickets</div>
          </div>
          <!-- Barra visual -->
          <div class="w-full bg-brand-500 group-hover:bg-brand-600 rounded-t-md transition-all duration-300 relative flex items-start justify-center pt-1" style="height: ${heightPct}%">
            <span class="text-[9px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity font-mono">$</span>
          </div>
          <!-- Etiqueta de Fecha -->
          <span class="text-[10px] font-mono text-slate-500 mt-1 whitespace-nowrap">${k}</span>
        `;
        chartContainer.appendChild(col);
      });
    }
  }

  // 6. Ranking Top 10 Artículos Más Vendidos
  const topProductsTbody = document.getElementById('dash-top-products-tbody');
  if (topProductsTbody) {
    topProductsTbody.innerHTML = '';
    const productStats = {};

    confirmedSales.forEach(s => {
      (s.items || []).forEach(it => {
        const key = `${it.name}||${it.variant}`;
        if (!productStats[key]) {
          productStats[key] = {
            name: it.name,
            variant: it.variant,
            qty: 0,
            revenue: 0
          };
        }
        productStats[key].qty += (Number(it.quantity) || 1);
        productStats[key].revenue += (Number(it.subtotal) || 0);
      });
    });

    const sortedProducts = Object.values(productStats).sort((a, b) => b.qty - a.qty).slice(0, 10);

    if (sortedProducts.length === 0) {
      topProductsTbody.innerHTML = `
        <tr>
          <td colspan="4" class="p-6 text-center text-slate-400">
            <p class="font-medium text-xs">No hay ventas registradas en este período.</p>
          </td>
        </tr>
      `;
    } else {
      sortedProducts.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors text-xs border-b border-slate-100';
        tr.innerHTML = `
          <td class="py-2.5 px-3 font-bold text-slate-500 font-mono">
            ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '#' + (idx + 1)}
          </td>
          <td class="py-2.5 px-3">
            <div class="font-bold text-slate-800">${p.name}</div>
            <div class="text-[11px] text-brand-700 font-medium">${p.variant}</div>
          </td>
          <td class="py-2.5 px-3 text-center font-bold text-slate-900 font-mono bg-slate-50/60">
            ${p.qty}
          </td>
          <td class="py-2.5 px-3 text-right font-bold text-emerald-700 font-mono">
            ${PriceEngine.formatARS(p.revenue)}
          </td>
        `;
        topProductsTbody.appendChild(tr);
      });
    }
  }

  // 7. Últimas Operaciones Realizadas
  const recentOpsTbody = document.getElementById('dash-recent-ops-tbody');
  if (recentOpsTbody) {
    recentOpsTbody.innerHTML = '';
    const recentOps = filteredSales.slice(0, 8);

    if (recentOps.length === 0) {
      recentOpsTbody.innerHTML = `
        <tr>
          <td colspan="5" class="p-6 text-center text-slate-400">
            <p class="font-medium text-xs">Sin operaciones en este rango.</p>
          </td>
        </tr>
      `;
    } else {
      recentOps.forEach(s => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition-colors text-xs border-b border-slate-100';
        tr.innerHTML = `
          <td class="py-2 px-3 font-mono">
            <div class="font-bold text-slate-900 text-[11px]">${s.id}</div>
            <div class="text-[10px] text-slate-400">${s.date}</div>
          </td>
          <td class="py-2 px-3 text-slate-800 font-medium">
            ${s.client ? s.client.name : 'Consumidor Final'}
          </td>
          <td class="py-2 px-3 uppercase text-[10px] font-bold text-slate-600">
            ${s.paymentMethod || 'EFECTIVO'}
          </td>
          <td class="py-2 px-3 text-right font-mono font-bold text-slate-900">
            ${PriceEngine.formatARS(s.total)}
          </td>
          <td class="py-2 px-2 text-center">
            <button class="btn-dash-view-op p-1 text-brand-600 hover:text-brand-800 hover:bg-brand-50 rounded" title="Ver Comprobante">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i>
            </button>
          </td>
        `;
        tr.querySelector('.btn-dash-view-op').addEventListener('click', () => {
          showReceiptModal(s);
        });
        recentOpsTbody.appendChild(tr);
      });
    }
  }

  if (window.lucide) {
    try { window.lucide.createIcons(); } catch(e) {}
  }
}
window.renderDashboardView = renderDashboardView;

// ============================================================================
// 10. ESCÁNER DE CÁMARA PARA CELULAR (HTML5-QRCODE)
// ============================================================================
let html5QrCodeScanner = null;

function setupCameraScanner() {
  const btnQuick = document.getElementById('btn-quick-scan');
  btnQuick.addEventListener('click', () => {
    openCameraScanner((decodedText) => {
      handleGeneralScanResult(decodedText);
    });
  });

  document.getElementById('btn-close-scanner').addEventListener('click', closeCameraScanner);

  document.getElementById('btn-submit-manual-scan').addEventListener('click', () => {
    const manualVal = document.getElementById('manual-scan-input').value.trim();
    if (manualVal) {
      closeCameraScanner();
      handleGeneralScanResult(manualVal);
    }
  });
}

function openCameraScanner(onSuccessCallback) {
  const modal = document.getElementById('scanner-modal');
  modal.classList.remove('hidden');

  if (!html5QrCodeScanner) {
    html5QrCodeScanner = new Html5Qrcode('camera-reader');
  }

  const config = { fps: 10, qrbox: { width: 220, height: 220 } };

  html5QrCodeScanner.start(
    { facingMode: 'environment' },
    config,
    (decodedText) => {
      // Éxito al leer
      closeCameraScanner();
      onSuccessCallback(decodedText);
    },
    (errorMessage) => {
      // Escaneando frame...
    }
  ).catch(err => {
    console.warn('No se pudo acceder a la cámara trasera:', err);
    alert('No se pudo iniciar la cámara. Verificá que le diste permiso al navegador.');
  });
}

function closeCameraScanner() {
  const modal = document.getElementById('scanner-modal');
  modal.classList.add('hidden');
  if (html5QrCodeScanner) {
    try {
      html5QrCodeScanner.stop().catch(() => {});
    } catch (e) {}
  }
}

function handleGeneralScanResult(code) {
  // Comprobar si es URL de caja o estante
  if (code.includes('?caja=') || code.includes('?codigo=')) {
    const parts = code.split('=');
    const boxCode = decodeURIComponent(parts[1]).split('&')[0];
    const box = AppState.boxes.find(b => b.code.toUpperCase() === boxCode.toUpperCase());
    if (box) {
      openBoxModal(box.id);
      return;
    }
  }

  if (code.includes('?estante=')) {
    const parts = code.split('=');
    const shelfCode = decodeURIComponent(parts[1]).split('&')[0];
    const shelf = AppState.shelves.find(s => s.code.toUpperCase() === shelfCode.toUpperCase());
    if (shelf) {
      openShelfDrawer(shelf.id);
      return;
    }
  }

  // Comprobar caja directa
  const directBox = AppState.boxes.find(b => b.code.toUpperCase() === code.toUpperCase());
  if (directBox) {
    openBoxModal(directBox.id);
    return;
  }

  // Comprobar artículo por EAN o código
  const directArticle = AppState.articles.find(a => 
    (a.barcode && a.barcode === code) || 
    a.code.toUpperCase() === code.toUpperCase()
  );

  if (directArticle) {
    // Si estamos en ventas, agregar a carrito
    if (AppState.activeTab === 'tab-ventas') {
      addItemToPOSCart(directArticle.id);
    } else {
      // Mostrar en qué cajas y estantes está ubicado
      const locs = getArticleLocations(directArticle.id);
      if (locs.length > 0 && locs[0].shelfId) {
        document.querySelector('[data-tab="tab-mapa"]').click();
        highlightShelf(locs[0].shelfId);
        alert(`Artículo: ${directArticle.name}\nUbicado en: ${locs[0].boxCode} (Estante ${locs[0].shelfCode})`);
      } else {
        alert(`Artículo: ${directArticle.name}\nStock total: ${getTotalStockForArticle(directArticle.id)}`);
      }
    }
    return;
  }

  alert(`Código leído: "${code}". No se encontró coincidencia en la base de datos.`);
}

// ============================================================================
// 11. CONFIGURACIÓN, COPIAS DE SEGURIDAD Y SUPABASE
// ============================================================================
function setupConfigView() {
  const btnSaveSupabase = document.getElementById('btn-save-supabase-cfg');
  const btnDownloadBackup = document.getElementById('btn-download-backup');
  const backupFileInput = document.getElementById('backup-file-input');
  const btnSaveOwnerPass = document.getElementById('btn-save-owner-password');
  const btnSaveEmployeePass = document.getElementById('btn-save-employee-password');

  // Pre-cargar valores actuales
  const inputUrl = document.getElementById('cfg-supabase-url');
  const inputKey = document.getElementById('cfg-supabase-key');
  const inputOwnerPass = document.getElementById('cfg-owner-password');
  const inputEmpPass = document.getElementById('cfg-employee-password');

  if (inputUrl && AppState.config.supabaseUrl) inputUrl.value = AppState.config.supabaseUrl;
  if (inputKey && AppState.config.supabaseKey) inputKey.value = AppState.config.supabaseKey;
  if (inputOwnerPass) inputOwnerPass.value = AppState.config.ownerPassword || 'admin';
  if (inputEmpPass) inputEmpPass.value = AppState.config.employeePassword || '123';

  // Guardar Contraseña del Dueño
  if (btnSaveOwnerPass) {
    btnSaveOwnerPass.addEventListener('click', () => {
      if (AppState.currentUserRole !== 'owner') {
        alert('Solo el Dueño puede modificar las contraseñas de acceso.');
        return;
      }
      const newPass = inputOwnerPass ? inputOwnerPass.value.trim() : '';
      if (!newPass || newPass.length < 3) {
        alert('La contraseña del Dueño debe tener al menos 3 caracteres.');
        return;
      }
      AppState.config.ownerPassword = newPass;
      persistData();
      alert('¡Contraseña del Dueño actualizada correctamente a: "' + newPass + '"!');
    });
  }

  // Guardar Contraseña del Empleado
  if (btnSaveEmployeePass) {
    btnSaveEmployeePass.addEventListener('click', () => {
      if (AppState.currentUserRole !== 'owner') {
        alert('Solo el Dueño puede modificar las contraseñas de acceso.');
        return;
      }
      const newPass = inputEmpPass ? inputEmpPass.value.trim() : '';
      AppState.config.employeePassword = newPass;
      persistData();
      if (newPass) {
        alert('¡Contraseña de Empleado actualizada a: "' + newPass + '"!');
      } else {
        alert('¡Contraseña de Empleado eliminada! Ahora los empleados pueden ingresar sin clave.');
      }
    });
  }

  btnSaveSupabase.addEventListener('click', async () => {
    const url = document.getElementById('cfg-supabase-url').value.trim();
    const key = document.getElementById('cfg-supabase-key').value.trim();

    if (!url || !key) {
      alert('Ingresá tanto la URL como la Anon Key de Supabase.');
      return;
    }

    try {
      if (window.supabase) {
        const client = window.supabase.createClient(url, key);
        // Probar conexion sencilla
        const { error } = await client.from('estantes').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
          console.warn('Supabase aviso:', error);
        }
      }

      AppState.config.supabaseUrl = url;
      AppState.config.supabaseKey = key;
      persistData();

      document.getElementById('cloud-status-badge').className = 'inline-flex items-center gap-1 text-cyan-300 font-medium';
      document.getElementById('cloud-status-text').textContent = 'Conectado a Supabase (Nube)';
      alert('¡Conexión exitosa con Supabase! La sincronización con la nube está activa.');
    } catch (err) {
      alert('No se pudo conectar con Supabase: ' + err.message);
    }
  });

  btnDownloadBackup.addEventListener('click', () => {
    const fullBackup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      shelves: AppState.shelves,
      boxes: AppState.boxes,
      articles: AppState.articles,
      boxStock: AppState.boxStock,
      clients: AppState.clients,
      sales: AppState.sales,
      config: AppState.config
    };

    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_ferreteria_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  backupFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (!parsed.articles || !parsed.boxes || !parsed.shelves) {
          throw new Error('El archivo no contiene un respaldo válido de la ferretería.');
        }

        if (confirm('¿Desea restaurar este respaldo? Se sobrescribirán los datos actuales.')) {
          AppState.shelves = parsed.shelves;
          AppState.boxes = parsed.boxes;
          AppState.articles = parsed.articles;
          AppState.boxStock = parsed.boxStock || [];
          AppState.clients = parsed.clients || [];
          AppState.sales = parsed.sales || [];
          persistData();
          refreshAllViews();
          alert('¡Respaldo restaurado con éxito!');
        }
      } catch (err) {
        alert('Error al restaurar: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
}
