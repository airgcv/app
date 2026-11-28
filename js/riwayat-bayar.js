/**
 * RIWAYAT-BAYAR.JS - Buku Kas, Audit Bukti Transfer & Unduh Struk
 * Mengambil seluruh log dari sheet Riwayat_Cicilan via endpoint getAllRiwayatCicilan
 */

let allRiwayatBayarList = [];
let filteredRiwayatBayarList = [];
let riwayatBayarLoadedOnce = false;
let riwayatBayarInitialPeriodeSet = false;
let currentPageRiwayatBayar = 1;
let limitRiwayatBayar = 25;

function parseTanggalBayarToTs(tglStr, waktuInputStr) {
  let baseTs = 0;
  if (tglStr && tglStr !== "-") {
    const clean = String(tglStr).replace(/'/g, "").trim();
    const parts = clean.split("/");
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10) || 1;
      const m = (parseInt(parts[1], 10) || 1) - 1;
      const y = parseInt(parts[2], 10) || 2000;
      baseTs = new Date(y, m, d).getTime();
    }
  }

  let timeOffset = 0;
  if (waktuInputStr && waktuInputStr !== "-") {
    const wClean = String(waktuInputStr).trim();
    const spaceParts = wClean.split(" ");
    if (spaceParts.length === 2) {
      const tParts = spaceParts[1].split(":");
      const hh = parseInt(tParts[0], 10) || 0;
      const mm = parseInt(tParts[1], 10) || 0;
      timeOffset = (hh * 3600 + mm * 60) * 1000;
    }
  }
  return baseTs + timeOffset;
}

function parsePeriodeBayarToVal(periodeStr) {
  if (!periodeStr || periodeStr === "-") return 0;
  const parts = String(periodeStr).replace(/Aug/i, "Agt").trim().split("-");
  if (parts.length !== 2) return 0;
  const mapBln = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MEI: 4, MAY: 4, JUN: 5,
    JUL: 6, AGT: 7, AGS: 7, AUG: 7, SEP: 8, OKT: 9, OCT: 9, NOV: 10, DES: 11, DEC: 11
  };
  const bIdx = mapBln[parts[0].trim().toUpperCase()];
  const thn = parseInt(parts[1], 10);
  if (bIdx === undefined || isNaN(thn)) return 0;
  return (thn * 12) + bIdx;
}

function extractDriveFileIdBayar(url) {
  if (!url || typeof url !== "string") return "";
  const matchD = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (matchD && matchD[1]) return matchD[1];
  const matchId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (matchId && matchId[1]) return matchId[1];
  return "";
}

function formatRupiahBayar(angka) {
  const num = Number(angka) || 0;
  const absFormatted = Math.abs(num).toLocaleString("id-ID");
  return num < 0 ? `-Rp ${absFormatted}` : `Rp ${absFormatted}`;
}

function escapeHtmlBayar(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getBatchKeyBayar(item) {
  if (item.buktiUrl && item.buktiUrl.startsWith("http")) {
    return "URL_" + item.buktiUrl;
  }
  return "BATCH_" + item.kavling + "_" + item.tglBayar + "_" + item.waktuInput;
}

async function loadRiwayatBayarData(forceRefresh = false) {
  if (riwayatBayarLoadedOnce && !forceRefresh && allRiwayatBayarList.length > 0) {
    filterRiwayatBayarTable();
    return;
  }

  const tbody = document.getElementById("tbodyRiwayatBayar");
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-10 text-center text-slate-400">
          <div class="inline-flex items-center gap-2 font-semibold">
            <i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-600"></i>
            Memuat riwayat pembayaran dari server...
          </div>
        </td>
      </tr>
    `;
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  try {
    const endpointUrl = typeof API_URL !== "undefined" ? API_URL : (window.API_URL || "");
    const secretKey = typeof API_KEY !== "undefined" ? API_KEY : (window.API_KEY || "");

    if (!endpointUrl) {
      throw new Error("Konfigurasi API_URL tidak ditemukan.");
    }

    const res = await fetch(endpointUrl, {
      method: "POST",
      body: JSON.stringify({
        apiKey: secretKey,
        action: "getAllRiwayatCicilan"
      })
    });

    const json = await res.json();
    if (json.status !== "success") {
      throw new Error(json.message || "Gagal mengambil data riwayat pembayaran.");
    }

    const rawList = Array.isArray(json.data) ? json.data : [];

    // Hitung ukuran batch sekali transfer (misal 1 struk dipakai melunasi 3 bulan)
    const batchCounts = {};
    rawList.forEach(item => {
      const bKey = getBatchKeyBayar(item);
      batchCounts[bKey] = (batchCounts[bKey] || 0) + 1;
    });

    allRiwayatBayarList = rawList.map(item => {
      const bKey = getBatchKeyBayar(item);
      return {
        ...item,
        batchKey: bKey,
        batchSize: batchCounts[bKey] || 1,
        tsBayar: parseTanggalBayarToTs(item.tglBayar, item.waktuInput),
        periodeVal: parsePeriodeBayarToVal(item.periode)
      };
    });

    populatePeriodeFilterRiwayatBayar();
    riwayatBayarLoadedOnce = true;
    filterRiwayatBayarTable();
  } catch (err) {
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-8 text-center text-rose-600 font-semibold">
            Gagal memuat riwayat pembayaran: ${escapeHtmlBayar(err.message)}
          </td>
        </tr>
      `;
    }
    if (typeof showToast === "function") {
      showToast("Gagal Memuat", err.message, "error");
    }
  }
}

