// ==========================================
// MODULE: APP.JS (CENTRAL STATE & ROUTER)
// ==========================================

lucide.createIcons();

// VARIABEL GLOBAL PAGINATION & STATE
let globalLimit = 25;
let isLimitInitialized = false; 
let paginationState = {
  meter: { page: 1, limit: 25 },
  tagihan: { page: 1, limit: 25 },
  pelanggan: { page: 1, limit: 25 },
  tunggakan: { page: 1, limit: 25 }
};

let currentIdTagihanModal = null; 
let activeDendaKavling = null;    

function getPaginatedData(array, tabId) {
  const state = paginationState[tabId];
  if (state.limit === 'all') return array;
  const startIndex = (state.page - 1) * state.limit;
  return array.slice(startIndex, startIndex + state.limit);
}

function updatePaginationUI(tabId, totalItems) {
  const state = paginationState[tabId];
  const infoEl = document.getElementById("infoPage_" + tabId);
  const btnPrev = document.getElementById("btnPrev_" + tabId);
  const btnNext = document.getElementById("btnNext_" + tabId);
  
  if (!infoEl) return;

  if (state.limit === 'all' || totalItems === 0) {
    infoEl.innerText = totalItems > 0 ? `Total: ${totalItems} baris` : `Tidak ada data`;
    if(btnPrev) btnPrev.disabled = true;
    if(btnNext) btnNext.disabled = true;
    return;
  }

  const totalPages = Math.ceil(totalItems / state.limit);
  if (state.page > totalPages && totalPages > 0) state.page = totalPages;
  
  infoEl.innerText = `Hal ${state.page} dari ${totalPages}`;
  
  if(btnPrev) btnPrev.disabled = state.page <= 1;
  if(btnNext) btnNext.disabled = state.page >= totalPages;
}

function changePage(tabId, direction) {
  paginationState[tabId].page += direction;
  if (paginationState[tabId].page < 1) paginationState[tabId].page = 1;
  triggerRenderTab(tabId);
}

function changeLimit(tabId, newLimit) {
  paginationState[tabId].limit = newLimit === 'all' ? 'all' : parseInt(newLimit);
  paginationState[tabId].page = 1;
  triggerRenderTab(tabId);
}

function triggerRenderTab(tabId) {
  if(tabId === 'meter') {
    if (typeof isFilterBelumDicatatActive !== 'undefined' && isFilterBelumDicatatActive) {
      filterBelumDicatat();
    } else {
      filterMeterTable();
    }
  }
  else if(tabId === 'tagihan') {
    if (typeof isFilterBelumBayarActive !== 'undefined' && isFilterBelumBayarActive) {
      filterBelumBayar();
    } else {
      filterTagihanTable();
    }
  }
  else if(tabId === 'pelanggan') filterPelangganTable();
  else if(tabId === 'tunggakan') renderTunggakanTable(rawListTunggakan);
}

function getCurrentPeriode() {
  const d = new Date();
  let monthIndex = d.getMonth();
  let year = d.getFullYear();

  if (d.getDate() < 17) {
    monthIndex -= 1;
    if (monthIndex < 0) {
      monthIndex = 11;
      year -= 1;
    }
  }

  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  return months[monthIndex] + "-" + year;
}

function generateDynamicPeriodeOptions() {
  const d = new Date();
  const currentYear = d.getFullYear();
  const currentMonthIndex = d.getMonth();
  const startYear = 2024;
  
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  let options = [];

  for (let y = startYear; y <= currentYear; y++) {
    let mEnd = (y === currentYear) ? currentMonthIndex : 11;
    for (let m = 0; m <= mEnd; m++) {
      options.push(months[m] + "-" + y);
    }
  }
  return options;
}

const LIST_PERIODE_OPTIONS = generateDynamicPeriodeOptions();

let activePeriodeMeter = getCurrentPeriode();
let activePeriodeTagihan = getCurrentPeriode();

let rawListMeter = [];
let rawListTagihan = [];
let rawListTunggakan = [];
let rawListPelanggan = [];
let activeTabMeter = "";
let activeTabTagihan = "";
let activeTabPelanggan = "";
let backgroundSyncTimer = null; 
let isEditingMeter = false; 

window.onload = () => {
  populateDropdownPeriode();
  generateLoginCaptcha();
  generateResetCaptcha();

  const sess = sessionStorage.getItem("user_session");
  if (sess) {
    const user = JSON.parse(sess);
    const modalLogin = document.getElementById("modalLogin");
    if (modalLogin) modalLogin.classList.add("hidden");
    
    aturMenuBerdasarkanRole(user.role, user.nama);
    loadDashboardData();
    loadDataPelanggan();

    if (!backgroundSyncTimer) backgroundSyncTimer = setInterval(backgroundSyncData, 10000);
  }
};

