-- ============================================================================
-- BASE DE DATOS SUPABASE (POSTGRESQL) - FERRETERÍA ARGENTINA
-- ============================================================================
-- Copiar y pegar todo este script en el "SQL Editor" de tu proyecto de Supabase
-- y presionar el botón verde "RUN".

-- 1. TABLA DE ESTANTES DEL MAPA
CREATE TABLE IF NOT EXISTS public.estantes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    x INTEGER NOT NULL DEFAULT 50,
    y INTEGER NOT NULL DEFAULT 50,
    width INTEGER NOT NULL DEFAULT 80,
    height INTEGER NOT NULL DEFAULT 50,
    type TEXT NOT NULL DEFAULT 'stockable', -- 'stockable', 'informative', 'inaccessible', 'unmapped'
    fill TEXT DEFAULT '#d1fae5',
    stroke TEXT DEFAULT '#10b981',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA DE CAJAS
CREATE TABLE IF NOT EXISTS public.cajas (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- ej: CAJA-0001
    name TEXT NOT NULL,
    shelf_id TEXT REFERENCES public.estantes(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA DE ARTÍCULOS Y VARIANTES
CREATE TABLE IF NOT EXISTS public.articulos (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- Código interno ej: BUL-HEX-141
    barcode TEXT,              -- Código EAN de fábrica (opcional)
    name TEXT NOT NULL,        -- ej: Bulón Hexagonal G2
    family TEXT NOT NULL,      -- ej: Bulonería y Tornillos
    variant TEXT NOT NULL,     -- ej: 1/4 x 1 pulgada
    unit TEXT DEFAULT 'unid',  -- unid, kg, metro, litro, etc.
    costo NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    margen_pct NUMERIC(6,2) NOT NULL DEFAULT 60.00,
    alicuota_iva NUMERIC(5,2) NOT NULL DEFAULT 21.00, -- 21, 10.5, 27, 0
    stock_minimo INTEGER NOT NULL DEFAULT 50,
    category TEXT DEFAULT 'Varios',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA DE STOCK POR CAJA (Un artículo puede estar en muchas cajas)
CREATE TABLE IF NOT EXISTS public.stock_cajas (
    id BIGSERIAL PRIMARY KEY,
    box_id TEXT NOT NULL REFERENCES public.cajas(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL REFERENCES public.articulos(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(box_id, article_id)
);

-- 5. TABLA DE CLIENTES Y CUENTA CORRIENTE
CREATE TABLE IF NOT EXISTS public.clientes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cuit_dni TEXT,
    phone TEXT,
    balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABLA DE VENTAS Y PRESUPUESTOS
CREATE TABLE IF NOT EXISTS public.ventas (
    id TEXT PRIMARY KEY, -- ej: VTA-1698765432
    created_at TIMESTAMPTZ DEFAULT NOW(),
    client_id TEXT REFERENCES public.clientes(id) ON DELETE SET NULL,
    payment_method TEXT NOT NULL, -- 'efectivo', 'transferencia', 'debito', 'credito', 'corriente'
    subtotal_neto NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_iva NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    is_quote BOOLEAN NOT NULL DEFAULT FALSE -- TRUE si es Presupuesto
);

-- 7. DETALLE DE ÍTEMS DE LA VENTA
CREATE TABLE IF NOT EXISTS public.detalle_ventas (
    id BIGSERIAL PRIMARY KEY,
    sale_id TEXT NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
    article_id TEXT NOT NULL REFERENCES public.articulos(id),
    box_id TEXT REFERENCES public.cajas(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    discount_pct NUMERIC(5,2) DEFAULT 0.00,
    subtotal NUMERIC(12,2) NOT NULL
);

-- 8. AUDITORÍA DE MOVIMIENTOS DE STOCK (Kardex)
CREATE TABLE IF NOT EXISTS public.movimientos_stock (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    article_id TEXT NOT NULL REFERENCES public.articulos(id),
    box_id TEXT NOT NULL REFERENCES public.cajas(id),
    quantity_delta INTEGER NOT NULL, -- positivo si sumó, negativo si restó
    reason TEXT NOT NULL,            -- 'Venta', 'Ingreso compra', 'Ajuste manual', 'Transferencia'
    user_role TEXT DEFAULT 'empleado'
);

-- 9. HISTORIAL DE ACTUALIZACIONES MASIVAS DE PRECIOS (Para Rollback)
CREATE TABLE IF NOT EXISTS public.historial_precios (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    description TEXT NOT NULL,
    snapshot_json JSONB NOT NULL
);

-- 10. HABILITAR SEGURIDAD POR FILAS (RLS) CON ACCESO PÚBLICO ANÓNIMO
ALTER TABLE public.estantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_cajas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_precios ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir lectura y escritura desde la aplicación web
CREATE POLICY "Permitir todo estantes" ON public.estantes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo cajas" ON public.cajas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo articulos" ON public.articulos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo stock_cajas" ON public.stock_cajas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo clientes" ON public.clientes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo ventas" ON public.ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo detalle_ventas" ON public.detalle_ventas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo movimientos_stock" ON public.movimientos_stock FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir todo historial_precios" ON public.historial_precios FOR ALL USING (true) WITH CHECK (true);

-- Índices recomendados para búsquedas instantáneas entre 15.000 artículos
CREATE INDEX IF NOT EXISTS idx_articulos_name ON public.articulos (name);
CREATE INDEX IF NOT EXISTS idx_articulos_code ON public.articulos (code);
CREATE INDEX IF NOT EXISTS idx_articulos_barcode ON public.articulos (barcode);
CREATE INDEX IF NOT EXISTS idx_stock_cajas_box ON public.stock_cajas (box_id);
CREATE INDEX IF NOT EXISTS idx_stock_cajas_art ON public.stock_cajas (article_id);
