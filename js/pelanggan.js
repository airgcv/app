function setTabPelanggan(tab) {
  activeTabPelanggan = tab;
  renderPerumahanTabs();
  filterPelangganTable();
}

function filterPelangganTable() {
  const searchInput = document.getElementById("searchPelanggan");
  if (!searchInput) return;
  
  const searchVal = searchInput.value.toLowerCase().trim();
  const btnClear = document.getElementById("btnClearSearchPelanggan");

  if (searchVal.length > 0) btnClear.classList.remove("hidden");
  else btnClear.classList.add("hidden");

  const filtered = rawListPelanggan.filter(p => {
    const kavStr = p.kavling ? String(p.kavling).toLowerCase() : "";
    const namaStr = p.nama ? String(p.nama).toLowerCase() : "";
    
    const matchSearch = kavStr.includes(searchVal) || namaStr.includes(searchVal);
    
    let matchTab = true;
    try {
        matchTab = getKategoriTab(p) === activeTabPelanggan;
    } catch(e) {
        matchTab = false;
    }
    
    return matchSearch && matchTab;
  });

  renderTabelPelanggan(filtered);
}

function clearSearchPelanggan() {
  document.getElementById("searchPelanggan").value = "";
  filterPelangganTable();
}

function renderTabelPelanggan(list) {
  const tbody = document.getElementById("tbodyPelanggan");
  if (!tbody) return;

  // 🔥 HANYA SUPER ADMIN YANG BISA MENAMBAH & MENGEDIT DATA PELANGGAN
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  const isSuperAdmin = activeSess.role === "Super Admin";

  const btnTambah = document.querySelector("button[onclick='bukaModalPelanggan()']");
  if (btnTambah) {
    btnTambah.style.display = isSuperAdmin ? 'inline-flex' : 'none';
  }

  updatePaginationUI('pelanggan', list.length);
  const paginatedList = getPaginatedData(list, 'pelanggan');

  if (paginatedList && paginatedList.length > 0) {
    tbody.innerHTML = paginatedList.map(p => {
      const statusKav = p.statusKavling ? p.statusKavling.toString().trim() : 'Aktif';
      const isAktif = statusKav.toUpperCase() === 'AKTIF';
      const badgeClass = isAktif ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800 border border-rose-200';

      return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-2.5 px-3.5 font-bold text-blue-950">${p.kavling}</td>
        <td class="py-2.5 px-3.5 text-slate-600 font-semibold">${p.perumahan || '-'}</td>
        <td class="py-2.5 px-3.5 font-bold text-slate-900">${p.nama}</td>
        <td class="py-2.5 px-3.5">${p.noWa || '-'}</td>
        <td class="py-2.5 px-3.5">
          <span class="px-2.5 py-1 rounded-md text-[10px] font-bold ${badgeClass}">
            ${statusKav}
          </span>
        </td>
        <td class="py-2.5 px-3.5 text-slate-600">${p.keterangan || '-'}</td>
        <td class="py-2.5 px-3.5 text-center">
          ${!isSuperAdmin ? '<span class="text-slate-400 text-[10px] font-medium">View Only</span>' : `
            <button onclick="editPelanggan('${p.kavling}')" class="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-lg transition-all shadow-sm" title="Edit Pelanggan">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
          `}
        </td>
      </tr>
    `}).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 font-medium">Belum ada data pelanggan pada blok ini.</td></tr>`;
  }
  lucide.createIcons();
}

function bukaModalPelanggan() {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role !== "Super Admin") return;

  document.getElementById("formKavling").value = "";
  document.getElementById("formKavling").disabled = false;
  document.getElementById("formPerumahan").value = "The Green City View";
  document.getElementById("formNama").value = "";
  document.getElementById("formNoWa").value = "";
  document.getElementById("formStatusKavling").value = "Aktif";
  document.getElementById("formKeterangan").value = "Dihuni Pemilik";
  document.getElementById("modalPelangganTitle").innerHTML = `<i data-lucide="user-plus" class="w-4 h-4 text-blue-600"></i> Tambah Pelanggan Baru`;
  document.getElementById("modalFormPelanggan").classList.remove("hidden");
  lucide.createIcons();
}

function tutupModalPelanggan() {
  document.getElementById("modalFormPelanggan").classList.add("hidden");
}

function editPelanggan(kavling) {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role !== "Super Admin") return;

  const p = rawListPelanggan.find(item => item.kavling.toUpperCase() === kavling.toUpperCase());
  if (!p) return;

  document.getElementById("formKavling").value = p.kavling;
  document.getElementById("formKavling").disabled = true; 
  document.getElementById("formPerumahan").value = p.perumahan || "The Green City View";
  document.getElementById("formNama").value = p.nama || "";
  document.getElementById("formNoWa").value = p.noWa || "";
  document.getElementById("formStatusKavling").value = p.statusKavling || "Aktif";
  document.getElementById("formKeterangan").value = p.keterangan || "Dihuni Pemilik";

  document.getElementById("modalPelangganTitle").innerHTML = `<i data-lucide="edit-3" class="w-4 h-4 text-blue-600"></i> Edit Data Pelanggan (${kavling})`;
  document.getElementById("modalFormPelanggan").classList.remove("hidden");
  lucide.createIcons();
}

async function simpanDataPelanggan(e) {
  e.preventDefault();
  
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  if (activeSess.role !== "Super Admin") {
    showToast("Akses ditolak! Hanya Super Admin yang dapat mengubah data pelanggan.", "error");
    return;
  }
  
  const inputKavlingEl = document.getElementById("formKavling");
  const kavling = inputKavlingEl.value.trim().toUpperCase();
  const perumahan = document.getElementById("formPerumahan").value;
  const nama = document.getElementById("formNama").value.trim();
  let rawNoWa = document.getElementById("formNoWa").value.trim();
  const statusKavling = document.getElementById("formStatusKavling").value;
  const keterangan = document.getElementById("formKeterangan").value;

  if (!inputKavlingEl.disabled) {
    const isExist = rawListPelanggan.some(p => p.kavling.toUpperCase() === kavling);
    if (isExist) {
      showToast(`Gagal! No. Kavling ${kavling} sudah terdaftar.`, "error");
      return; 
    }
  }

  let cleanNoWa = rawNoWa.replace(/\D/g, ''); 
  let formattedNoWa = cleanNoWa;

  if (formattedNoWa.startsWith("0")) {
    formattedNoWa = "62" + formattedNoWa.substring(1);
  } else if (formattedNoWa.startsWith("8")) {
    formattedNoWa = "62" + formattedNoWa;
  }

  tutupModalPelanggan();
  showToast("Menyimpan data pelanggan...", "info");

  const res = await callApi({
    action: "simpanDataPelanggan",
    kavling: kavling,
    perumahan: perumahan,
    nama: nama,
    noWa: formattedNoWa,
    statusKavling: statusKavling,
    keterangan: keterangan
  });

  if (res.status === "success") {
    showToast(res.message || "Data pelanggan berhasil disimpan!", "success");
    loadDataPelanggan();
    loadDashboardData();
  } else {
    showToast(res.message || "Gagal menyimpan data pelanggan.", "error");
  }
}