function populateDropdownPeriode() {
  const spanMeter = document.getElementById("textPeriodeMeter");
  const spanTagihan = document.getElementById("textPeriodeTagihan");
  
  if (spanMeter) spanMeter.innerText = activePeriodeMeter;
  if (spanTagihan) spanTagihan.innerText = activePeriodeTagihan;
}

function geserPeriode(tab, arah) {
  if (tab === 'meter') {
    let currentIndex = LIST_PERIODE_OPTIONS.indexOf(activePeriodeMeter);
    let newIndex = currentIndex + arah;
    
    if (newIndex >= 0 && newIndex < LIST_PERIODE_OPTIONS.length) {
      activePeriodeMeter = LIST_PERIODE_OPTIONS[newIndex];
      populateDropdownPeriode();
      loadDashboardDataForTab('meter');
    } else {
      showToast(arah > 0 ? "Bulan ini adalah periode terbaru" : "Sudah mencapai batas periode terlama", "info");
    }
  } else if (tab === 'tagihan') {
    let currentIndex = LIST_PERIODE_OPTIONS.indexOf(activePeriodeTagihan);
    let newIndex = currentIndex + arah;
    
    if (newIndex >= 0 && newIndex < LIST_PERIODE_OPTIONS.length) {
      activePeriodeTagihan = LIST_PERIODE_OPTIONS[newIndex];
      populateDropdownPeriode();
      loadDashboardDataForTab('tagihan');
    } else {
      showToast(arah > 0 ? "Bulan ini adalah periode terbaru" : "Sudah mencapai batas periode terlama", "info");
    }
  }
}

function showToast(pesan, jenis = "error") {
  const toast = document.getElementById("toastNotif");
  if (!toast) return;
  const title = document.getElementById("toastTitle");
  const msg = document.getElementById("toastMessage");
  const icon = document.getElementById("toastIcon");

  if (msg) msg.innerText = pesan;

  if (jenis === "error") {
    if (title) title.innerText = "Koneksi Gagal";
    if (icon) {
      icon.className = "p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0";
      icon.innerHTML = `<i data-lucide="wifi-off" class="w-5 h-5"></i>`;
    }
  } else if (jenis === "success") {
    if (title) title.innerText = "Berhasil";
    if (icon) {
      icon.className = "p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0";
      icon.innerHTML = `<i data-lucide="check-circle-2" class="w-5 h-5"></i>`;
    }
  } else {
    if (title) title.innerText = "Pemberitahuan";
    if (icon) {
      icon.className = "p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0";
      icon.innerHTML = `<i data-lucide="info" class="w-5 h-5"></i>`;
    }
  }

  lucide.createIcons();
  toast.classList.remove("-translate-y-24", "opacity-0", "pointer-events-none");
  toast.classList.add("translate-y-0", "opacity-100");
  setTimeout(hideToast, 4000);
}

function hideToast() {
  const toast = document.getElementById("toastNotif");
  if (!toast) return;
  toast.classList.add("-translate-y-24", "opacity-0", "pointer-events-none");
  toast.classList.remove("translate-y-0", "opacity-100");
}

function checkAndHandleAppVersion(resObj) {
  if (!resObj || resObj.status !== "success") return false;
  const serverVersion = String(resObj.appVersion || "1.0").trim();
  const localVersion = sessionStorage.getItem("app_version_active");

  if (!localVersion) {
    sessionStorage.setItem("app_version_active", serverVersion);
    return false;
  }

  if (localVersion !== serverVersion && !isEditingMeter) {
    sessionStorage.setItem("app_version_active", serverVersion);
    if (typeof showToast === "function") {
      showToast("Pembaruan sistem terdeteksi (v" + serverVersion + "), memuat ulang versi terbaru...", "info");
    }
    setTimeout(() => {
      window.location.reload();
    }, 1500);
    return true;
  }

  return false;
}

async function loadDashboardData() {
  showToast("Memuat data...", "info");
  await fetchAndUpdateAllData();
  showToast("Data berhasil diperbarui!", "success");
}

async function backgroundSyncData() {
  if (isEditingMeter) return; 
  
  const tabTunggakanEl = document.getElementById("tabTunggakan");
  if (tabTunggakanEl && !tabTunggakanEl.classList.contains("hidden")) {
    return; 
  }

  if (typeof isFilterBelumDicatatActive !== 'undefined' && isFilterBelumDicatatActive) {
    const resMeter = await callApi({ action: "getDashboardData", periode: activePeriodeMeter });
    if (resMeter && resMeter.status === "success") {
      rawListMeter = (resMeter.listMeter || []).sort((a, b) => 
        String(a.kavling).localeCompare(String(b.kavling), undefined, { numeric: true, sensitivity: 'base' })
      );
    }
    return;
  }

  await fetchAndUpdateAllData(true);
}

