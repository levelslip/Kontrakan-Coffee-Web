// scripts/export-content-json.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

function resolveContentDir() {
  const candidates = [
    path.join(ROOT, "content"),
    path.join(ROOT, "backend", "content"),
    path.join(ROOT, "frontend", "content"),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
        return c;
      }
    } catch {}
  }
  return path.join(ROOT, "content");
}

const CONTENT_DIR = resolveContentDir();
const TARGET_API_DIR = path.join(ROOT, "frontend", "public", "api");

// Minimal resilient frontmatter parser (works with or without external libs)
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: raw.trim() };
  }
  const yamlBlock = match[1];
  const body = match[2].trim();
  const data = {};

  const lines = yamlBlock.split(/\r?\n/);
  let currentKey = null;
  let isList = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("- ") && currentKey && isList) {
      const val = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, "");
      data[currentKey].push(val);
      continue;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const rawVal = line.slice(colonIdx + 1).trim();

      if (rawVal === "" || rawVal === "[]") {
        currentKey = key;
        isList = true;
        data[key] = [];
      } else {
        currentKey = null;
        isList = false;
        let parsedVal = rawVal.replace(/^['"]|['"]$/g, "");
        if (parsedVal === "true") parsedVal = true;
        else if (parsedVal === "false") parsedVal = false;
        else if (/^\d+$/.test(parsedVal)) parsedVal = Number(parsedVal);
        data[key] = parsedVal;
      }
    }
  }

  return { data, body };
}

function parseYamlFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const data = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      let val = line.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (val === "true") val = true;
      else if (val === "false") val = false;
      else if (/^\d+$/.test(val)) val = Number(val);
      data[key] = val;
    }
  }
  return data;
}

