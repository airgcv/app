// ==========================================
// MODULE: METER.JS
// ==========================================

let isFilterBelumDicatatActive = false;
let pendingMeterUpdates = {}; // Menyimpan data yang sedang diketik sebelum di-save
let isSavingMassal = false;   // Pengaman agar Ctrl+S / klik ganda tidak memicu simpan paralel

function filterMeterTable() {
  if (isFilterBelumDicatatActive) return;

  const searchVal = document.getElementById("searchMeter").value.toLowerCase();
  const btnClear = document.getElementById("btnClearSearchMeter");

  if (searchVal) {
    btnClear.classList.remove("hidden");
  } else {
    btnClear.classList.add("hidden");
  }

  let filtered = rawListMeter.filter(item => {
    const matchTab = getKategoriTab(item) === activeTabMeter;
    const matchSearch = item.kavling.toLowerCase().includes(searchVal) || 
                        (item.nama && item.nama.toLowerCase().includes(searchVal));
    return matchTab && matchSearch;
  });

  updatePaginationUI('meter', filtered.length);
  const paginatedData = getPaginatedData(filtered, 'meter');
  renderTabelMeter(paginatedData);
}

function clearSearchMeter() {
  isFilterBelumDicatatActive = false;
  document.getElementById("searchMeter").value = "";
  paginationState['meter'].page = 1;
  filterMeterTable();
}