async function fetchAndUpdateAllData(isBackground = false) {
  const resMeter = await callApi({ action: "getDashboardData", periode: activePeriodeMeter });
  
  let resTagihan;
  if (activePeriodeTagihan === activePeriodeMeter) {
    resTagihan = resMeter;
  } else {
    resTagihan = await callApi({ action: "getDashboardData", periode: activePeriodeTagihan });
  }

  if (resMeter && resMeter.status === "success") {
    if (checkAndHandleAppVersion(resMeter)) return;

    if (!isLimitInitialized) {
      globalLimit = resMeter.defaultLimit || 25;
      Object.keys(paginationState).forEach(key => {
        paginationState[key].limit = globalLimit;
        const selectEl = document.getElementById("selectLimit_" + key);
        if (selectEl) selectEl.value = globalLimit;
      });
      isLimitInitialized = true;
    }

    const statPelanggan = document.getElementById("statTotalPelanggan");
    if (statPelanggan) statPelanggan.innerText = resMeter.stats.totalPelanggan;

    if (typeof rawListPelanggan !== 'undefined' && rawListPelanggan.length > 0) {
      const jmlAktif = rawListPelanggan.filter(p => !p.statusKavling || p.statusKavling.toUpperCase() === 'AKTIF').length;
      const jmlNonAktif = rawListPelanggan.length - jmlAktif;
      
      const elAktif = document.getElementById("statPelangganAktif");
      const elNonAktif = document.getElementById("statPelangganNonAktif");
      
      if (elAktif) elAktif.innerText = jmlAktif + " KK";
      if (elNonAktif) elNonAktif.innerText = jmlNonAktif + " KK";
    }

    rawListMeter = (resMeter.listMeter || []).sort((a, b) => 
      String(a.kavling).localeCompare(String(b.kavling), undefined, { numeric: true, sensitivity: 'base' })
    );

    const targetMeterAktif = rawListMeter.filter(item => {
      const p = rawListPelanggan.find(x => x.kavling === item.kavling);
      const isNonAktif = p && p.statusKavling && p.statusKavling.toUpperCase() !== 'AKTIF';
      return !isNonAktif && !item.isLockedPast; 
    });

    const totalMeter = targetMeterAktif.length;
    const selesaiMeter = targetMeterAktif.filter(m => m.standAkhir !== "" && m.standAkhir !== null).length;
    const belumMeter = totalMeter - selesaiMeter;
    const persentase = totalMeter > 0 ? Math.round((selesaiMeter / totalMeter) * 100) : 0;
    
    if(document.getElementById("statMeterSelesai")) {
       document.getElementById("statMeterSelesai").innerText = selesaiMeter;
       document.getElementById("statMeterTotal").innerText = totalMeter;
       document.getElementById("barMeterProgress").style.width = persentase + "%";
       document.getElementById("textMeterProgress").innerText = persentase + "% Selesai";
       
       const elSisa = document.getElementById("textSisaKavling");
       if (elSisa) {
         if (belumMeter === 0 && totalMeter > 0) {
             elSisa.innerText = "Tuntas 100%!";
             elSisa.className = "text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200";
         } else {
             elSisa.innerText = `${belumMeter} kavling belum`;
             elSisa.className = "text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100";
         }
       }
    }

    const listTabKategori = getDaftarTab(rawListMeter);
    if (!activeTabMeter || !listTabKategori.includes(activeTabMeter)) {
      activeTabMeter = listTabKategori.length > 0 ? listTabKategori[0] : "";
    }

    renderPerumahanTabs();
    if (typeof filterMeterTable === 'function') filterMeterTable();
  }

  if (resTagihan && resTagihan.status === "success") {
    const estTagihan = document.getElementById("statEstimasiTagihan");
    const tagihanBayar = document.getElementById("statTagihanDibayar");
    const tunggakanEl = document.getElementById("statTunggakan");

    if (estTagihan) estTagihan.innerText = resTagihan.stats.estimasiTagihan;
    if (tagihanBayar) tagihanBayar.innerText = resTagihan.stats.tagihanDibayar;
    if (tunggakanEl) tunggakanEl.innerText = resTagihan.stats.tunggakan4Bln;

    let totalAkumulasiTunggakan = 0;
    if (resTagihan.listTunggakan && resTagihan.listTunggakan.length > 0) {
      resTagihan.listTunggakan.forEach(t => {
        totalAkumulasiTunggakan += Number(t.totalNominal) || 0;
      });
    }
    let totalRupiahTunggakan = new Intl.NumberFormat('id-ID').format(totalAkumulasiTunggakan);
    
    let elNominalCard = document.getElementById("statNominalTunggakan");
    if (elNominalCard) {
      elNominalCard.innerText = `Rp ${totalRupiahTunggakan}`;
    }

    rawListTagihan = (resTagihan.listTagihan || []).sort((a, b) => 
      String(a.kavling).localeCompare(String(b.kavling), undefined, { numeric: true, sensitivity: 'base' })
    );

    rawListTunggakan = (resTagihan.listTunggakan || []).sort((a, b) => 
      String(a.kavling).localeCompare(String(b.kavling), undefined, { numeric: true, sensitivity: 'base' })
    );
    if (typeof renderTunggakanTable === 'function') renderTunggakanTable(rawListTunggakan);

    const listTabKategoriTagihan = getDaftarTab(rawListTagihan);
    if (!activeTabTagihan || !listTabKategoriTagihan.includes(activeTabTagihan)) {
      activeTabTagihan = listTabKategoriTagihan.length > 0 ? listTabKategoriTagihan[0] : "";
    }

    renderPerumahanTabs();
    if (typeof filterTagihanTable === 'function') filterTagihanTable();
  }
}