function populatePeriodeFilterRiwayatBayar() {
  const selectEl = document.getElementById("filterPeriodeRiwayatBayar");
  if (!selectEl) return;

  const currentVal = (selectEl.value || "ALL").toUpperCase();
  const periodeMap = new Map();

  allRiwayatBayarList.forEach(item => {
    if (item.periode && item.periode !== "-") {
      periodeMap.set(item.periode.toUpperCase(), {
        label: item.periode,
        val: item.periodeVal
      });
    }
  });

  const sortedPeriodes = Array.from(periodeMap.values()).sort((a, b) => b.val - a.val);

  let html = `<option value="ALL">Semua Periode (${sortedPeriodes.length})</option>`;
  sortedPeriodes.forEach(p => {
    html += `<option value="${escapeHtmlBayar(p.label.toUpperCase())}">${escapeHtmlBayar(p.label)}</option>`;
  });

  selectEl.innerHTML = html;

  // Default saat pertama kali dibuka: pilih periode terakhir (paling baru)
  if (!riwayatBayarInitialPeriodeSet && sortedPeriodes.length > 0) {
    selectEl.value = sortedPeriodes[0].label.toUpperCase();
    riwayatBayarInitialPeriodeSet = true;
  } else if (Array.from(selectEl.options).some(opt => opt.value === currentVal)) {
    selectEl.value = currentVal;
  }
}

function clearSearchRiwayatBayar() {
  const input = document.getElementById("searchRiwayatBayar");
  if (input) {
    input.value = "";
    filterRiwayatBayarTable();
  }
}

