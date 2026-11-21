// ==========================================
// MODULE: TAGIHAN.JS (DENGAN SMART DEDUCTION DEPOSIT & HIDE UPLOAD BUKTI OTOMATIS)
// ==========================================

let isFilterBelumBayarActive = false;
let currentSortColumn = null;
let currentSortDirection = 'desc'; 
let windowGlobalListTunggakan = [];
let activeDepositSaldo = 0; // Menyimpan saldo deposit aktif warga di modal pembayaran

function checkBuktiTransferReady() {
  const fileInput = document.getElementById("multiInputBukti");
  const btnSubmit = document.getElementById("btnSubmitMultiBayar");
  const checkDeposit = document.getElementById("checkGunakanDeposit");
  if (!btnSubmit) return;

  const isDepositChecked = checkDeposit ? checkDeposit.checked : false;
  const hasFile = fileInput && fileInput.files && fileInput.files.length > 0;

  // Tombol simpan aktif jika file diupload ATAU opsi potong deposit dicentang
  // (Meskipun saldo deposit kurang, tombol TETAP AKTIF karena sisa akan dihitung sbg cicilan)
  if (hasFile || isDepositChecked) {
    btnSubmit.disabled = false;
    btnSubmit.classList.remove("opacity-50", "cursor-not-allowed");
  } else {
    btnSubmit.disabled = true;
    btnSubmit.classList.add("opacity-50", "cursor-not-allowed");
  }
}

// Fungsi baru untuk menyembunyikan/menampilkan kolom upload bukti transfer secara dinamis
function updateVisibilityBuktiTransfer() {
  const checkDeposit = document.getElementById("checkGunakanDeposit");
  const wrapperUpload = document.getElementById("wrapperUploadBukti");
  const fileInput = document.getElementById("multiInputBukti");

  if (checkDeposit && checkDeposit.checked) {
    if (wrapperUpload) wrapperUpload.classList.add("hidden");
    if (fileInput) fileInput.value = ""; // Reset file jika opsi deposit dicentang
  } else {
    if (wrapperUpload) wrapperUpload.classList.remove("hidden");
  }
  checkBuktiTransferReady();
}

function filterTagihanTable() {
  if (isFilterBelumBayarActive) return; 

  const searchInput = document.getElementById("searchTagihan");
  if (!searchInput) return;
  const searchVal = searchInput.value.toLowerCase().trim();
  const btnClear = document.getElementById("btnClearSearchTagihan");

  if (searchVal.length > 0) btnClear.classList.remove("hidden");
  else btnClear.classList.add("hidden");

  const filtered = rawListTagihan.filter(t => {
    const matchSearch = String(t.kavling).toLowerCase().includes(searchVal) || String(t.nama).toLowerCase().includes(searchVal);
    const matchTab = getKategoriTab(t) === activeTabTagihan;
    
    const tPeriodeNorm = String(t.bulanTahun || "").replace(/Aug/i, "Agt").trim().toLowerCase();
    const activePeriodeNorm = String(activePeriodeTagihan || "").replace(/Aug/i, "Agt").trim().toLowerCase();
    const matchPeriode = tPeriodeNorm === activePeriodeNorm;

    return matchSearch && matchTab && matchPeriode;
  });

  renderTagihanTable(filtered);
}

function clearSearchTagihan() {
  isFilterBelumBayarActive = false; 
  document.getElementById("searchTagihan").value = "";
  filterTagihanTable();
}