async function loadDataPelanggan() {
  const res = await callApi({ action: "getDataPelanggan" });
  if (res && res.status === "success") {
    rawListPelanggan = res.listPelanggan || [];
    
    if (rawListPelanggan.length > 0) {
      const jmlAktif = rawListPelanggan.filter(p => !p.statusKavling || p.statusKavling.toUpperCase() === 'AKTIF').length;
      const jmlNonAktif = rawListPelanggan.length - jmlAktif;
      
      const elAktif = document.getElementById("statPelangganAktif");
      const elNonAktif = document.getElementById("statPelangganNonAktif");
      
      if (elAktif) elAktif.innerText = jmlAktif + " KK";
      if (elNonAktif) elNonAktif.innerText = jmlNonAktif + " KK";
    }

    const listTabKategoriPelanggan = getDaftarTab(rawListPelanggan);
    if (!activeTabPelanggan || !listTabKategoriPelanggan.includes(activeTabPelanggan)) {
      activeTabPelanggan = listTabKategoriPelanggan.length > 0 ? listTabKategoriPelanggan[0] : "";
    }
    
    renderPerumahanTabs();
    if (typeof filterPelangganTable === 'function') {
      filterPelangganTable();
    } else if (typeof renderTabelPelanggan === 'function') {
      renderTabelPelanggan(rawListPelanggan);
    }
  } else {
    rawListPelanggan = [];
    if (typeof renderTabelPelanggan === 'function') renderTabelPelanggan([]);
  }
}

async function loadDashboardDataForTab(tabType) {
  if (tabType === 'meter') {
    const res = await callApi({ action: "getDashboardData", periode: activePeriodeMeter });
    if (res && res.status === "success") {
      if (checkAndHandleAppVersion(res)) return;
      rawListMeter = (res.listMeter || []).sort((a, b) => 
        String(a.kavling).localeCompare(String(b.kavling), undefined, { numeric: true, sensitivity: 'base' })
      );
      
      const targetMeterAktif = rawListMeter.filter(item => {
        const p = rawListPelanggan.find(x => x.kavling === item.kavling);
        const isNonAktif = p && p.statusKavling && p.statusKavling.toUpperCase() !== 'AKTIF';
        return !isNonAktif && !item.isLockedPast; 
      });

      const totalMeter = targetMeterAktif.length;
      const selesaiMeter = targetMeterAktif.filter(m => m.standAkhir !== "" && m.standAkhir !== null).length;
      const belumMeter = totalMeter - selesaiMeter;
      const persentase = totalMeter > 0 ? Math.round((selesaiMeter / totalMeter) * 100) : 0;
      
      if(document.getElementById("statMeterSelesai")) {
         document.getElementById("statMeterSelesai").innerText = selesaiMeter;
         document.getElementById("statMeterTotal").innerText = totalMeter;
         document.getElementById("barMeterProgress").style.width = persentase + "%";
         document.getElementById("textMeterProgress").innerText = persentase + "% Selesai";
         
         const elSisa = document.getElementById("textSisaKavling");
         if (elSisa) {
           if (belumMeter === 0 && totalMeter > 0) {
               elSisa.innerText = "Tuntas 100%!";
               elSisa.className = "text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200";
           } else {
               elSisa.innerText = `${belumMeter} kavling belum`;
               elSisa.className = "text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100";
           }
         }
      }
      renderPerumahanTabs();
      if (typeof filterMeterTable === 'function') filterMeterTable();
    }
  } else if (tabType === 'tagihan') {
    const res = await callApi({ action: "getDashboardData", periode: activePeriodeTagihan });
    if (res && res.status === "success") {
      if (checkAndHandleAppVersion(res)) return;
      const estTagihan = document.getElementById("statEstimasiTagihan");
      const tagihanBayar = document.getElementById("statTagihanDibayar");
      const tunggakanEl = document.getElementById("statTunggakan");

      if (estTagihan) estTagihan.innerText = res.stats.estimasiTagihan;
      if (tagihanBayar) tagihanBayar.innerText = res.stats.tagihanDibayar;
      if (tunggakanEl) tunggakanEl.innerText = res.stats.tunggakan4Bln;

      let totalAkumulasiTunggakan = 0;
      if (res.listTunggakan && res.listTunggakan.length > 0) {
        res.listTunggakan.forEach(t => {
          totalAkumulasiTunggakan += Number(t.totalNominal) || 0;
        });
      }
      let totalRupiahTunggakan = new Intl.NumberFormat('id-ID').format(totalAkumulasiTunggakan);
      
      let elNominalCard = document.getElementById("statNominalTunggakan");
      if (elNominalCard) {
        elNominalCard.innerText = `Rp ${totalRupiahTunggakan}`;
      }

      rawListTagihan = (res.listTagihan || []).sort((a, b) => 
        String(a.kavling).localeCompare(String(b.kavling), undefined, { numeric: true, sensitivity: 'base' })
      );
      
      rawListTunggakan = (res.listTunggakan || []).sort((a, b) => 
        String(a.kavling).localeCompare(String(b.kavling), undefined, { numeric: true, sensitivity: 'base' })
      );
      if (typeof renderTunggakanTable === 'function') renderTunggakanTable(rawListTunggakan);

      renderPerumahanTabs();
      if (typeof filterTagihanTable === 'function') filterTagihanTable();
    }
  }
}