function exportData() {
  console.log(`[export-content-json] Reading from: ${CONTENT_DIR}`);
  fs.mkdirSync(TARGET_API_DIR, { recursive: true });

  // 1. Kategori
  const katDir = path.join(CONTENT_DIR, "kategori");
  let kategori = [];
  if (fs.existsSync(katDir)) {
    const files = fs.readdirSync(katDir).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    kategori = files.map((file) => {
      const id = file.replace(/\.(yml|yaml)$/, "");
      const data = parseYamlFile(path.join(katDir, file));
      return {
        id,
        nama: data.nama || id,
        urutan: typeof data.urutan === "number" ? data.urutan : 99,
      };
    }).sort((a, b) => a.urutan - b.urutan);
  }

  // 2. Menu
  const menuDir = path.join(CONTENT_DIR, "menu");
  let menu = [];
  if (fs.existsSync(menuDir)) {
    const files = fs.readdirSync(menuDir).filter((f) => f.endsWith(".md"));
    menu = files.map((file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(menuDir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      return {
        id: slug,
        slug,
        nama: data.nama || slug,
        kategori: data.kategori || "kopi",
        harga: Number(data.harga) || 0,
        deskripsi: data.deskripsi || body.slice(0, 160),
        deskripsi_panjang: body || data.deskripsi || "",
        foto: data.foto || "/images/placeholder-coffee.svg",
        ukuran: Array.isArray(data.ukuran) ? data.ukuran : undefined,
        rasa: Array.isArray(data.rasa) ? data.rasa : undefined,
        rekomendasi: Boolean(data.rekomendasi),
        aktif: data.aktif !== false,
      };
    }).filter((m) => m.aktif);
  }

  // 3. Galeri
  const galeriDir = path.join(CONTENT_DIR, "galeri");
  let galeri = [];
  if (fs.existsSync(galeriDir)) {
    const files = fs.readdirSync(galeriDir).filter((f) => f.endsWith(".md"));
    galeri = files.map((file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(galeriDir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      return {
        id: slug,
        judul: data.judul || "Foto Kafe",
        gambar: data.gambar || "/images/placeholder-coffee.svg",
        deskripsi: data.deskripsi || body || "",
        urutan: typeof data.urutan === "number" ? data.urutan : 99,
        sudut_favorit: Boolean(data.sudut_favorit || data.urutan <= 2),
        tag: data.tag || "Atelier Kafe",
      };
    }).sort((a, b) => a.urutan - b.urutan);
  }

  // 4. Promo
  const promoDir = path.join(CONTENT_DIR, "promo");
  let promo = [];
  if (fs.existsSync(promoDir)) {
    const files = fs.readdirSync(promoDir).filter((f) => f.endsWith(".md"));
    promo = files.map((file) => {
      const slug = file.replace(/\.md$/, "");
      const raw = fs.readFileSync(path.join(promoDir, file), "utf8");
      const { data, body } = parseFrontmatter(raw);
      return {
        id: slug,
        judul: data.judul || slug,
        tipe: data.tipe || "promo",
        deskripsi: data.deskripsi || body || "",
        tanggal_selesai: data.tanggal_selesai || "",
        gambar: data.gambar || "",
        aktif: data.aktif !== false,
      };
    }).filter((p) => p.aktif);
  }

  // 5. Info Toko
  const infoPath = path.join(CONTENT_DIR, "info-toko.json");
  let infoToko = {};
  if (fs.existsSync(infoPath)) {
    try {
      infoToko = JSON.parse(fs.readFileSync(infoPath, "utf8"));
    } catch (e) {
      console.error("[export-content-json] Failed to parse info-toko.json:", e);
    }
  }

  // 6. Why Section
  const whyPath = path.join(CONTENT_DIR, "why.json");
  let whyData = { judul: "Betah Berjam-jam. Kenapa Kontrakan?", items: [] };
  if (fs.existsSync(whyPath)) {
    try {
      whyData = JSON.parse(fs.readFileSync(whyPath, "utf8"));
    } catch (e) {
      console.error("[export-content-json] Failed to parse why.json:", e);
    }
  }

  // 7. Status Toko (WIB calculation helper)
  const daysOfWeek = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const wibTime = new Date(utc + 7 * 3600000);
  const currentDay = daysOfWeek[wibTime.getDay()];
  const currentHour = wibTime.getHours();
  const currentMinute = wibTime.getMinutes();
  const currentTimeVal = currentHour * 60 + currentMinute;
  const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

  let isOpen = true;
  let statusText = "BUKA SEKARANG • WAKTU WIB";
  const schedule = Array.isArray(infoToko.jam_buka)
    ? infoToko.jam_buka.find((j) => j.hari === currentDay)
    : null;

  if (schedule) {
    if (schedule.libur) {
      isOpen = false;
      statusText = "TUTUP HARI INI";
    } else {
      const [bukaH, bukaM] = (schedule.buka || "09:00").split(":").map(Number);
      const [tutupH, tutupM] = (schedule.tutup || "23:00").split(":").map(Number);
      const bukaVal = bukaH * 60 + bukaM;
      let tutupVal = tutupH * 60 + tutupM;
      if (tutupVal <= bukaVal) tutupVal += 24 * 60; // Crosses midnight

      if (currentTimeVal >= bukaVal && currentTimeVal < tutupVal) {
        isOpen = true;
        statusText = `BUKA SEKARANG • TUTUP ${schedule.tutup}`;
      } else {
        isOpen = false;
        statusText = `SEDANG TUTUP • BUKA KEMBALI ${schedule.buka}`;
      }
    }
  }

  const statusToko = {
    isOpen,
    pesanStatus: statusText,
    jamHariIni: schedule,
    hariIni: currentDay,
    sekarangJam: currentTimeStr,
  };

  // Helper function to write API file with { data: ... } standard response format
  function writeApiJson(name, data) {
    const payload = JSON.stringify({ success: true, data }, null, 2);
    // 1. /api/<name>.json
    fs.writeFileSync(path.join(TARGET_API_DIR, `${name}.json`), payload);
    // 2. /api/<name>/index.json
    const subDir = path.join(TARGET_API_DIR, name);
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(subDir, "index.json"), payload);
  }

  writeApiJson("kategori", kategori);
  writeApiJson("menu", menu);
  writeApiJson("galeri", galeri);
  writeApiJson("promo", promo);
  writeApiJson("info-toko", infoToko);
  writeApiJson("why", whyData);
  writeApiJson("status-toko", statusToko);

  console.log(`[export-content-json] Successfully generated static API in: ${TARGET_API_DIR}`);
  console.log(`  - Kategori: ${kategori.length} items`);
  console.log(`  - Menu: ${menu.length} items`);
  console.log(`  - Galeri: ${galeri.length} items`);
  console.log(`  - Promo: ${promo.length} items`);
}

exportData();