function filterRiwayatBayarTable() {
  const searchInput = document.getElementById("searchRiwayatBayar");
  const btnClear = document.getElementById("btnClearSearchRiwayatBayar");
  const keyword = (searchInput ? searchInput.value : "").trim().toLowerCase();

  if (btnClear) {
    btnClear.classList.toggle("hidden", keyword.length === 0);
  }

  const periodeFilter = (document.getElementById("filterPeriodeRiwayatBayar")?.value || "ALL").toUpperCase();
  const statusFilter = (document.getElementById("filterStatusRiwayatBayar")?.value || "ALL").toLowerCase();
  const buktiFilter = (document.getElementById("filterBuktiRiwayatBayar")?.value || "ALL").toUpperCase();
  const sortMode = document.getElementById("sortRiwayatBayarMode")?.value || "TERBARU_PERIODE";

  filteredRiwayatBayarList = allRiwayatBayarList.filter(item => {
    if (keyword) {
      const hay = `${item.kavling} ${item.nama} ${item.periode} ${item.idCicilan} ${item.keterangan} ${item.tglBayar}`.toLowerCase();
      if (!hay.includes(keyword)) return false;
    }

    if (periodeFilter !== "ALL") {
      if ((item.periode || "").toUpperCase() !== periodeFilter) return false;
    }

    if (statusFilter !== "all") {
      if ((item.statusHasil || "").toLowerCase() !== statusFilter) return false;
    }

    if (buktiFilter !== "ALL") {
      const hasUrl = item.buktiUrl && item.buktiUrl.startsWith("http");
      const isDeposit = (item.buktiUrl || "").toLowerCase().includes("deposit") || (item.keterangan || "").toLowerCase().includes("deposit");
      if (buktiFilter === "ADA_BUKTI" && !hasUrl) return false;
      if (buktiFilter === "DEPOSIT" && !isDeposit) return false;
      if (buktiFilter === "TANPA_BUKTI" && (hasUrl || isDeposit)) return false;
    }

    return true;
  });

  // Pengurutan: Transaksi terakhir di atas -> terlama (mengikuti Periode tagihan)
  filteredRiwayatBayarList.sort((a, b) => {
    if (sortMode === "PERIODE_TERBARU") {
      if (b.periodeVal !== a.periodeVal) return b.periodeVal - a.periodeVal;
      if (b.tsBayar !== a.tsBayar) return b.tsBayar - a.tsBayar;
      return (b.rowIndex || 0) - (a.rowIndex || 0);
    }

    // Default: Transaksi terakhir (tanggal & waktu bayar terbaru), lalu periode tagihan terbaru -> terlama
    if (b.tsBayar !== a.tsBayar) return b.tsBayar - a.tsBayar;
    if (b.periodeVal !== a.periodeVal) return b.periodeVal - a.periodeVal;
    return (b.rowIndex || 0) - (a.rowIndex || 0);
  });

  updateSummaryRiwayatBayar();
  currentPageRiwayatBayar = 1;
  renderRiwayatBayarTable();
}

function updateSummaryRiwayatBayar() {
  let totalNetto = 0;
  let countLunas = 0;
  let countCicil = 0;
  let countBatal = 0;
  let countBukti = 0;
  let countDeposit = 0;

  filteredRiwayatBayarList.forEach(item => {
    const nom = Number(item.nominalBayar) || 0;
    const st = (item.statusHasil || "").toLowerCase();
    totalNetto += nom;

    if (st === "dibatalkan" || nom < 0) {
      countBatal++;
    } else if (st === "dicicil") {
      countCicil++;
    } else {
      countLunas++;
    }

    if (item.buktiUrl && item.buktiUrl.startsWith("http")) {
      countBukti++;
    } else if ((item.buktiUrl || "").toLowerCase().includes("deposit")) {
      countDeposit++;
    }
  });

  const elTotal = document.getElementById("rbStatTotalMasuk");
  const elCount = document.getElementById("rbStatCountTransaksi");
  const elLunasCicil = document.getElementById("rbStatLunasCicil");
  const elBatal = document.getElementById("rbStatBatalCount");
  const elBukti = document.getElementById("rbStatBuktiCount");

  if (elTotal) elTotal.textContent = formatRupiahBayar(totalNetto);
  if (elCount) elCount.textContent = `${filteredRiwayatBayarList.length} catatan mutasi ditampilkan`;
  if (elLunasCicil) elLunasCicil.textContent = `${countLunas} Lunas • ${countCicil} Cicilan`;
  if (elBatal) elBatal.textContent = `${countBatal} transaksi pembatalan`;
  if (elBukti) elBukti.textContent = `${countBukti} Struk Transfer • ${countDeposit} Deposit`;
}