function getKategoriTab(item) {
  const rawPerum = item.perumahan || "";
  const perum = rawPerum.trim() !== "" ? rawPerum.trim() : "The Green City View";
  const kav = (item.kavling || "").trim();

  if (perum === "The Green City View") {
    const hurufDepan = kav.charAt(0).toUpperCase();
    return isNaN(hurufDepan) && hurufDepan !== "" ? "Blok " + hurufDepan : "Blok Lainnya";
  } else if (perum === "D Green Jatihandap" || perum === "DGJH") {
    return "DGJH";
  } else if (perum === "Blok Luar") {
    return "Blok Luar";
  }
  return perum || "Lainnya";
}

function getDaftarTab(list) {
  const setTab = new Set();
  list.forEach(item => setTab.add(getKategoriTab(item)));
  
  return Array.from(setTab).sort((a, b) => {
    if (a === "Blok Luar") return 1;
    if (b === "Blok Luar") return -1;
    if (a === "DGJH") return 1;
    if (b === "DGJH") return -1;
    return a.localeCompare(b);
  });
}

function renderPerumahanTabs() {
  const listTabMeter = getDaftarTab(rawListMeter);
  let tabsMeterHtml = "";
  listTabMeter.forEach(tab => {
    const isActive = activeTabMeter === tab;
    tabsMeterHtml += `<button onclick="setTabMeter('${tab}')" class="px-3.5 py-1.5 rounded-lg border transition-all font-bold ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-blue-600 hover:border-slate-300'}">${tab}</button>`;
  });
  const containerMeter = document.getElementById("containerBlokTabMeter");
  if (containerMeter) containerMeter.innerHTML = tabsMeterHtml;

  const listTabTagihan = getDaftarTab(rawListTagihan);
  let tabsTagihanHtml = "";
  listTabTagihan.forEach(tab => {
    const isActive = activeTabTagihan === tab;
    tabsTagihanHtml += `<button onclick="setTabTagihan('${tab}')" class="px-3.5 py-1.5 rounded-lg border transition-all font-bold ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-blue-600 hover:border-slate-300'}">${tab}</button>`;
  });
  const containerTagihan = document.getElementById("containerBlokTabTagihan");
  if (containerTagihan) containerTagihan.innerHTML = tabsTagihanHtml;
  
  const listTabPelanggan = getDaftarTab(rawListPelanggan);
  let tabsPelangganHtml = "";
  listTabPelanggan.forEach(tab => {
    const isActive = activeTabPelanggan === tab;
    tabsPelangganHtml += `<button onclick="setTabPelanggan('${tab}')" class="px-3.5 py-1.5 rounded-lg border transition-all font-bold ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-blue-600 hover:border-slate-300'}">${tab}</button>`;
  });
  const containerPelanggan = document.getElementById("containerBlokTabPelanggan");
  if (containerPelanggan) containerPelanggan.innerHTML = tabsPelangganHtml;
}