function renderTagihanTable(list) {
  const tbodyTagihan = document.getElementById("tbodyTagihan");
  if (!tbodyTagihan) return;

  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  const isViewer = activeSess.role === "Viewer";

  updatePaginationUI('tagihan', list.length);
  const paginatedList = getPaginatedData(list, 'tagihan');

  if (paginatedList && paginatedList.length > 0) {
    tbodyTagihan.innerHTML = paginatedList.map(t => {
      const isWaEmpty = !t.noWa || t.noWa.trim() === "" || t.noWa === "-";
      let tunggakanSebelumnya = Number(t.tunggakanSebelumnya) || 0;

      const statusLower = (t.statusBayar || "").toLowerCase();
      const isLunas = statusLower === 'lunas' || statusLower === 'pemutihan denda';
      const isDicicil = statusLower === 'dicicil';

      let htmlTotalTagihan = `<span class="font-bold ${isLunas ? 'text-emerald-600' : 'text-slate-900'}">${t.totalFormatted}</span>`;
      
      if (isDicicil) {
        htmlTotalTagihan += `<br><span class="inline-block mt-0.5 text-[10px] text-rose-500 font-medium">Sisa: ${t.sisaFormatted}</span>`;
      } else if (tunggakanSebelumnya > 0) {
        const formatTunggakan = new Intl.NumberFormat('id-ID').format(tunggakanSebelumnya);
        htmlTotalTagihan += `<br><span class="inline-block mt-0.5 text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/70" title="Nominal Tunggakan Sebelumnya">Rp ${formatTunggakan}</span>`;
      }

      let statusBadgeHtml = `<span class="inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold ${
        isLunas 
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
          : (isDicicil 
              ? 'bg-amber-50 text-amber-800 border border-amber-200' 
              : 'bg-rose-50 text-rose-700 border border-rose-200')
      }">
        ${t.statusBayar}
      </span>`;

      const hasPdf = t.linkPdf && t.linkPdf !== "-" && t.linkPdf.startsWith("http");
      const isWaSent = (t.statusWa || "").toUpperCase() === "SUDAH";

      let waBtnClass = "";
      let waBtnTitle = "";
      let waDisabled = false;

      if (!hasPdf) {
        waBtnClass = "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60";
        waBtnTitle = "PDF Belum Digenerate!";
        waDisabled = true;
      } else if (isWaEmpty) {
        waBtnClass = "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60";
        waBtnTitle = "Nomor WA warga belum diisi";
        waDisabled = true;
      } else if (isWaSent) {
        waBtnClass = "bg-blue-600 hover:bg-blue-700 text-white shadow-sm";
        waBtnTitle = "Pesan WA sudah dikirim";
      } else {
        waBtnClass = "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm";
        waBtnTitle = "Kirim Tagihan via WhatsApp";
      }

      return `
        <tr>
          <td class="py-1.5 px-3.5 font-bold">${t.kavling}</td>
          <td class="py-1.5 px-3.5 text-slate-600 font-semibold truncate max-w-[8rem]">${t.perumahan || 'The Green City View'}</td>
          <td class="py-1.5 px-3.5 font-semibold text-slate-900 truncate max-w-[170px]" title="${t.nama}">${t.nama}</td>
          <td class="py-1.5 px-3.5">${t.bulanTahun}</td>
          <td class="py-1.5 px-3.5 text-right">${htmlTotalTagihan}</td>
          <td class="py-1.5 px-3.5">${statusBadgeHtml}</td>

          <td class="py-1.5 px-3.5 text-center">
            <div class="inline-flex items-center gap-1">
              <button onclick='bukaModalDetail(${JSON.stringify(t)})' class="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 p-1.5 rounded-lg font-semibold inline-flex items-center justify-center text-xs transition-all" title="Lihat Rincian Detail Tagihan">
                <i data-lucide="eye" class="w-3.5 h-3.5"></i>
              </button>

              <button onclick="downloadPdf('${t.kavling}', '${t.bulanTahun}')" class="bg-slate-900 hover:bg-slate-800 text-white p-1.5 rounded-lg font-semibold inline-flex items-center justify-center text-xs shadow-sm" title="Download PDF">
                <i data-lucide="download" class="w-3.5 h-3.5"></i>
              </button>

              ${isViewer ? `
                <span class="text-slate-400 text-[10px] font-medium ml-1">View Only</span>
              ` : `
                <button onclick="openModalKelolaDenda('${t.kavling}')" class="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 p-1.5 rounded-lg font-semibold inline-flex items-center justify-center text-xs transition-all" title="Kelola / Hapus Denda Warga">
                  <i data-lucide="eraser" class="w-3.5 h-3.5"></i>
                </button>

                ${(isLunas || isDicicil) ? `
                <button onclick="bukaModalBatalPintar('${t.kavling}')" class="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 p-1.5 rounded-lg font-semibold inline-flex items-center justify-center text-xs transition-all" title="Batalkan Transaksi">
                  <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                </button>
                ` : ''}
                
                ${!isLunas ? `
                <button onclick="openModalMultiBayar('${t.kavling}')" class="bg-emerald-600 hover:bg-emerald-700 text-white p-1.5 rounded-lg font-semibold inline-flex items-center justify-center text-xs shadow-sm transition-all" title="Proses Pembayaran">
                  <i data-lucide="check-square" class="w-3.5 h-3.5"></i>
                </button>
                ` : ''}
                
                <button ${waDisabled ? 'disabled' : ''} onclick='kirimWaTagihan(${JSON.stringify(t)}, this)' class="${waBtnClass} p-1.5 rounded-lg font-semibold inline-flex items-center justify-center text-xs transition-all" title="${waBtnTitle}">
                  <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                </button>
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } else {
    tbodyTagihan.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-400">Tidak ada data di tab ini.</td></tr>`;
  }
  lucide.createIcons();
}

function openModalKelolaDenda(kavling) {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  activeDendaKavling = kavling;
  let tagihanKavling = rawListTagihan.filter(t => t.kavling.toUpperCase() === kavling.toUpperCase());
  
  if (tagihanKavling.length === 0) {
    showToast("Tidak ada data tagihan untuk kavling " + kavling, "info");
    return;
  }

  tagihanKavling.sort((a, b) => parseBulanTahunToDate(a.bulanTahun) - parseBulanTahunToDate(b.bulanTahun));

  let rowDataList = tagihanKavling.map(t => {
    let dendaVal = t.biayaDenda !== "" && t.biayaDenda !== "-" ? Number(t.biayaDenda) : 0;
    return {
      idTagihan: t.idTagihan,
      bulanTahun: t.bulanTahun,
      statusBayar: t.statusBayar,
      totalFormatted: t.totalFormatted,
      dendaVal: dendaVal
    };
  });

  const namaWarga = tagihanKavling[0].nama || "-";
  document.getElementById("dendaTargetKavlingNama").innerText = `${kavling} - ${namaWarga}`;

  const container = document.getElementById("containerListCheckboxDenda");
  container.innerHTML = rowDataList.map((t) => {
    let totalDendaEfektif = t.dendaVal;
    return `
      <div class="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
        <label class="flex items-center gap-2.5 cursor-pointer flex-1">
          <input type="checkbox" class="checkbox-denda w-4 h-4 text-amber-600 rounded focus:ring-amber-500" value="${t.idTagihan}" ${totalDendaEfektif > 0 ? 'checked' : ''} onchange="hitungTotalDendaTerpilih()">
          <div>
            <span class="font-bold text-slate-800 block">Periode: ${t.bulanTahun}</span>
            <span class="text-[10px] text-slate-500">Status: ${t.statusBayar}</span>
          </div>
        </label>
        <div class="text-right">
          <span class="font-bold ${totalDendaEfektif > 0 ? 'text-rose-600' : 'text-slate-400'} block">
            Denda: Rp ${new Intl.NumberFormat('id-ID').format(totalDendaEfektif)}
          </span>
          <span class="text-[10px] text-slate-400">Total: ${t.totalFormatted}</span>
        </div>
      </div>
    `;
  }).join('');

  hitungTotalDendaTerpilih();
  document.getElementById("modalKelolaDenda").classList.remove("hidden");
  lucide.createIcons();
}

function closeModalKelolaDenda() {
  document.getElementById("modalKelolaDenda").classList.add("hidden");
  activeDendaKavling = null;
}

function toggleSelectAllDenda(btn) {
  const checkboxes = document.querySelectorAll(".checkbox-denda");
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => cb.checked = !allChecked);
  btn.innerText = allChecked ? "Pilih Semua" : "Batalkan Semua";
  hitungTotalDendaTerpilih();
}

function hitungTotalDendaTerpilih() {
  const checkboxes = document.querySelectorAll(".checkbox-denda:checked");
  document.getElementById("dendaTotalTerpilihCount").innerText = `${checkboxes.length} Periode Dipilih`;
}

async function submitHapusDendaMassalWarga() {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  const checkboxes = document.querySelectorAll(".checkbox-denda:checked");
  if (checkboxes.length === 0) {
    showToast("Pilih minimal satu periode tagihan!", "error");
    return;
  }

  const listIdTagihan = Array.from(checkboxes).map(cb => cb.value);
  closeModalKelolaDenda();
  showToast("Menghapus denda pada periode terpilih...", "info");

  let listPembayaranDenda = listIdTagihan.map(id => ({ idTagihan: id, nominalBayar: 0 }));

  const res = await callApi({
    action: "updateMultiStatusBayar",
    listPembayaran: listPembayaranDenda,
    statusBayar: "KeepStatus", 
    tglBayar: "-",
    opsiDenda: "C" 
  });

  if (res.status === "success") {
    showToast("Denda berhasil dihapus untuk periode terpilih!", "success");
    loadDashboardDataForTab('tagihan');
  } else {
    showToast(res.message || "Gagal menghapus denda.", "error");
  }
}

function bukaModalDetail(t) {
  currentIdTagihanModal = t.idTagihan; 
  
  const wrapEdit = document.getElementById("wrapperEditDendaKecil");
  if (wrapEdit) wrapEdit.classList.add("hidden");
  
  const wrapKoreksi = document.getElementById("wrapperKoreksiManual");
  if (wrapKoreksi) wrapKoreksi.classList.add("hidden");

  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  const btnEditDendaTrigger = document.querySelector("button[onclick='bukaFormEditDendaDetail()']");
  if (btnEditDendaTrigger) {
    btnEditDendaTrigger.style.display = activeSess.role === "Viewer" ? 'none' : 'inline-flex';
  }

  document.getElementById("dtlKavlingNama").innerText = `${t.kavling} - ${t.nama}`;
  document.getElementById("dtlPeriode").innerText = t.bulanTahun;
  
  const statusLower = (t.statusBayar || "").toLowerCase();
  const isLunas = statusLower === 'lunas' || statusLower === 'pemutihan denda';
  const isDicicil = statusLower === 'dicicil';

  const elStatus = document.getElementById("dtlStatusBayar");
  if (elStatus) {
    elStatus.innerHTML = `<span class="inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
      isLunas 
        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
        : (isDicicil 
            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
            : 'bg-rose-100 text-rose-800 border border-rose-200')
    }">${t.statusBayar || 'Belum Bayar'}</span>`;
  }

  const wrapTgl = document.getElementById("wrapperDtlTglBayar");
  const elTgl = document.getElementById("dtlTglBayar");
  const valTglBayar = (t.tanggalBayar || t.tglBayar || t.tglLunas || "").trim();

  if (wrapTgl && elTgl) {
    if (valTglBayar !== "" && valTglBayar !== "-") {
      elTgl.innerText = valTglBayar;
    } else {
      elTgl.innerText = "-";
    }
    wrapTgl.classList.remove("hidden");
  }

  const wrapBukti = document.getElementById("wrapperDtlBukti");
  const btnBukti = document.getElementById("dtlBuktiLink");
  
  if (wrapBukti && btnBukti) {
    if (t.buktiUrl && t.buktiUrl !== "-" && t.buktiUrl.startsWith("http")) {
      btnBukti.href = t.buktiUrl;
      btnBukti.target = "_blank";
      btnBukti.innerHTML = '<i data-lucide="external-link" class="w-3.5 h-3.5"></i> Lihat Bukti';
      btnBukti.className = "bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1.5 transition-all";
      wrapBukti.classList.remove("hidden");
      wrapBukti.classList.add("flex");
    } else if (t.buktiUrl && t.buktiUrl.toLowerCase().includes("deposit")) {
      btnBukti.removeAttribute("href");
      btnBukti.target = "";
      btnBukti.innerHTML = '<i data-lucide="wallet" class="w-3.5 h-3.5"></i> Via Saldo Deposit';
      btnBukti.className = "bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1.5 border border-emerald-200 cursor-default";
      wrapBukti.classList.remove("hidden");
      wrapBukti.classList.add("flex");
    } else {
      wrapBukti.classList.add("hidden");
      wrapBukti.classList.remove("flex");
    }
  }

  document.getElementById("dtlStandMeter").innerText = `${t.standAwal} - ${t.standAkhir} m³`;
  document.getElementById("dtlPemakaian").innerText = `${t.pemakaianM3} m³`;
  document.getElementById("dtlAbodemen").innerText = "Rp " + new Intl.NumberFormat('id-ID').format(t.biayaAbodemen);
  document.getElementById("dtlBiayaPemakaian").innerText = "Rp " + new Intl.NumberFormat('id-ID').format(t.biayaPemakaian);
  
  let dendaVal = Number(t.biayaDenda) || 0;
  document.getElementById("dtlDenda").innerText = "Rp " + new Intl.NumberFormat('id-ID').format(dendaVal);
  document.getElementById("dtlSubtotal").innerText = t.totalFormatted;

  const tglPeriodeAktif = parseBulanTahunToDate(t.bulanTahun);

  const tunggakanLaluList = rawListTagihan.filter(item => {
    if (item.kavling.toUpperCase() !== t.kavling.toUpperCase()) return false;
    const stLower = (item.statusBayar || "").toLowerCase();
    const isBelumLunas = stLower !== "lunas" && stLower !== "pemutihan denda";
    const tglItem = parseBulanTahunToDate(item.bulanTahun);
    return isBelumLunas && tglItem < tglPeriodeAktif;
  }).sort((a, b) => parseBulanTahunToDate(b.bulanTahun) - parseBulanTahunToDate(a.bulanTahun));

  const boxTunggakan = document.getElementById("dtlBoxTunggakan");
  const listContainer = document.getElementById("dtlListRincianTunggakan");

  let totalTunggakanLalu = 0;

  if (tunggakanLaluList.length > 0) {
    let htmlRincian = "";
    tunggakanLaluList.forEach(item => {
      const stLower = (item.statusBayar || "").toLowerCase();
      let sisaNominal = stLower === 'dicicil' ? (item.sisaTagihan || item.totalTagihan) : item.totalTagihan;
      totalTunggakanLalu += sisaNominal;

      let badgeStatus = stLower === 'dicicil' 
        ? `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">Dicicil</span>`
        : `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">Belum Bayar</span>`;

      htmlRincian += `
        <div class="grid grid-cols-12 items-center py-1 px-2 rounded bg-white/80 border border-rose-100 hover:bg-white transition-all">
          <div class="col-span-4 font-bold text-slate-800">${item.bulanTahun}</div>
          <div class="col-span-4 text-left">${badgeStatus}</div>
          <div class="col-span-4 text-right font-extrabold text-rose-600">Rp ${new Intl.NumberFormat('id-ID').format(sisaNominal)}</div>
        </div>
      `;
    });

    listContainer.innerHTML = htmlRincian;
    document.getElementById("dtlNominalTunggakan").innerText = "Rp " + new Intl.NumberFormat('id-ID').format(totalTunggakanLalu);
    boxTunggakan.classList.remove("hidden");
  } else {
    boxTunggakan.classList.add("hidden");
    if (listContainer) listContainer.innerHTML = "";
  }

  let subtotalBulanIni = t.totalTagihan || 0;
  let totalSeluruhnya = subtotalBulanIni + totalTunggakanLalu;
  document.getElementById("dtlTotalKeseluruhan").innerText = "Rp " + new Intl.NumberFormat('id-ID').format(totalSeluruhnya);

  document.getElementById("modalDetailTagihan").classList.remove("hidden");
  lucide.createIcons();
}

function closeModalDetail() {
  document.getElementById("modalDetailTagihan").classList.add("hidden");
  currentIdTagihanModal = null;
}

function bukaFormEditDendaDetail() {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  const wrap = document.getElementById("wrapperEditDendaKecil");
  if (wrap) {
    wrap.classList.toggle("hidden");
    if (!wrap.classList.contains("hidden")) {
      document.getElementById("inputEditDendaKecil").focus();
    }
  }
}

async function simpanEditDendaDetail() {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  const inputVal = Number(document.getElementById("inputEditDendaKecil").value) || 0;
  if (!currentIdTagihanModal) {
    showToast("ID Tagihan tidak ditemukan.", "error");
    return;
  }

  showToast("Menyesuaikan denda...", "info");

  const tagihanAktif = rawListTagihan.find(t => t.idTagihan === currentIdTagihanModal);
  const statusBayarSekarang = tagihanAktif ? tagihanAktif.statusBayar : "Belum Bayar";
  const tglBayarSekarang = tagihanAktif ? (tagihanAktif.tanggalBayar || tagihanAktif.tglBayar || "-") : "-";

  const res = await callApi({
    action: "updateStatusBayar",
    idTagihan: currentIdTagihanModal,
    statusBayar: statusBayarSekarang, 
    tglBayar: tglBayarSekarang,
    opsiDenda: inputVal === 0 ? "C" : "B" 
  });

  if (res.status === "success") {
    showToast("Denda berhasil disesuaikan!", "success");
    closeModalDetail();
    loadDashboardDataForTab('tagihan');
  } else {
    showToast(res.message || "Gagal memperbarui denda.", "error");
  }
}

function sortTableTunggakan(column) {
  if (currentSortColumn === column) {
    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortColumn = column;
    currentSortDirection = 'desc'; 
  }

  ['kavling', 'nominal', 'durasi'].forEach(col => {
    const iconSpan = document.getElementById(`sort-icon-${col}`);
    if (iconSpan) {
      if (col === currentSortColumn) {
        iconSpan.innerText = currentSortDirection === 'asc' ? '↑' : '↓';
        iconSpan.className = "text-blue-600 font-extrabold";
      } else {
        iconSpan.innerText = '↕';
        iconSpan.className = "text-slate-400";
      }
    }
  });

  if (!windowGlobalListTunggakan || windowGlobalListTunggakan.length === 0) {
    windowGlobalListTunggakan = [...rawListTunggakan];
  }

  windowGlobalListTunggakan.sort((a, b) => {
    let valA, valB;

    if (column === 'nominal') {
      valA = Number(a.totalNominal) || 0;
      valB = Number(b.totalNominal) || 0;
    } else if (column === 'durasi') {
      valA = Number(a.durasiBulan) || 0;
      valB = Number(b.durasiBulan) || 0;
    } else if (column === 'kavling') {
      valA = ((a.perumahan || '') + (a.kavling || '')).toLowerCase();
      valB = ((b.perumahan || '') + (b.kavling || '')).toLowerCase();
    }

    if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  renderTunggakanTable(windowGlobalListTunggakan, true);
}

function renderTunggakanTable(list, isAlreadySorted = false) {
  const tbody = document.querySelector("#tabTunggakan tbody");
  if (!tbody) return;

  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  const isViewOnly = activeSess.role === "Viewer" || activeSess.role === "Admin Tagihan";
  
  if (!isAlreadySorted) {
    windowGlobalListTunggakan = [...list];
  }

  let sourceList = windowGlobalListTunggakan.length > 0 ? windowGlobalListTunggakan : list;

  updatePaginationUI('tunggakan', sourceList.length);
  const paginatedList = getPaginatedData(sourceList, 'tunggakan');

  if (paginatedList && paginatedList.length > 0) {
    tbody.innerHTML = paginatedList.map(item => {
      const durasi = Number(item.durasiBulan) || 3;
      const isSp2 = durasi >= 6;
      const isWaEmpty = !item.noWa || item.noWa.trim() === "" || item.noWa === "-";
      
      const infoKavlingDisplay = `${item.perumahan || 'The Green City View'} / ${item.kavling} (${item.nama})`;

      const perumKey = (item.perumahan || "The Green City View").toUpperCase().trim();
      const kavKey = item.kavling.toUpperCase().trim();
      const sp1Sent = item.sp1Sent || localStorage.getItem("sp1_sent_" + perumKey + "_" + kavKey) === "true";
      const isSp2Disabled = isWaEmpty || !sp1Sent;

      return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3 px-3.5 font-bold text-slate-900">${infoKavlingDisplay}</td>
          <td class="py-3 px-3.5 font-bold text-rose-600">${item.totalFormatted}</td>
          <td class="py-3 px-3.5 text-slate-700 font-semibold">${durasi} Bulan</td>
          <td class="py-3 px-3.5">
            <div class="space-y-0.5">
              <span class="inline-block ${isSp2 ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'} px-2 py-0.5 rounded font-bold text-xs">
                ${item.statusSp || 'SP-1 / Humanis'}
              </span>
              <div>
                ${sp1Sent ? '<span class="text-[10px] text-emerald-600 font-bold">✓ SP-1 Terkirim</span>' : '<span class="text-[10px] text-slate-400">SP-1 Belum</span>'}
              </div>
            </div>
          </td>
          <td class="py-3 px-3.5 text-center">
            ${isViewOnly ? '<span class="text-slate-400 text-xs font-medium">View Only</span>' : `
              <div class="inline-flex items-center gap-1.5 justify-center">
                <button ${isWaEmpty ? 'disabled' : ''} onclick="kirimSpWa('${item.kavling}', '${item.nama}', '${item.noWa}', '${item.totalFormatted}', ${durasi}, 'SP1', ${durasi}, '${item.totalFormatted}', '${item.perumahan}')" class="${isWaEmpty ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs'} px-3 py-1.5 rounded-lg text-xs font-bold transition-all">Kirim SP-1</button>
                
                <button ${isSp2Disabled ? 'disabled' : ''} onclick="kirimSpWa('${item.kavling}', '${item.nama}', '${item.noWa}', '${item.totalFormatted}', ${durasi}, 'SP2', ${durasi}, '${item.totalFormatted}', '${item.perumahan}')" class="${isSp2Disabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'} px-3 py-1.5 rounded-lg text-xs font-bold transition-all" title="${!sp1Sent ? 'Kirim SP-1 terlebih dahulu agar SP-2 aktif' : ''}">Kirim SP-2</button>
              </div>
            `}
          </td>
        </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-400 font-medium">Aman! Tidak ada warga dengan tunggakan > 4 bulan. 🎉</td></tr>`;
  }
  lucide.createIcons();
}

async function kirimSpWa(kavling, nama, noWa, totalRp, durasi, jenisSp, jumlahBulan, totalPiutang, perumahan) {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  if (!noWa || noWa.trim() === "" || noWa === "-") {
    showToast("Nomor WA untuk kavling " + kavling + " belum diisi di sheet Pelanggan!", "error");
    return;
  }
  let formatWa = noWa.trim();
  if (formatWa.startsWith("0")) {
    formatWa = "62" + formatWa.substring(1);
  }

  showToast("Menyimpan catatan tindakan ke Database...", "info");
  const res = await callApi({
    action: "catatTindakanSp",
    perumahan: perumahan || "The Green City View",
    kavling: kavling,
    jumlahBulan: jumlahBulan,
    totalPiutang: totalPiutang,
    statusTindakan: jenisSp === 'SP1' ? "SP-1 Terkirim" : "SP-2 Terkirim",
    catatan: "Pesan " + jenisSp + " dikirim via WhatsApp."
  });

  if (res.status === "success") {
    showToast("Catatan SP berhasil disimpan ke sheet Tunggakan_SP!", "success");
    if (jenisSp === 'SP1') {
      let pKey = (perumahan || "The Green City View").toUpperCase().trim();
      let kKey = kavling.toUpperCase().trim();
      localStorage.setItem("sp1_sent_" + pKey + "_" + kKey, "true");
    }
    loadDashboardData();
  } else {
    showToast("Gagal menyimpan ke sheet: " + (res.message || ""), "error");
  }

  let isiSp = jenisSp === 'SP1' ? "SURAT PERINGATAN 1 (SP-1)" : "SURAT PERINGATAN 2 (SP-2)";
  let pesan = `Yth. Bapak/Ibu *${nama}* (Kavling *${kavling}*),

Kami dari Pengelola Air Komplek GCV menyampaikan bahwa berdasarkan catatan kami, Bapak/Ibu memiliki tunggakan iuran air selama *${durasi} Bulan* dengan total akumulasi sebesar *${totalRp}*.

Melalui pesan ini, kami menerbitkan *${isiSp}*. *Bersama pesan ini kami lampirkan dokumen ${isiSp}.* Mohon segera melakukan pelunasan melalui Rekening BSI Pengelola agar layanan air tetap lancar.

Atas perhatian dan kerjasamanya, kami ucapkan terima kasih. 🙏

_Pengelola Air Komplek GCV_`;

  window.open("https://api.whatsapp.com/send?phone=" + formatWa + "&text=" + encodeURIComponent(pesan), "_blank");
}

function getRentangSiklusText(bulanTahunStr) {
  if (!bulanTahunStr) return "";
  let parts = bulanTahunStr.split("-");
  if (parts.length < 2) return "";

  let monthsMap = {
    "JAN": 0, "FEB": 1, "MAR": 2, "APR": 3, "MEI": 4, "MAY": 4, "JUN": 5,
    "JUL": 6, "AGS": 7, "AGT": 7, "AUG": 7, "SEP": 8, "OKT": 9, "OCT": 9, "NOV": 10, "DES": 11, "DEC": 11
  };

  let blnStr = parts[0].toUpperCase();
  let thn = parseInt(parts[1]) || new Date().getFullYear();
  let monthIdx = monthsMap[blnStr];

  if (monthIdx === undefined) return "";

  let monthsFull = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  let prevMonthIdx = monthIdx - 1;
  let prevYear = thn;
  if (prevMonthIdx < 0) {
    prevMonthIdx = 11;
    prevYear = thn - 1;
  }

  return `(17 ${monthsFull[prevMonthIdx]} ${prevYear} - 16 ${monthsFull[monthIdx]} ${thn})`;
}

function getBulanFullText(bulanTahunStr) {
  if (!bulanTahunStr) return "";
  let parts = bulanTahunStr.split("-");
  if (parts.length < 2) return bulanTahunStr;

  let monthsMap = {
    "JAN": 0, "FEB": 1, "MAR": 2, "APR": 3, "MEI": 4, "MAY": 4, "JUN": 5,
    "JUL": 6, "AGS": 7, "AGT": 7, "AUG": 7, "SEP": 8, "OKT": 9, "OCT": 9, "NOV": 10, "DES": 11, "DEC": 11
  };

  let blnStr = parts[0].toUpperCase();
  let thn = parseInt(parts[1]) || new Date().getFullYear();
  let monthIdx = monthsMap[blnStr];

  if (monthIdx === undefined) return bulanTahunStr;

  let monthsFull = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  return monthsFull[monthIdx] + " " + thn;
}

function kirimWaTagihan(t, btnElement) {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  if (!t.linkPdf || t.linkPdf === "-" || !t.linkPdf.startsWith("http")) {
    showToast("PDF Tagihan belum tersedia! Silakan klik tombol Download PDF terlebih dahulu.", "error");
    return;
  }

  if (!t.noWa || t.noWa.trim() === "" || t.noWa === "-") {
    showToast("Nomor WA untuk kavling " + t.kavling + " belum diisi!", "error");
    return;
  }

  let formatWa = t.noWa.trim();
  if (formatWa.startsWith("0")) {
    formatWa = "62" + formatWa.substring(1);
  }

  let tunggakanSebelumnya = Number(t.tunggakanSebelumnya) || 0;
  let namaPerumahan = t.perumahan || "The Green City View";
  let rentangSiklusText = getRentangSiklusText(t.bulanTahun);
  let bulanFullText = getBulanFullText(t.bulanTahun);

  let headerInfo = `Yth. Bapak/Ibu *${t.nama}* (${namaPerumahan} / *${t.kavling}*),

Berikut disampaikan informasi tagihan air untuk periode *${bulanFullText}* ${rentangSiklusText}:

`;

  let pesanRincianAtauLunas = "";
  const statusLower = (t.statusBayar || "").toLowerCase();
  
  if (statusLower === "lunas" || statusLower === "pemutihan denda") {
    pesanRincianAtauLunas = `- Total Tagihan: *${t.totalFormatted}*
` +
                             `- Status Pembayaran: *Lunas*

` +
                             `Terima kasih, pembayaran untuk periode ini telah kami terima dan tercatat lunas. 🙏

` +
                             `📄 *Detail rincian tagihan tersedia dalam dokumen PDF berikut:*
${t.linkPdf}`;
  } else {
    let tagihanAktif = statusLower === 'dicicil' ? t.sisaTagihan : t.totalTagihan;
    let formatTagihanAktif = "Rp " + new Intl.NumberFormat('id-ID').format(tagihanAktif);
    let akumulasiSeluruhTagihan = tagihanAktif + tunggakanSebelumnya;
    let formatTotalHarusDibayar = "Rp " + new Intl.NumberFormat('id-ID').format(akumulasiSeluruhTagihan);
    
    let teksTunggakan = "";
    if (tunggakanSebelumnya > 0) {
      let formatTunggakanLalu = "Rp " + new Intl.NumberFormat('id-ID').format(tunggakanSebelumnya);
      teksTunggakan = `- Tagihan Bulan Ini: *${formatTagihanAktif}*
` +
                      `- Tunggakan Sebelumnya: *${formatTunggakanLalu}*
`;
    } else {
      teksTunggakan = `- Tagihan Bulan Ini: *${formatTagihanAktif}*
`;
    }

    let nomorWaAdmin = t.waAdmin || t.noWaAdmin || "+6282312915318";

    pesanRincianAtauLunas = teksTunggakan + `-------------------------------------------------------------------
- *Total Harus Dibayar: ${formatTotalHarusDibayar}*

Silakan lakukan pembayaran melalui *${t.noRekBsi}*. Pembayaran paling lambat *tanggal 15*.

📄 Detail rincian tagihan tersedia dalam dokumen PDF berikut:
${t.linkPdf}

Konfirmasi pembayaran ke *Admin Air: ${nomorWaAdmin}* (Format: Nama Pelanggan - Blok/Nomor Rumah - Bulan Tagihan).

Terima kasih atas kerjasamanya. 🙏
Pengelola Air The Green`;
  }

  const pesan = headerInfo + pesanRincianAtauLunas;
  
  window.open("https://api.whatsapp.com/send?phone=" + formatWa + "&text=" + encodeURIComponent(pesan), "_blank");

  if (t.row && btnElement) {
    btnElement.classList.remove("bg-emerald-600", "hover:bg-emerald-700");
    btnElement.classList.add("bg-blue-600", "hover:bg-blue-700");
    t.statusWa = "SUDAH";

    fetch(`${API_URL}?action=updateStatusWa&row=${t.row}&status=SUDAH&apiKey=${API_KEY}`)
      .then(res => res.json())
      .catch(err => console.error("Error updateStatusWa:", err));
  }
}

let activeMultiKavling = null;

function getBatasTempo(bulanTahunStr) {
  const parts = bulanTahunStr.split("-");
  if (parts.length !== 2) return new Date();
  
  const bName = parts[0].toUpperCase().replace(/AUG/i, "AGT");
  let tahun = parseInt(parts[1], 10);
  
  const mapBulan = { "JAN":0, "FEB":1, "MAR":2, "APR":3, "MEI":4, "JUN":5, "JUL":6, "AGT":7, "AUG":7, "SEP":8, "OKT":9, "NOV":10, "DES":11 };
  let bIdx = mapBulan[bName];
  if (bIdx === undefined) return new Date();
  
  let tempoBulan = bIdx + 1;
  let tempoTahun = tahun;
  if (tempoBulan > 11) {
    tempoBulan = 0;
    tempoTahun += 1;
  }
  
  return new Date(tempoTahun, tempoBulan, 15, 23, 59, 59);
}

async function openModalMultiBayar(kavling) {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  activeMultiKavling = kavling;
  
  activeDepositSaldo = 0;
  if (typeof dataDepositGlobal !== 'undefined' && dataDepositGlobal.length > 0) {
    const depKav = dataDepositGlobal.find(d => d.kavling.toUpperCase() === kavling.toUpperCase());
    if (depKav) activeDepositSaldo = Number(depKav.saldo) || 0;
  } else {
    try {
      const req = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "getDepositData", apiKey: API_KEY })
      });
      const res = await req.json();
      if (res.status === "success" && res.listDeposit) {
        dataDepositGlobal = res.listDeposit;
        const depKav = dataDepositGlobal.find(d => d.kavling.toUpperCase() === kavling.toUpperCase());
        if (depKav) activeDepositSaldo = Number(depKav.saldo) || 0;
      }
    } catch(e) { console.error("Gagal load deposit mandiri:", e); }
  }

  let tagihanKavling = rawListTagihan.filter(t => t.kavling.toUpperCase() === kavling.toUpperCase());
  if (tagihanKavling.length === 0) {
    showToast("Kavling " + kavling + " tidak memiliki tagihan aktif.", "info");
    return;
  }

  tagihanKavling.sort((a, b) => parseBulanTahunToDate(a.bulanTahun) - parseBulanTahunToDate(b.bulanTahun));

  let rowDataList = tagihanKavling.map(t => {
    let pemakaianVal = Number(t.pemakaianM3) || 0;
    let dendaVal = t.biayaDenda !== "" && t.biayaDenda !== "-" ? Number(t.biayaDenda) : 0;
    if (pemakaianVal === 0) dendaVal = 0;

    let totalVal = Number(t.totalTagihan) || 0;
    let sisaVal = t.statusBayar.toLowerCase() === 'dicicil' ? (t.sisaTagihan || totalVal) : totalVal;

    return {
      idTagihan: t.idTagihan,
      bulanTahun: t.bulanTahun,
      statusBayar: t.statusBayar,
      sisaTagihan: sisaVal,
      dendaVal: dendaVal
    };
  });

  let listToPay = rowDataList.filter(t => t.statusBayar.toLowerCase() !== "lunas" && t.statusBayar.toLowerCase() !== "pemutihan denda");

  const namaWarga = tagihanKavling[0].nama || "-";
  document.getElementById("multiTargetKavlingNama").innerText = `${kavling} - ${namaWarga}`;

  const container = document.getElementById("containerListCheckboxTagihan");
  
  container.innerHTML = listToPay.map((t) => {
    let nominalSisa = t.sisaTagihan;
    let dendaDiSheet = t.dendaVal; 
    
    return `
      <div class="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2">
        <label class="flex items-center justify-between cursor-pointer">
          <div class="flex items-center gap-2.5">
            <input type="checkbox" class="checkbox-tagihan w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" value="${t.idTagihan}" data-nominal-sisa="${nominalSisa}" data-denda-sheet="${dendaDiSheet}" data-bulan="${t.bulanTahun}" checked onchange="hitungTotalMultiBayar('auto')">
            <span class="font-bold text-slate-800">${t.bulanTahun} (${t.statusBayar})</span>
          </div>
          <span class="font-bold text-emerald-700">Tagihan: Rp ${new Intl.NumberFormat('id-ID').format(nominalSisa)}</span>
        </label>
        <div class="flex items-center gap-2 pl-6">
          <span class="text-[11px] text-slate-500 font-semibold">Bayar (Cicil / Full): Rp</span>
          <input type="number" id="bayar_${t.idTagihan}" value="${nominalSisa}" oninput="this.dataset.manual='true'; hitungTotalMultiBayar('manual')" class="w-32 border border-slate-200 rounded-xl px-2 py-1 text-xs font-bold text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
        </div>
      </div>
    `;
  }).join('');

  let depositOptContainer = document.getElementById("depositOptionContainer");
  if (!depositOptContainer) {
    depositOptContainer = document.createElement("div");
    depositOptContainer.id = "depositOptionContainer";
    container.parentNode.insertBefore(depositOptContainer, container.nextSibling);
  }

  if (activeDepositSaldo > 0) {
    depositOptContainer.innerHTML = `
      <div class="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-2">
        <div class="flex items-center justify-between">
            <label class="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" id="checkGunakanDeposit" class="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" onchange="updateVisibilityBuktiTransfer(); hitungTotalMultiBayar('auto');">
            <div>
                <span class="font-bold text-emerald-900 block text-xs">Gunakan Saldo Deposit untuk Membayar</span>
                <span class="text-[10px] text-emerald-700">Saldo Tersedia: Rp ${Number(activeDepositSaldo).toLocaleString('id-ID')}</span>
            </div>
            </label>
            <span class="text-xs font-extrabold text-emerald-800" id="infoPotongDeposit">-</span>
        </div>
        <div id="warningSaldoDepositText" class="hidden mt-1 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium leading-relaxed">
            <!-- Pesan peringatan saldo kurang masuk ke sini -->
        </div>
      </div>
    `;
    depositOptContainer.classList.remove("hidden");
  } else {
    depositOptContainer.innerHTML = "";
    depositOptContainer.classList.add("hidden");
  }

  const today = new Date().toISOString().split('T')[0];
  document.getElementById("multiInputDateBayar").value = today;

  const fileInput = document.getElementById("multiInputBukti");
  if (fileInput) fileInput.value = "";
  updateVisibilityBuktiTransfer();

  hitungTotalMultiBayar('auto');
  document.getElementById("modalMultiBayar").classList.remove("hidden");
  lucide.createIcons();
}

function closeModalMultiBayar() {
  document.getElementById("modalMultiBayar").classList.add("hidden");
  activeMultiKavling = null;
  activeDepositSaldo = 0;
}

function toggleSelectAllMulti(btn) {
  const checkboxes = document.querySelectorAll(".checkbox-tagihan");
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  checkboxes.forEach(cb => cb.checked = !allChecked);
  btn.innerText = allChecked ? "Pilih Semua" : "Batalkan Semua";
  hitungTotalMultiBayar('auto'); 
}

function setQuickMultiDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const dateStr = d.toISOString().split('T')[0];
  document.getElementById("multiInputDateBayar").value = dateStr;
  hitungTotalMultiBayar('auto');
}

