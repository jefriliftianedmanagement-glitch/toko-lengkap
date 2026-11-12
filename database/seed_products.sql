-- =====================================================================
-- DATA CONTOH PRODUK (opsional, hanya untuk mencoba tampilan toko di PART 3)
-- Jalankan di Supabase SQL Editor. Produk ini tanpa gambar (tampil inisial).
-- Setelah admin bisa menambah produk (PART 4), hapus data contoh dengan:
--   delete from public.products where created_by is null;
-- =====================================================================
insert into public.products (name, description, price, category, sold_count) values
('Headphone Nirkabel Aura',   'Headphone bluetooth dengan peredam bising aktif dan baterai hingga 30 jam.', 749000,  'Elektronik',    128),
('Speaker Mini Pulse',        'Speaker portabel tahan cipratan air dengan suara jernih dan bass dalam.',    299000,  'Elektronik',    210),
('Smartwatch Lumen S2',       'Pantau detak jantung, langkah, dan notifikasi langsung dari pergelangan.',   1250000, 'Elektronik',    76),
('Kaos Katun Premium',        'Kaos katun combed 30s, lembut, adem, dan tidak mudah melar.',                89000,   'Fashion',       342),
('Jaket Windbreaker Urban',   'Jaket ringan anti angin dengan saku tersembunyi dan kerah tinggi.',          349000,  'Fashion',       95),
('Sepatu Lari Swift',         'Sol empuk dan breathable, nyaman untuk lari harian maupun santai.',          539000,  'Olahraga',      164),
('Matras Yoga Anti Slip',     'Matras 6 mm dengan permukaan anti selip dan tas serut.',                     159000,  'Olahraga',      58),
('Botol Minum Termos 750ml',  'Menjaga minuman dingin 24 jam dan panas 12 jam, bahan stainless steel.',     129000,  'Rumah Tangga',  287),
('Lampu Meja LED Minimalis',  'Tiga tingkat kecerahan, port USB, dan desain ramping untuk meja kerja.',     189000,  'Rumah Tangga',  73),
('Dompet Kulit Slim',         'Dompet kulit sintetis premium dengan 6 slot kartu dan jahitan rapi.',        119000,  'Aksesoris',     201),
('Tas Ransel Harian 20L',     'Ransel tahan air dengan kompartemen laptop 14 inci dan punggung empuk.',     275000,  'Aksesoris',     138),
('Buku Catatan Hardcover',    'Kertas 100 gsm 200 halaman, cocok untuk jurnal dan catatan kerja.',          49000,   'Buku',          419),
('Paket Alat Tulis Lengkap',  'Isi pulpen gel, stabilo, penghapus, dan penggaris dalam satu kotak.',        65000,   'Buku',          156);