function setTabMeter(tab) {
  if (typeof isFilterBelumDicatatActive !== 'undefined') isFilterBelumDicatatActive = false; 
  activeTabMeter = tab;
  paginationState['meter'].page = 1;
  renderPerumahanTabs();
  if (typeof filterMeterTable === 'function') filterMeterTable();
}

function setTabTagihan(tab) {
  if (typeof isFilterBelumBayarActive !== 'undefined') isFilterBelumBayarActive = false; 
  activeTabTagihan = tab;
  paginationState['tagihan'].page = 1;
  renderPerumahanTabs();
  if (typeof filterTagihanTable === 'function') filterTagihanTable();
}

function setTabPelanggan(tab) {
  activeTabPelanggan = tab;
  paginationState['pelanggan'].page = 1;
  renderPerumahanTabs();
  if (typeof filterPelangganTable === 'function') {
    filterPelangganTable();
  }
}

function aturMenuBerdasarkanRole(role, nama) {
  const profileNav = document.getElementById("userProfileNav");
  if (profileNav) profileNav.innerText = nama + " (" + role + ")";
  
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.add('hidden'));

  if (role === "Super Admin") {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('hidden'));
    switchTab('tabMeter');
  } else if (role === "Admin Tagihan") {
    const btnMeter = document.getElementById("btn-tabMeter");
    const btnTagihan = document.getElementById("btn-tabTagihan");
    const btnPelanggan = document.getElementById("btn-tabPelanggan");
    
    // Pastikan tombol Tunggakan & Deposit dideklarasikan di sini
    const btnTunggakan = document.getElementById("btn-tabTunggakan");
    const btnDeposit = document.getElementById("btn-tabDeposit");

    if (btnMeter) btnMeter.classList.remove('hidden');
    if (btnTagihan) btnTagihan.classList.remove('hidden');
    if (btnPelanggan) btnPelanggan.classList.remove('hidden');
    
    // Buka akses tampil untuk Admin Tagihan
    if (btnTunggakan) btnTunggakan.classList.remove('hidden');
    if (btnDeposit) btnDeposit.classList.remove('hidden');

    switchTab('tabMeter');
  } else if (role === "Petugas Lapangan") {
    const btnMeter = document.getElementById("btn-tabMeter");
    if (btnMeter) btnMeter.classList.remove('hidden');
    switchTab('tabMeter');
  } else if (role === "Viewer") {
    const btnMeter = document.getElementById("btn-tabMeter");
    const btnTagihan = document.getElementById("btn-tabTagihan");
    const btnPelanggan = document.getElementById("btn-tabPelanggan");
    const btnTunggakan = document.getElementById("btn-tabTunggakan");
    const btnDeposit = document.getElementById("btn-tabDeposit");

    if (btnMeter) btnMeter.classList.remove('hidden');
    if (btnTagihan) btnTagihan.classList.remove('hidden');
    if (btnPelanggan) btnPelanggan.classList.remove('hidden');
    if (btnTunggakan) btnTunggakan.classList.remove('hidden');
    if (btnDeposit) btnDeposit.classList.remove('hidden');
    
    switchTab('tabMeter');
  }
}

// === KEAMANAN ANTI-BOT (CAPTCHA MANDIRI) ===
let captchaNum1 = 0;
let captchaNum2 = 0;

function generateLoginCaptcha() {
  captchaNum1 = Math.floor(Math.random() * 9) + 1;
  captchaNum2 = Math.floor(Math.random() * 9) + 1;

  const soalEl = document.getElementById("captchaSoalText");
  const inputAnsEl = document.getElementById("inputCaptchaJawaban");

  if (soalEl) soalEl.innerText = `${captchaNum1} + ${captchaNum2} = ?`;
  if (inputAnsEl) inputAnsEl.value = "";
}

function toggleRobotCaptcha(checkboxEl) {
  const boxChallenge = document.getElementById("boxCaptchaChallenge");
  const inputAnsEl = document.getElementById("inputCaptchaJawaban");

  if (checkboxEl && checkboxEl.checked) {
    generateLoginCaptcha();
    if (boxChallenge) boxChallenge.classList.remove("hidden");
    if (inputAnsEl) setTimeout(() => inputAnsEl.focus(), 50);
  } else {
    if (boxChallenge) boxChallenge.classList.add("hidden");
    if (inputAnsEl) inputAnsEl.value = "";
  }
}