function renderRiwayatBayarTable() {
  const tbody = document.getElementById("tbodyRiwayatBayar");
  const infoPage = document.getElementById("infoPage_riwayatBayar");
  const btnPrev = document.getElementById("btnPrev_riwayatBayar");
  const btnNext = document.getElementById("btnNext_riwayatBayar");

  if (!tbody) return;

  const totalItems = filteredRiwayatBayarList.length;
  if (totalItems === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-10 text-center text-slate-400">
          Tidak ada riwayat transaksi pembayaran yang sesuai dengan filter.
        </td>
      </tr>
    `;
    if (infoPage) infoPage.textContent = "Hal 0 dari 0";
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  const perPage = limitRiwayatBayar === "all" ? totalItems : Number(limitRiwayatBayar) || 25;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  if (currentPageRiwayatBayar > totalPages) currentPageRiwayatBayar = totalPages;

  const startIdx = (currentPageRiwayatBayar - 1) * perPage;
  const pageData = filteredRiwayatBayarList.slice(startIdx, startIdx + perPage);

  const rowsHtml = pageData.map((item, idx) => {
    const globalIdx = startIdx + idx;
    const nom = Number(item.nominalBayar) || 0;
    const sisa = Number(item.sisaSesudah) || 0;
    const st = (item.statusHasil || "-").trim();
    const stLower = st.toLowerCase();

    let badgeStatus = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">${escapeHtmlBayar(st)}</span>`;
    if (stLower === "lunas" || stLower === "pemutihan denda") {
      badgeStatus = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">${escapeHtmlBayar(st)}</span>`;
    } else if (stLower === "dicicil") {
      badgeStatus = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Dicicil</span>`;
    } else if (stLower === "dibatalkan") {
      badgeStatus = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">Dibatalkan</span>`;
    }

    const nomClass = nom < 0 ? "text-rose-600" : "text-emerald-700";
    const batchBadge = item.batchSize > 1
      ? `<span class="ml-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200/80 text-[9px] font-bold" title="Dibayar dalam 1 paket transfer bersama ${item.batchSize} periode">Paket ${item.batchSize} Bln</span>`
      : "";

    let aksiBuktiHtml = `<span class="text-[11px] text-slate-400">-</span>`;
    if (item.buktiUrl && item.buktiUrl.startsWith("http")) {
      const fileId = extractDriveFileIdBayar(item.buktiUrl);
      const downloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : item.buktiUrl;
      aksiBuktiHtml = `
        <div class="inline-flex items-center justify-center gap-1.5">
          <button type="button" onclick="openPreviewBuktiBayar(${globalIdx})" class="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 text-[11px] font-bold inline-flex items-center gap-1 transition-all" title="Pratinjau Bukti Transfer">
            <i data-lucide="eye" class="w-3 h-3"></i> Bukti
          </button>
          <a href="${escapeHtmlBayar(downloadUrl)}" target="_blank" rel="noopener" class="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 inline-flex items-center justify-center transition-all" title="Unduh Bukti Transfer">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
          </a>
        </div>
      `;
    } else if ((item.buktiUrl || "").toLowerCase().includes("deposit")) {
      aksiBuktiHtml = `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200/70 text-[10px] font-bold">
          <i data-lucide="wallet" class="w-3 h-3"></i> Saldo Deposit
        </span>
      `;
    }

    return `
      <tr data-batch-key="${escapeHtmlBayar(item.batchKey)}"
          onmouseenter="highlightBatchBayar(this.dataset.batchKey, true)"
          onmouseleave="highlightBatchBayar(this.dataset.batchKey, false)"
          class="rb-row hover:bg-slate-50/90 transition-colors">
        <td class="py-2.5 px-3.5 whitespace-nowrap">
          <div class="font-bold text-slate-800">${escapeHtmlBayar(item.tglBayar || "-")}</div>
          <div class="text-[10px] text-slate-400">${escapeHtmlBayar(item.waktuInput ? item.waktuInput.split(" ")[1] || "" : "")}</div>
        </td>
        <td class="py-2.5 px-3.5 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-extrabold">${escapeHtmlBayar(item.kavling)}</span>
        </td>
        <td class="py-2.5 px-3.5 font-semibold text-slate-800">
          ${escapeHtmlBayar(item.nama)}
        </td>
        <td class="py-2.5 px-3.5 whitespace-nowrap">
          <span class="font-bold text-blue-700">${escapeHtmlBayar(item.periode)}</span>
        </td>
        <td class="py-2.5 px-3.5 text-right font-extrabold whitespace-nowrap ${nomClass}">
          ${formatRupiahBayar(nom)}
        </td>
        <td class="py-2.5 px-3.5 text-right font-semibold text-slate-600 whitespace-nowrap">
          ${formatRupiahBayar(sisa)}
        </td>
        <td class="py-2.5 px-3.5 text-center whitespace-nowrap">
          ${badgeStatus}
        </td>
        <td class="py-2.5 px-3.5 text-slate-600 text-[11px]">
          <span>${escapeHtmlBayar(item.keterangan)}</span>${batchBadge}
        </td>
        <td class="py-2.5 px-3.5 text-center whitespace-nowrap">
          ${aksiBuktiHtml}
        </td>
      </tr>
    `;
  }).join("");

  tbody.innerHTML = rowsHtml;

  if (infoPage) infoPage.textContent = `Hal ${currentPageRiwayatBayar} dari ${totalPages} (${totalItems} data)`;
  if (btnPrev) btnPrev.disabled = currentPageRiwayatBayar <= 1;
  if (btnNext) btnNext.disabled = currentPageRiwayatBayar >= totalPages;

  if (typeof lucide !== "undefined") lucide.createIcons();
}