function setQuickMultiDateTgl15() {
  const d = new Date();
  const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-15`;
  document.getElementById("multiInputDateBayar").value = dateStr;
  hitungTotalMultiBayar('auto');
}

function hitungTotalMultiBayar(triggerType = 'auto') {
  const checkboxes = document.querySelectorAll(".checkbox-tagihan:checked");
  let totalDiterima = 0;
  let lateCount = 0;
  
  const rawDate = document.getElementById("multiInputDateBayar").value;
  let tglBayar = null;
  if (rawDate) {
    const parts = rawDate.split("-");
    tglBayar = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
  }

  checkboxes.forEach(cb => {
    let bulan = cb.getAttribute("data-bulan");
    if (tglBayar && bulan) {
      let batasTempo = getBatasTempo(bulan);
      if (tglBayar > batasTempo) lateCount++;
    }
  });

  const info = document.getElementById("multiInfoDendaWarning");
  const opsi = document.getElementById("multiOpsiDendaContainer");

  let opsiDenda = "A";
  if (lateCount > 0) {
    const radioSelected = document.querySelector('input[name="multiOpsiDenda"]:checked');
    if (radioSelected) opsiDenda = radioSelected.value;

    if (opsiDenda === "C") {
      info.className = "p-2.5 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 block mt-2";
      info.innerHTML = `✨ <b>Pemutihan Denda Aktif:</b> Denda dihapuskan (Toleransi Admin).`;
    } else if (opsiDenda === "B") {
      info.className = "p-2.5 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-700 border border-emerald-200 block mt-2";
      info.innerHTML = `💸 <b>Warga Bayar Denda:</b> Denda Rp 5.000 dimasukkan ke pembayaran.`;
    } else {
      info.className = "p-2.5 rounded-xl text-[11px] font-semibold bg-rose-50 text-rose-700 border border-emerald-200 block mt-2";
      info.innerHTML = `⚠️ <b>${lateCount} Tagihan Lewat Tempo!</b> Denda ditangguhkan ke bulan depan.`;
    }
    opsi.classList.remove("hidden");
  } else {
    info.className = "hidden";
    opsi.classList.add("hidden");
  }

  checkboxes.forEach(cb => {
    let idTag = cb.value;
    let inputNominal = document.getElementById("bayar_" + idTag);
    if (!inputNominal) return;

    let sisaSheet = Number(cb.getAttribute("data-nominal-sisa")) || 0;
    let dendaSheet = Number(cb.getAttribute("data-denda-sheet")) || 0;
    
    let bulan = cb.getAttribute("data-bulan");
    let isLate = false;
    if (tglBayar && bulan) {
      let batasTempo = getBatasTempo(bulan);
      isLate = tglBayar > batasTempo;
    }

    if (triggerType === 'auto' && inputNominal.dataset.manual !== 'true') {
      let tagihanDitagihkan = sisaSheet;
      if (opsiDenda === "C") {
          tagihanDitagihkan = Math.max(0, sisaSheet - dendaSheet);
      }

      if (isLate) {
        if (opsiDenda === "A" || opsiDenda === "C") {
          inputNominal.value = tagihanDitagihkan; 
        } else if (opsiDenda === "B") {
          inputNominal.value = tagihanDitagihkan + 5000; 
        }
      } else {
         inputNominal.value = tagihanDitagihkan; 
      }
    }
    
    totalDiterima += (Number(inputNominal.value) || 0);
  });

  const checkDeposit = document.getElementById("checkGunakanDeposit");
  const infoPotong = document.getElementById("infoPotongDeposit");
  let elWarningSaldo = document.getElementById("warningSaldoDepositText");

  if (checkDeposit && checkDeposit.checked) {
    let nominalDipotong = Math.min(activeDepositSaldo, totalDiterima);
    if (infoPotong) infoPotong.innerText = `- Dipotong: Rp ${nominalDipotong.toLocaleString('id-ID')}`;

    if (activeDepositSaldo < totalDiterima) {
        let kekurangan = totalDiterima - activeDepositSaldo;
        if (elWarningSaldo) {
            elWarningSaldo.classList.remove("hidden");
            elWarningSaldo.innerHTML = `⚠️ <b>Saldo Deposit Kurang:</b> Deposit (Rp ${activeDepositSaldo.toLocaleString('id-ID')}) akan dikuras habis. Kekurangan <b>Rp ${kekurangan.toLocaleString('id-ID')}</b> otomatis dicatat sebagai cicilan bulan depan!`;
        }
    } else {
        if (elWarningSaldo) elWarningSaldo.classList.add("hidden");
    }
  } else {
    if (infoPotong) infoPotong.innerText = "";
    if (elWarningSaldo) elWarningSaldo.classList.add("hidden");
  }
  
  document.getElementById("multiTotalNominal").innerText = "Rp " + new Intl.NumberFormat('id-ID').format(totalDiterima);
}

async function submitMultiPelunasan() {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  const checkboxes = document.querySelectorAll(".checkbox-tagihan:checked");
  if (checkboxes.length === 0) {
    showToast("Pilih minimal satu periode tagihan!", "error");
    return;
  }

  const rawDate = document.getElementById("multiInputDateBayar").value;
  if (!rawDate) {
    showToast("Pilih tanggal transfer terlebih dahulu!", "error");
    return;
  }

  const parts = rawDate.split("-");
  const tglFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
  
  let listPembayaran = [];
  let totalTagihanDipilih = 0;
  for (let cb of checkboxes) {
    let idTag = cb.value;
    let inputNominal = document.getElementById("bayar_" + idTag);
    let nominalBayar = inputNominal ? (Number(inputNominal.value) || 0) : 0;

    totalTagihanDipilih += nominalBayar;
    listPembayaran.push({
      idTagihan: idTag,
      nominalBayar: nominalBayar
    });
  }

  let opsiDendaTerpilih = "A";
  const opsiContainer = document.getElementById("multiOpsiDendaContainer");
  if (opsiContainer && !opsiContainer.classList.contains("hidden")) {
      const radioSelected = document.querySelector('input[name="multiOpsiDenda"]:checked');
      if (radioSelected) opsiDendaTerpilih = radioSelected.value;
  }

  const checkDeposit = document.getElementById("checkGunakanDeposit");
  const gunakanDeposit = checkDeposit ? checkDeposit.checked : false;

  const fileInput = document.getElementById("multiInputBukti");
  let fileBase64 = "";
  let fileName = "";
  let mimeType = "";

  // Upload bukti WAJIB kecuali pakai deposit (apapun kecukupan saldonya)
  const isBypassBukti = gunakanDeposit;

  if (!isBypassBukti && (!fileInput || fileInput.files.length === 0)) {
    showToast("Gagal! Bukti transfer wajib diunggah (atau gunakan Saldo Deposit).", "error");
    return;
  }

  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    if (file.size > 3 * 1024 * 1024) { 
      showToast("Gagal! Ukuran file bukti transfer maksimal 3MB.", "error");
      return;
    }
    try {
      fileBase64 = await getBase64(file);
      fileName = file.name;
      mimeType = file.type;
    } catch (e) {
      showToast("Gagal membaca file bukti transfer.", "error");
      return;
    }
  }

  const savedKavling = activeMultiKavling;

  closeModalMultiBayar();
  showToast("Memproses pembayaran & pemotongan saldo deposit...", "info");

  const res = await callApi({
    action: "updateMultiStatusBayar",
    kavling: savedKavling,
    listPembayaran: listPembayaran,
    statusBayar: "Auto", 
    tglBayar: tglFormatted,
    opsiDenda: opsiDendaTerpilih,
    gunakanDeposit: gunakanDeposit, 
    fileBase64: fileBase64,
    fileName: fileName,
    mimeType: mimeType
  });

  if (res.status === "success") {
    showToast(res.message, "success");
    loadDashboardDataForTab('tagihan');
    if (typeof loadDepositData === 'function') loadDepositData(); 
    if (fileInput) fileInput.value = "";
  } else {
    showToast(res.message || "Gagal memperbarui status tagihan.", "error");
  }
}

function parseBulanTahunToDate(bulanTahunStr) {
  if (!bulanTahunStr) return new Date(0);
  const parts = bulanTahunStr.split("-");
  if (parts.length !== 2) return new Date(0);

  const mapBulan = { 
    "JAN":0, "FEB":1, "MAR":2, "APR":3, "MEI":4, "MAY":4, "JUN":5, 
    "JUL":6, "AGT":7, "AUG":7, "SEP":8, "OKT":9, "OCT":9, "NOV":10, "DES":11, "DEC":11 
  };
  
  const bName = parts[0].toUpperCase();
  const tahun = parseInt(parts[1], 10);
  const bIdx = mapBulan[bName] !== undefined ? mapBulan[bName] : 0;

  return new Date(tahun, bIdx, 1);
}

function bukaModalBatalPintar(kavling) {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  const sekarang = new Date();
  const batasSatuTahunLalu = new Date(sekarang.getFullYear() - 1, sekarang.getMonth(), 1);

  const tagihanLunasKavling = rawListTagihan.filter(t => {
    if (t.kavling.toUpperCase() !== kavling.toUpperCase()) return false;
    const stLower = (t.statusBayar || "").toLowerCase();
    if (stLower !== "lunas" && stLower !== "pemutihan denda" && stLower !== "dicicil") return false;

    const tglPeriode = parseBulanTahunToDate(t.bulanTahun);
    return tglPeriode >= batasSatuTahunLalu;
  });

  if (tagihanLunasKavling.length === 0) {
    showToast("Tidak ada tagihan lunas/dicicil dalam 1 tahun terakhir untuk kavling ini.", "info");
    return;
  }

  const namaWarga = tagihanLunasKavling[0].nama || "-";
  document.getElementById("batalTargetKavlingNama").innerText = `${kavling} - ${namaWarga}`;

  const container = document.getElementById("containerListCheckboxBatal");
  container.innerHTML = tagihanLunasKavling.map((t) => `
    <label class="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200 cursor-pointer hover:bg-rose-50/50 transition-all">
      <div class="flex items-center gap-2.5">
        <input type="checkbox" class="checkbox-batal w-4 h-4 text-rose-600 rounded focus:ring-rose-500" value="${t.idTagihan}" checked>
        <span class="font-bold text-slate-800">Periode: ${t.bulanTahun}</span>
      </div>
      <span class="font-bold text-rose-600">${t.totalFormatted}</span>
    </label>
  `).join('');

  document.getElementById("modalBatalPintar").classList.remove("hidden");
  lucide.createIcons();
}

function closeModalBatalPintar() {
  document.getElementById("modalBatalPintar").classList.add("hidden");
}

async function eksekusiBatalPintar() {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role === "Viewer") return;

  const checkboxes = document.querySelectorAll(".checkbox-batal:checked");
  if (checkboxes.length === 0) {
    showToast("Pilih minimal satu periode yang ingin dibatalkan!", "error");
    return;
  }

  const listIdTagihan = Array.from(checkboxes).map(cb => cb.value);
  closeModalBatalPintar();
  showToast("Membatalkan pelunasan terpilih...", "info");

  let listPembayaranBatal = listIdTagihan.map(id => ({ idTagihan: id, nominalBayar: 0 }));

  const res = await callApi({
    action: "updateMultiStatusBayar",
    listPembayaran: listPembayaranBatal,
    statusBayar: "Belum Bayar",
    tglBayar: "-",
    opsiDenda: "A"
  });

  if (res.status === "success") {
    showToast("Status tagihan terpilih berhasil dikembalikan ke Belum Bayar.", "success");
    loadDashboardDataForTab('tagihan');
  } else {
    showToast(res.message || "Gagal membatalkan pelunasan.", "error");
  }
}

async function downloadPdf(kavling, bulan) {
  showToast("Sedang memproses & mengunduh PDF...", "info");
  const res = await callApi({ action: "generatePdf", kavling: kavling, bulanTahun: bulan });

  if (res.status === "success" && res.base64) {
    const link = document.createElement("a");
    link.href = "data:application/pdf;base64," + res.base64;
    
    let formatKavling = kavling;
    const match = kavling.match(/^([a-zA-Z]*)(\d+)$/);
    if (match) {
      const huruf = match[1];
      const angka = parseInt(match[2], 10);
      const angkaPad = angka < 10 ? "0" + angka : angka;
      formatKavling = huruf + angkaPad;
    }
    
    const formatBulan = bulan.replace("-", "_");
    link.download = formatKavling + "_" + formatBulan + ".pdf";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast("PDF berhasil dibuat & diunduh!", "success");
    loadDashboardDataForTab('tagihan');
  } else {
    showToast(res.message || "Gagal mengunduh PDF", "error");
  }
}

function exportExcelTagihan() {
  const filteredTagihan = rawListTagihan.filter(t => {
    const tNorm = String(t.bulanTahun || "").replace(/Aug/i, "Agt").trim().toLowerCase();
    const actNorm = String(activePeriodeTagihan || "").replace(/Aug/i, "Agt").trim().toLowerCase();
    return tNorm === actNorm;
  });

  if (!filteredTagihan || filteredTagihan.length === 0) {
    showToast("Tidak ada data tagihan untuk periode " + activePeriodeTagihan + ".", "error");
    return;
  }

  const excelData = filteredTagihan.map(t => ({
    "Kavling": t.kavling || '',
    "Perumahan": t.perumahan || 'The Green City View',
    "Nama Warga": t.nama || '',
    "Periode": t.bulanTahun,
    "Pemakaian (m³)": Number(t.pemakaianM3) || 0,
    "Total Tagihan (Rp)": Number(t.totalTagihan) || 0,
    "Status Pembayaran": t.statusBayar || 'Belum Bayar',
    "Status WA": t.statusWa || 'BELUM'
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Tagihan");

  XLSX.writeFile(workbook, `Backup_Tagihan_${activePeriodeTagihan}.xlsx`);
  showToast("File Excel (.xlsx) Tagihan berhasil diunduh!", "success");
}

function filterBelumBayar() {
  const tabTagihanEl = document.getElementById("tabTagihan");
  if (tabTagihanEl && tabTagihanEl.classList.contains("hidden")) {
    showToast("Silakan aktifkan tab 'Tagihan & Unduh PDF' terlebih dahulu untuk memfilter estimasi tagihan.", "info");
    return;
  }

  switchTab('tabTagihan');
  isFilterBelumBayarActive = true; 
  
  document.querySelectorAll('#containerBlokTabTagihan button').forEach(btn => {
    btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-600', 'shadow-sm');
    btn.classList.add('bg-white', 'text-slate-700', 'border-slate-200');
  });

  const activePeriodeNorm = String(activePeriodeTagihan || "").replace(/Aug/i, "Agt").trim().toLowerCase();

  const belumLunas = rawListTagihan.filter(t => {
    const tNorm = String(t.bulanTahun || "").replace(/Aug/i, "Agt").trim().toLowerCase();
    const stLower = (t.statusBayar || "").toLowerCase();
    const isBelumLunas = stLower !== 'lunas' && stLower !== 'pemutihan denda';
    const matchPeriode = tNorm === activePeriodeNorm;
    
    return isBelumLunas && matchPeriode;
  });
  
  if (belumLunas.length === 0) {
    isFilterBelumBayarActive = false;
    showToast(`Luar biasa! Semua tagihan periode ${activePeriodeTagihan} sudah lunas.`, "success");
    return;
  }
  
  paginationState['tagihan'].limit = 'all';
  const selectLimit = document.getElementById("selectLimit_tagihan");
  if (selectLimit) selectLimit.value = 'all';

  updatePaginationUI('tagihan', belumLunas.length);
  const paginatedData = getPaginatedData(belumLunas, 'tagihan');
  renderTagihanTable(paginatedData);
  
  showToast(`Menampilkan ${belumLunas.length} tagihan belum lunas (Semua Blok).`, "info");
}