async function handleLoginMulti(e) {
  e.preventDefault();
  const username = document.getElementById("inputUsername").value;
  const pass = document.getElementById("inputPassword").value;
  const btn = document.getElementById("btnLogin");

  const chkRobot = document.getElementById("chkBukanRobot");
  const hpWebsiteEl = document.getElementById("inputHpWebsite");
  const captchaAnsEl = document.getElementById("inputCaptchaJawaban");

  const hpWebsite = hpWebsiteEl ? hpWebsiteEl.value : "";
  const captchaAnswer = captchaAnsEl ? captchaAnsEl.value.trim() : "";

  if (hpWebsite.trim() !== "") {
    showToast("Verifikasi keamanan gagal.", "error");
    return;
  }

  if (!chkRobot || !chkRobot.checked) {
    showToast("Silakan centang 'Saya bukan robot' terlebih dahulu.", "error");
    return;
  }

  if (captchaAnswer === "" || parseInt(captchaAnswer, 10) !== (captchaNum1 + captchaNum2)) {
    showToast("Jawaban verifikasi hitungan belum tepat. Silakan coba lagi.", "error");
    generateLoginCaptcha();
    if (captchaAnsEl) captchaAnsEl.focus();
    return;
  }

  if (btn) btn.innerText = "Memverifikasi...";

  const res = await callApi({
    action: "loginAdmin",
    username: username,
    password: pass,
    hpWebsite: hpWebsite,
    isHumanChecked: chkRobot.checked,
    captchaNum1: captchaNum1,
    captchaNum2: captchaNum2,
    captchaAnswer: captchaAnswer
  });

  if (res && res.status === "success") {
    sessionStorage.setItem("user_session", JSON.stringify(res.user));
    const modalLogin = document.getElementById("modalLogin");
    if (modalLogin) modalLogin.classList.add("hidden");
    showToast("Selamat datang, " + res.user.nama, "success");
    aturMenuBerdasarkanRole(res.user.role, res.user.nama);
    loadDashboardData();
    loadDataPelanggan();

    if (!backgroundSyncTimer) backgroundSyncTimer = setInterval(backgroundSyncData, 10000);
  } else {
    showToast(res ? res.message : "Terjadi kesalahan koneksi", "error");
    if (chkRobot) chkRobot.checked = false;
    const boxChallenge = document.getElementById("boxCaptchaChallenge");
    if (boxChallenge) boxChallenge.classList.add("hidden");
    generateLoginCaptcha();
  }

  if (btn) {
    btn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i> Masuk Dashboard`;
    lucide.createIcons();
  }
}

function handleLogout() {
  if (backgroundSyncTimer) clearInterval(backgroundSyncTimer);
  sessionStorage.removeItem("user_session");
  location.reload();
}

let cachedWaCsAir = "";

async function loadWaCsAir() {
  if (cachedWaCsAir) return cachedWaCsAir;
  const res = await callApi({ action: "getWaCs" });
  if (res && res.status === "success" && res.waCs) {
    cachedWaCsAir = res.waCs;
  }
  return cachedWaCsAir;
}

// === KEAMANAN ANTI-BOT MODAL RESET PASSWORD ===
let resetCaptchaNum1 = 0;
let resetCaptchaNum2 = 0;

function generateResetCaptcha() {
  resetCaptchaNum1 = Math.floor(Math.random() * 9) + 1;
  resetCaptchaNum2 = Math.floor(Math.random() * 9) + 1;

  const soalEl = document.getElementById("captchaSoalTextReset");
  const inputAnsEl = document.getElementById("inputCaptchaJawabanReset");

  if (soalEl) soalEl.innerText = `${resetCaptchaNum1} + ${resetCaptchaNum2} = ?`;
  if (inputAnsEl) inputAnsEl.value = "";
}

function toggleRobotCaptchaReset(checkboxEl) {
  const boxChallenge = document.getElementById("boxCaptchaChallengeReset");
  const inputAnsEl = document.getElementById("inputCaptchaJawabanReset");

  if (checkboxEl && checkboxEl.checked) {
    generateResetCaptcha();
    if (boxChallenge) boxChallenge.classList.remove("hidden");
    if (inputAnsEl) setTimeout(() => inputAnsEl.focus(), 50);
  } else {
    if (boxChallenge) boxChallenge.classList.add("hidden");
    if (inputAnsEl) inputAnsEl.value = "";
  }
}

function openLupaPassword() { 
  const modal = document.getElementById("modalLupaPass");
  if (modal) modal.classList.remove("hidden");

  const chkReset = document.getElementById("chkBukanRobotReset");
  const boxReset = document.getElementById("boxCaptchaChallengeReset");
  if (chkReset) chkReset.checked = false;
  if (boxReset) boxReset.classList.add("hidden");
  generateResetCaptcha();

  loadWaCsAir();
}

function closeLupaPassword() { 
  const modal = document.getElementById("modalLupaPass");
  if (modal) modal.classList.add("hidden"); 
}

async function mintaResetWa() {
  let nomorWa = cachedWaCsAir;
  if (!nomorWa) {
    showToast("Mengambil nomor WA CS dari pengaturan...", "info");
    nomorWa = await loadWaCsAir();
  }

  if (!nomorWa) {
    showToast("Nomor WA CS (wa_cs_air) belum diatur di sheet Pengaturan.", "error");
    return;
  }

  window.open("https://wa.me/" + nomorWa + "?text=" + encodeURIComponent("Halo, saya lupa password akun pengelola Air."), "_blank");
}

async function handleResetMaster(e) {
  e.preventDefault();
  const targetUser = document.getElementById("resetUsernameTarget").value;
  const masterKey = document.getElementById("inputMasterKey").value;
  const passBaru = document.getElementById("inputPassBaru").value;

  const chkRobot = document.getElementById("chkBukanRobotReset");
  const hpWebsiteEl = document.getElementById("inputHpWebsiteReset");
  const captchaAnsEl = document.getElementById("inputCaptchaJawabanReset");

  const hpWebsite = hpWebsiteEl ? hpWebsiteEl.value : "";
  const captchaAnswer = captchaAnsEl ? captchaAnsEl.value.trim() : "";

  if (hpWebsite.trim() !== "") {
    showToast("Verifikasi keamanan gagal.", "error");
    return;
  }

  if (!chkRobot || !chkRobot.checked) {
    showToast("Silakan centang 'Saya bukan robot' terlebih dahulu.", "error");
    return;
  }

  if (captchaAnswer === "" || parseInt(captchaAnswer, 10) !== (resetCaptchaNum1 + resetCaptchaNum2)) {
    showToast("Jawaban verifikasi hitungan belum tepat. Silakan coba lagi.", "error");
    generateResetCaptcha();
    if (captchaAnsEl) captchaAnsEl.focus();
    return;
  }

  const res = await callApi({
    action: "resetPasswordMaster",
    username: targetUser,
    masterKey: masterKey,
    passwordBaru: passBaru,
    hpWebsite: hpWebsite,
    isHumanChecked: chkRobot.checked,
    captchaNum1: resetCaptchaNum1,
    captchaNum2: resetCaptchaNum2,
    captchaAnswer: captchaAnswer
  });

  if (res && res.status === "success") {
    showToast(res.message, "success");
    closeLupaPassword();
  } else {
    showToast(res ? res.message : "Gagal melakukan reset", "error");
    if (chkRobot) chkRobot.checked = false;
    const boxReset = document.getElementById("boxCaptchaChallengeReset");
    if (boxReset) boxReset.classList.add("hidden");
    generateResetCaptcha();
  }
}

function togglePassVisibility() {
  const input = document.getElementById("inputPassword");
  const icon = document.getElementById("iconEye");
  if (input) {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    if (icon) {
      icon.setAttribute("data-lucide", isPassword ? "eye-off" : "eye");
      if (typeof lucide !== "undefined" && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  }
}

function togglePassBaruVisibility() {
  const input = document.getElementById("inputPassBaru");
  const icon = document.getElementById("iconEyePassBaru");
  if (input) {
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    if (icon) {
      icon.setAttribute("data-lucide", isPassword ? "eye-off" : "eye");
      if (typeof lucide !== "undefined" && lucide.createIcons) {
        lucide.createIcons();
      }
    }
  }
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => {
    el.classList.remove('bg-blue-600', 'text-white', 'shadow-md');
    el.classList.add('text-slate-700', 'hover:bg-slate-100', 'hover:text-blue-600');
  });
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.remove('hidden');

  const targetBtn = document.getElementById('btn-' + tabId);
  if (targetBtn) {
    targetBtn.classList.remove('text-slate-700', 'hover:bg-slate-100', 'hover:text-blue-600');
    targetBtn.classList.add('bg-blue-600', 'text-white', 'shadow-md');
  }

  if (tabId === 'tabPelanggan') {
    loadDataPelanggan();
  }
}

function bukaTabTunggakan() {
  const tabTagihanEl = document.getElementById("tabTagihan");
  if (tabTagihanEl && tabTagihanEl.classList.contains("hidden")) {
    showToast("Silakan aktifkan tab 'Tagihan & Unduh PDF' terlebih dahulu untuk melihat Tunggakan.", "info");
    return;
  }

  switchTab('tabTunggakan');
  if (typeof rawListTunggakan !== 'undefined') {
    renderTunggakanTable(rawListTunggakan);
  }
}

function filterPelangganByStatusCard() {
  switchTab('tabPelanggan');
  showToast("Menampilkan seluruh direktori data pelanggan.", "info");
}