function highlightBatchBayar(batchKey, isHover) {
  if (!batchKey) return;
  const rows = document.querySelectorAll("#tbodyRiwayatBayar tr.rb-row");
  rows.forEach(tr => {
    if (tr.dataset.batchKey === batchKey) {
      tr.classList.toggle("bg-blue-50/70", isHover);
    }
  });
}

function changeLimitRiwayatBayar(val) {
  limitRiwayatBayar = val === "all" ? "all" : Number(val) || 25;
  currentPageRiwayatBayar = 1;
  renderRiwayatBayarTable();
}

function changePageRiwayatBayar(delta) {
  currentPageRiwayatBayar += delta;
  if (currentPageRiwayatBayar < 1) currentPageRiwayatBayar = 1;
  renderRiwayatBayarTable();
}

function openPreviewBuktiBayar(filteredIndex) {
  const item = filteredRiwayatBayarList[filteredIndex];
  if (!item || !item.buktiUrl || !item.buktiUrl.startsWith("http")) return;

  const fileId = extractDriveFileIdBayar(item.buktiUrl);
  const previewUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : item.buktiUrl;
  const downloadUrl = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : item.buktiUrl;

  document.getElementById("pvBuktiSubtitle").textContent = item.keterangan || "Bukti Pembayaran Tagihan Air";
  document.getElementById("pvBuktiWarga").textContent = `${item.kavling} — ${item.nama}`;
  document.getElementById("pvBuktiPeriode").textContent = item.periode || "-";
  document.getElementById("pvBuktiTgl").textContent = item.tglBayar || "-";
  document.getElementById("pvBuktiNominal").textContent = formatRupiahBayar(item.nominalBayar);
  document.getElementById("pvBuktiId").textContent = `ID Transaksi: ${item.idCicilan || "-"}`;

  const iframe = document.getElementById("pvBuktiIframe");
  const openTab = document.getElementById("pvBuktiOpenTab");
  const btnDownload = document.getElementById("pvBuktiDownload");

  if (iframe) iframe.src = previewUrl;
  if (openTab) openTab.href = item.buktiUrl;
  if (btnDownload) btnDownload.href = downloadUrl;

  const modal = document.getElementById("modalPreviewBukti");
  if (modal) modal.classList.remove("hidden");
  if (typeof lucide !== "undefined") lucide.createIcons();
}

function closeModalPreviewBukti() {
  const modal = document.getElementById("modalPreviewBukti");
  const iframe = document.getElementById("pvBuktiIframe");
  if (iframe) iframe.src = "";
  if (modal) modal.classList.add("hidden");
}

function exportExcelRiwayatBayar() {
  if (!filteredRiwayatBayarList || filteredRiwayatBayarList.length === 0) {
    if (typeof showToast === "function") {
      showToast("Data Kosong", "Tidak ada data riwayat pembayaran untuk diexport.", "warning");
    }
    return;
  }

  const rows = filteredRiwayatBayarList.map((item, i) => ({
    "No": i + 1,
    "ID Transaksi": item.idCicilan,
    "Tanggal Bayar": item.tglBayar,
    "Waktu Input": item.waktuInput,
    "Kavling": item.kavling,
    "Nama Warga": item.nama,
    "Periode Tagihan": item.periode,
    "Nominal Dibayar (Rp)": Number(item.nominalBayar) || 0,
    "Sisa Sebelum (Rp)": Number(item.sisaSebelum) || 0,
    "Sisa Akhir (Rp)": Number(item.sisaSesudah) || 0,
    "Status": item.statusHasil,
    "Keterangan": item.keterangan,
    "Link Bukti": item.buktiUrl
  }));

  if (typeof XLSX !== "undefined") {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat_Bayar");
    const tglFile = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Riwayat_Pembayaran_Air_GCV_${tglFile}.xlsx`);
  }
}