function renderTabelMeter(list) {
  const container = document.getElementById("gridMeterContainer");
  if (!container) return;

  // 🔥 CEK ROLE VIEWER (PENGAWAS) UNTUK MENGUNCI INPUT METER
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  const isViewer = activeSess.role === "Viewer";

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-10 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          Tidak ada data meter untuk filter ini.
      </div>`;
    lucide.createIcons();
    return;
  }

  let html = `
  <div class="col-span-full space-y-4">
    <!-- FLOATING BAR STATUS SIMPAN MASSAL (MELAYANG DI TENGAH BAWAH) -->
    <div id="batchSaveBar" class="hidden fixed bottom-8 left-1/2 transform -translate-x-1/2 z-[100] bg-white border-2 border-blue-500 p-3 rounded-2xl shadow-[0_15px_50px_-10px_rgba(37,99,235,0.4)] flex items-center gap-5 transition-all">
       <div class="text-slate-700 text-xs font-bold flex items-center gap-2">
          <div class="bg-blue-100 text-blue-700 p-2 rounded-xl"><i data-lucide="save" class="w-4 h-4"></i></div>
          <span class="text-sm"><span id="batchSaveCount" class="text-lg font-extrabold text-blue-700 mx-1">0</span> data siap simpan</span>
       </div>
       <button onclick="prosesSimpanMassal()" id="btnSimpanMassal" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 transition-all">
          Simpan Sekarang <span class="bg-blue-800/40 border border-blue-400/30 px-1.5 py-0.5 rounded text-[10px] ml-1">Ctrl + S</span>
       </button>
    </div>

    <!-- TABEL INLINE EDIT -->
    <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="w-full text-xs text-left">
        <thead class="bg-slate-50 uppercase font-bold border-b text-slate-600">
          <tr>
            <th class="py-3 px-3.5 w-16">Kavling</th>
            <th class="py-3 px-3.5 min-w-[170px]">Nama Warga</th>
            <th class="py-3 px-3.5 w-32 text-center whitespace-nowrap">Stand Awal</th>
            <th class="py-3 px-3.5 w-36 whitespace-nowrap">Stand Akhir <span class="text-rose-500">*</span></th>
            <th class="py-3 px-3.5 w-24 text-center">Pemakaian</th>
            <th class="py-3 px-3.5 w-28 text-center" title="Centang jika meteran diganti baru bulan ini">Reset Meter</th>
          </tr>
        </thead>
        <tbody class="divide-y font-medium text-slate-700">
  `;

  list.forEach((item, index) => {
    const isRecorded = item.standAkhir !== "" && item.standAkhir !== null;
    const sAwal = Number(item.standAwal) || 0;
    const sAkhir = isRecorded ? Number(item.standAkhir) : "";
    const pemakaian = isRecorded ? (sAkhir - sAwal) : "-";
    const lockStatus = item.isLockedPast;

    const dataPelanggan = rawListPelanggan.find(p => p.kavling === item.kavling);
    const isNonAktif = dataPelanggan && dataPelanggan.statusKavling && dataPelanggan.statusKavling.toUpperCase() !== 'AKTIF';

    const pending = pendingMeterUpdates[item.kavling];
    const displayAkhir = pending ? pending.standAkhir : sAkhir;
    const isReset = pending ? pending.isReset : false;
    
    let pakaiDisplay = pemakaian;
    if (pending) {
        pakaiDisplay = isReset ? Number(displayAkhir) : (Number(displayAkhir) - sAwal);
        if (pakaiDisplay < 0) pakaiDisplay = 0;
    }

    const rowBg = pending ? "bg-amber-50/40" : (isRecorded ? "bg-emerald-50/10" : "bg-white");
    const nextKavling = index + 1 < list.length ? list[index+1].kavling : "";

    if (lockStatus) {
        html += `
        <tr class="bg-slate-50 opacity-70">
          <td class="py-2.5 px-3.5 font-bold text-slate-500">${item.kavling}</td>
          <td class="py-2.5 px-3.5">
             <div class="truncate max-w-[170px] font-bold text-slate-600">${item.nama}</div>
             <div class="text-[10px] text-slate-400">${item.perumahan}</div>
          </td>
          <td class="py-2.5 px-3.5 text-center font-bold text-slate-500">${sAwal}</td>
          <td class="py-2.5 px-3.5 text-center" colspan="3">
             <div class="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-200/50 rounded-lg text-[10px] font-bold text-slate-500 border border-slate-200">
                <i data-lucide="lock" class="w-3.5 h-3.5"></i> Terkunci (Periode Lewat)
             </div>
          </td>
        </tr>`;
    } else if (isNonAktif) {
        html += `
        <tr class="bg-rose-50/20 opacity-80 hover:bg-rose-50/50 transition-colors">
          <td class="py-2.5 px-3.5 font-bold text-slate-500">${item.kavling}</td>
          <td class="py-2.5 px-3.5">
             <div class="truncate max-w-[170px] font-bold text-slate-500 line-through decoration-rose-300/70" title="${item.nama}">${item.nama}</div>
             <div class="text-[10px] text-slate-400">${item.perumahan}</div>
          </td>
          <td class="py-2.5 px-3.5 text-center font-bold text-slate-400">${sAwal}</td>
          <td class="py-2.5 px-3.5 text-center" colspan="3">
             <div class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 rounded-lg text-[10px] font-bold text-rose-600 border border-rose-200/60 shadow-sm">
                <i data-lucide="user-x" class="w-3.5 h-3.5"></i> Kavling Non-Aktif
             </div>
          </td>
        </tr>`;
    } else {
        html += `
        <tr id="row_${item.kavling}" class="${rowBg} hover:bg-slate-50/80 transition-colors">
          <td class="py-2.5 px-3.5 font-extrabold text-blue-900">${item.kavling}</td>
          <td class="py-2.5 px-3.5">
             <div class="truncate max-w-[170px] font-bold text-slate-800" title="${item.nama}">${item.nama}</div>
             <div class="text-[10px] text-slate-500">${item.perumahan}</div>
          </td>
          <td class="py-2.5 px-3.5 text-center">
             <span class="bg-slate-100 px-2.5 py-1 rounded-md font-bold text-slate-600 border border-slate-200/80 shadow-sm">${sAwal}</span>
          </td>
          <td class="py-2.5 px-3.5">
             <div class="relative">
                <input type="number" 
                       id="inputAkhir_${item.kavling}" 
                       value="${displayAkhir}" 
                       placeholder="..." 
                       ${isViewer ? 'disabled readonly title="Akun Viewer tidak dapat mengubah data meter"' : ''}
                       onkeydown="handleEnter(event, '${nextKavling}')"
                       oninput="hitungInline('${item.kavling}', ${sAwal})"
                       class="w-full border ${isViewer ? 'bg-slate-100 cursor-not-allowed text-slate-500' : (pending ? 'border-amber-400 ring-2 ring-amber-100 bg-white' : (isRecorded ? 'border-emerald-300 bg-white' : 'border-slate-300 bg-slate-50'))} rounded-lg px-3 py-2 text-sm font-bold focus:outline-none transition-all">
                ${pending && !isViewer ? '<i data-lucide="pencil" class="w-3 h-3 text-amber-500 absolute right-2 top-2.5"></i>' : ''}
             </div>
          </td>
          <td class="py-2.5 px-3.5 text-center">
             <span id="txtPakai_${item.kavling}" class="font-extrabold text-sm ${pakaiDisplay > 0 ? 'text-blue-600' : 'text-slate-400'}">${pakaiDisplay !== "-" && pakaiDisplay >= 0 ? pakaiDisplay + ' m³' : '-'}</span>
          </td>
          <td class="py-2.5 px-3.5 text-center">
             <label class="inline-flex items-center ${isViewer ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} p-1.5 hover:bg-rose-50 rounded-lg transition-colors border border-transparent">
               <input type="checkbox" 
                      id="checkReset_${item.kavling}" 
                      ${isReset ? 'checked' : ''}
                      ${isViewer ? 'disabled' : ''}
                      onchange="hitungInline('${item.kavling}', ${sAwal})"
                      class="w-4 h-4 text-rose-500 rounded focus:ring-rose-500 border-slate-300 ${isViewer ? 'cursor-not-allowed' : 'cursor-pointer'}">
             </label>
          </td>
        </tr>`;
    }
  });

  html += `
        </tbody>
      </table>
    </div>
  </div>`;

  container.innerHTML = html;
  lucide.createIcons();
  updateBatchSaveUI();
}

function handleEnter(e, nextKavling) {
  if (e.key === "Enter" || e.keyCode === 13) {
    e.preventDefault();
    if (nextKavling) {
        const nextInput = document.getElementById(`inputAkhir_${nextKavling}`);
        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }
    }
  }
}

function hitungInline(kavling, sAwal) {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return; // Blokir aksi hitung/ketik untuk Viewer

  const inputEl = document.getElementById(`inputAkhir_${kavling}`);
  const checkEl = document.getElementById(`checkReset_${kavling}`);
  const pakaiEl = document.getElementById(`txtPakai_${kavling}`);
  const rowEl = document.getElementById(`row_${kavling}`);
  
  const sAkhirVal = inputEl.value;
  const isReset = checkEl.checked;
  
  const oriData = rawListMeter.find(m => m.kavling === kavling);
  const oriAkhir = oriData && oriData.standAkhir !== null ? String(oriData.standAkhir) : "";

  if (sAkhirVal === "" || sAkhirVal === oriAkhir) {
      delete pendingMeterUpdates[kavling];
      
      const pemakaianAsli = (oriAkhir !== "") ? (Number(oriAkhir) - sAwal) : "-";
      pakaiEl.innerText = pemakaianAsli !== "-" ? pemakaianAsli + " m³" : "-";
      pakaiEl.className = `font-extrabold text-sm ${pemakaianAsli > 0 ? 'text-blue-600' : 'text-slate-400'}`;
      
      inputEl.classList.remove("border-amber-400", "ring-2", "ring-amber-100", "bg-white");
      inputEl.classList.add(oriAkhir !== "" ? "border-emerald-300" : "border-slate-300");
      rowEl.classList.remove("bg-amber-50/40");
      if(oriAkhir !== "") rowEl.classList.add("bg-emerald-50/10");
  } else {
      const sAkhirNum = Number(sAkhirVal);
      let pakai = isReset ? sAkhirNum : (sAkhirNum - sAwal);
      if (pakai < 0) pakai = 0;
      
      pakaiEl.innerText = pakai + " m³";
      pakaiEl.className = "font-extrabold text-sm text-blue-600";
      
      pendingMeterUpdates[kavling] = {
          standAkhir: sAkhirVal,
          isReset: isReset,
          standAwal: sAwal,
          isNewEntry: oriAkhir === "" // Tandai apakah admin mencatat data baru atau mengedit data lama
      };

      inputEl.classList.remove("border-slate-300", "border-emerald-300", "bg-slate-50");
      inputEl.classList.add("border-amber-400", "ring-2", "ring-amber-100", "bg-white");
      rowEl.classList.remove("bg-emerald-50/10", "bg-white");
      rowEl.classList.add("bg-amber-50/40");
  }
  
  updateBatchSaveUI();
}

function updateBatchSaveUI() {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return; // Sembunyikan bar simpan untuk Viewer

  const count = Object.keys(pendingMeterUpdates).length;
  const bar = document.getElementById("batchSaveBar");
  const countText = document.getElementById("batchSaveCount");
  
  isEditingMeter = count > 0;

  if (count > 0) {
      countText.innerText = count;
      bar.classList.remove("hidden");
  } else {
      bar.classList.add("hidden");
  }
}

async function prosesSimpanMassal() {
  if (isSavingMassal) return; // Cegah klik ganda / tekan Ctrl+S berulang saat sedang menyimpan

  const userSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (userSess.role === "Viewer") {
    showToast("Akses ditolak! Akun Viewer (Pengawas) tidak memiliki izin untuk menyimpan data meter.", "error");
    return;
  }

  const kavlingList = Object.keys(pendingMeterUpdates);
  if (kavlingList.length === 0) return;

  isSavingMassal = true;
  const btn = document.getElementById("btnSimpanMassal");
  if (btn) btn.disabled = true;
  
  const namaPetugas = userSess.nama ? userSess.nama : "Admin";
  
  let successCount = 0;
  let failCount = 0;
  let duplicateMessages = [];

  showToast(`Menyimpan ${kavlingList.length} data meter. Harap tunggu...`, "info");

  try {
    for (let i = 0; i < kavlingList.length; i++) {
        const kavling = kavlingList[i];
        const data = pendingMeterUpdates[kavling];
        
        if (btn) {
          btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Menyimpan (${i + 1} dari ${kavlingList.length})...`;
          lucide.createIcons();
        }
        
        if (Number(data.standAkhir) < Number(data.standAwal) && !data.isReset) {
            failCount++;
            continue;
        }

        try {
            const res = await callApi({
              action: "adminUpdateMeter",
              kavling: kavling,
              standAwal: data.standAwal,
              standAkhir: data.standAkhir,
              isResetMeter: data.isReset,
              isNewEntry: !!data.isNewEntry,
              bulanTahun: activePeriodeMeter,
              petugas: namaPetugas
            });
            
            if (res.status === "success") {
                successCount++;
                delete pendingMeterUpdates[kavling];
            } else if (res.status === "duplicate") {
                // Sudah lebih dulu dicatat oleh admin lain -> bersihkan antrean lokal & laporkan
                delete pendingMeterUpdates[kavling];
                duplicateMessages.push(res.message || `Kavling ${kavling} sudah dicatat admin lain.`);
            } else {
                failCount++;
            }
        } catch (e) {
            failCount++;
        }
    }

    if (duplicateMessages.length > 0) {
        const infoPrefix = successCount > 0 ? `${successCount} data tersimpan. ` : "";
        showToast(`${infoPrefix}Dilewati (sudah dicatat admin lain): ${duplicateMessages.join(" | ")}`, "info");
    } else if (failCount === 0) {
        showToast(`Sukses! ${successCount} data meter berhasil disimpan.`, "success");
    } else {
        showToast(`Selesai. ${successCount} berhasil, ${failCount} gagal (Bisa karena Stand Akhir < Stand Awal).`, "error");
    }
  } finally {
    isSavingMassal = false;
    if (btn) {
      btn.innerHTML = `Simpan Sekarang <span class="bg-blue-800/40 border border-blue-400/30 px-1.5 py-0.5 rounded text-[10px] ml-1">Ctrl + S</span>`;
      btn.disabled = false;
    }
    updateBatchSaveUI();
    loadDashboardDataForTab('meter');
  }
}

function exportExcelMeter() {
  if (rawListMeter.length === 0) {
    showToast("Tidak ada data meter untuk diekspor", "info");
    return;
  }
  
  const wsData = rawListMeter.map((item, index) => ({
    "No": index + 1,
    "Kavling": item.kavling,
    "Perumahan": item.perumahan,
    "Nama Warga": item.nama,
    "Periode": item.bulanTahun,
    "Stand Awal": item.standAwal,
    "Stand Akhir": item.standAkhir !== "" ? item.standAkhir : "Belum Dicatat",
    "Pemakaian (m3)": (item.standAkhir !== "" && item.standAkhir !== null) ? (Number(item.standAkhir) - Number(item.standAwal)) : 0,
    "Tgl Update": item.tglUpdate,
    "Petugas": item.petugas
  }));

  const ws = XLSX.utils.json_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data_Meter");
  XLSX.writeFile(wb, `Data_Meter_${activePeriodeMeter}.xlsx`);
}

function filterBelumDicatat() {
  const tabMeterEl = document.getElementById("tabMeter");
  if (tabMeterEl && tabMeterEl.classList.contains("hidden")) {
    showToast("Silakan aktifkan tab 'Catat & Verifikasi Meter' terlebih dahulu untuk filter progress.", "info");
    return;
  }

  if (Object.keys(pendingMeterUpdates).length > 0) {
     showToast("Ada ketikan yang belum di Simpan Massal. Data di layar yang belum disave akan tetap ditahan.", "info");
  }

  switchTab('tabMeter');
  isFilterBelumDicatatActive = true; 
  
  document.querySelectorAll('#containerBlokTabMeter button').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600', 'shadow-sm');
    btn.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
  });

  const belumSelesai = rawListMeter.filter(item => {
    const p = rawListPelanggan.find(x => x.kavling === item.kavling);
    const isNonAktif = p && p.statusKavling && p.statusKavling.toUpperCase() !== 'AKTIF';
    return (item.standAkhir === "" || item.standAkhir === null) && !item.isLockedPast && !isNonAktif;
  });
  
  if (belumSelesai.length === 0) {
    isFilterBelumDicatatActive = false;
    showToast("Luar biasa! Semua meteran Warga Aktif periode ini sudah selesai dicatat.", "success");
    return;
  }
  
  paginationState['meter'].limit = 'all';
  const selectLimit = document.getElementById("selectLimit_meter");
  if (selectLimit) selectLimit.value = 'all';

  updatePaginationUI('meter', belumSelesai.length);
  const paginatedData = getPaginatedData(belumSelesai, 'meter');
  renderTabelMeter(paginatedData);
  
  showToast(`Menampilkan ${belumSelesai.length} kavling belum dicatat (Warga Aktif Saja).`, "info");
}

document.addEventListener('keydown', function(e) {
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
    const bar = document.getElementById("batchSaveBar");
    if (bar && !bar.classList.contains("hidden")) {
      e.preventDefault();
      prosesSimpanMassal();
    }
  }
});