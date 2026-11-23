// ==========================================
// MODULE: DEPOSIT.JS
// ==========================================

let dataDepositGlobal = [];
let autoRefreshDepositInterval = null;
let isAutoRefreshDepositActive = false;

// Fungsi untuk mengontrol Auto-Sync (Live Refresh Deposit)
function toggleAutoRefreshDeposit() {
  const btnText = document.getElementById("textBtnAutoRefresh");
  const badgeSync = document.getElementById("badgeLiveSync");
  
  isAutoRefreshDepositActive = !isAutoRefreshDepositActive;
  
  if (isAutoRefreshDepositActive) {
    if (btnText) btnText.textContent = "Auto-Sync (ON)";
    if (badgeSync) badgeSync.classList.remove("hidden");
    if (typeof showToast === 'function') showToast("Auto-Sync Deposit diaktifkan (Refresh otomatis tiap 10 detik).", "success");
    
    // Set interval otomatis setiap 10 detik
    autoRefreshDepositInterval = setInterval(() => {
      if (typeof loadDepositData === 'function') {
        loadDepositData();
      }
    }, 10000);
  } else {
    if (btnText) btnText.textContent = "Auto-Sync (OFF)";
    if (badgeSync) badgeSync.classList.add("hidden");
    if (typeof showToast === 'function') showToast("Auto-Sync Deposit dinonaktifkan.", "info");
    
    if (autoRefreshDepositInterval) {
      clearInterval(autoRefreshDepositInterval);
      autoRefreshDepositInterval = null;
    }
  }
}

// Fungsi untuk memuat data deposit dari Backend
async function loadDepositData() {
  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  const isViewer = activeSess.role === "Viewer";
  const btnTambahDeposit = document.querySelector("button[onclick='showUpdateDepositModal()']");
  if (btnTambahDeposit) {
    btnTambahDeposit.style.display = isViewer ? 'none' : 'inline-flex';
  }

  const tbody = document.getElementById("tbodyDeposit");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 font-medium">Memuat data deposit...</td></tr>`;

  try {
    const res = await callApi({ action: "getDepositData", apiKey: API_KEY });
    if (res.status === "success" && res.listDeposit) {
      dataDepositGlobal = res.listDeposit;
      renderDepositTable(dataDepositGlobal);
    } else {
      tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500 font-medium">Gagal memuat data deposit.</td></tr>`;
    }
  } catch (e) {
    console.error("Error loadDepositData:", e);
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-rose-500 font-medium">Terjadi kesalahan koneksi sistem.</td></tr>`;
  }
}

// Render Tabel Data Deposit (Dilengkapi Tombol View Buku Rekening & Update)
function renderDepositTable(list) {
  const tbody = document.getElementById("tbodyDeposit");
  if (!tbody) return;

  const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
  const isViewer = activeSess.role === "Viewer";
  const btnTambahDeposit = document.querySelector("button[onclick='showUpdateDepositModal()']");
  if (btnTambahDeposit) {
    btnTambahDeposit.style.display = isViewer ? 'none' : 'inline-flex';
  }

  if (list && list.length > 0) {
    tbody.innerHTML = list.map((item, index) => {
      const saldoNum = Number(item.saldo) || 0;
      const formattedSaldo = "Rp " + new Intl.NumberFormat('id-ID').format(saldoNum);
      const isMinus = saldoNum < 0;

      return `
        <tr class="hover:bg-slate-50/80 transition-colors">
          <td class="py-3 px-3.5 text-center font-semibold text-slate-500">${index + 1}</td>
          <td class="py-3 px-3.5 font-bold text-slate-900">${item.kavling}</td>
          <td class="py-3 px-3.5 font-semibold text-slate-800">${item.nama || '-'}</td>
          <td class="py-3 px-3.5 text-right font-extrabold ${isMinus ? 'text-rose-600' : 'text-emerald-600'}">${formattedSaldo}</td>
          <td class="py-3 px-3.5 text-center text-slate-600 whitespace-nowrap">${item.tglUpdate || '-'}</td>
          <td class="py-3 px-3.5 text-slate-600 truncate max-w-[200px]" title="${item.keterangan || '-'}">${item.keterangan || '-'}</td>
          <td class="py-3 px-3.5 text-center space-x-1">
            <button onclick="showBukuRekeningModal('${item.kavling}', '${item.nama}')" class="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 p-1.5 rounded-lg font-semibold inline-flex items-center justify-center text-xs transition-all" title="Buku Rekening / Riwayat Mutasi">
              <i data-lucide="book-text" class="w-3.5 h-3.5"></i>
            </button>
            ${isViewer ? '' : `
            <button onclick="showUpdateDepositModal('${item.kavling}', '${item.nama}')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 p-1.5 rounded-lg font-semibold inline-flex items-center justify-center text-xs transition-all" title="Kelola / Update Saldo Deposit">
              <i data-lucide="wallet" class="w-3.5 h-3.5"></i>
            </button>
            `}
          </td>
        </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 font-medium">Belum ada data deposit warga.</td></tr>`;
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Fungsi untuk Membuka Modal Buku Rekening (Statement Mutasi)
async function showBukuRekeningModal(kavling, nama) {
  const modal = document.getElementById("modalBukuRekening");
  const elKav = document.getElementById("bukuRekeningKavling");
  const elNama = document.getElementById("bukuRekeningNama");
  const elSaldo = document.getElementById("bukuRekeningSaldo");
  const tbody = document.getElementById("tbodyBukuRekening");

  if (elKav) elKav.textContent = kavling;
  if (elNama) elNama.textContent = nama || "-";
  if (elSaldo) elSaldo.textContent = "Rp 0";

  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400"><i data-lucide="loader-2" class="w-5 h-5 mx-auto animate-spin mb-2"></i> Mengambil data mutasi...</td></tr>`;
  }
  if (modal) modal.classList.remove("hidden");
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Ambil saldo terkini dari data lokal jika ada
  let saldoTerkini = 0;
  if (typeof dataDepositGlobal !== 'undefined' && dataDepositGlobal.length > 0) {
    const found = dataDepositGlobal.find(d => d.kavling.toUpperCase() === kavling.toUpperCase());
    if (found) {
      saldoTerkini = Number(found.saldo) || 0;
      if (elNama && (!nama || nama === '-')) elNama.textContent = found.nama || '-';
    }
  }
  if (elSaldo) {
    elSaldo.textContent = "Rp " + new Intl.NumberFormat('id-ID').format(saldoTerkini);
  }

  try {
    const res = await callApi({ action: "getRiwayatMutasi", kavling: kavling, apiKey: API_KEY });
    if (res.status === "success") {
      const list = res.data || [];
      if (list.length > 0) {
        tbody.innerHTML = list.map((m) => {
          const nominalNum = Number(m.nominal) || 0;
          const saldoNum = Number(m.saldoAkhir) || 0;
          const isMasuk = m.tipe === "MASUK";
          const formattedNominal = "Rp " + new Intl.NumberFormat('id-ID').format(nominalNum);
          const formattedSaldo = "Rp " + new Intl.NumberFormat('id-ID').format(saldoNum);

           return `
            <tr class="hover:bg-slate-50 transition-colors">
              <td class="py-2.5 px-3.5 text-slate-600 whitespace-nowrap">${m.tglTransaksi || '-'}</td>
              <td class="py-2.5 px-3.5 text-center whitespace-nowrap">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${isMasuk ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                  ${m.tipe}
                </span>
              </td>
              <td class="py-2.5 px-3.5 text-slate-700 whitespace-nowrap">${m.keterangan || '-'}</td>
              <td class="py-2.5 px-3.5 text-right font-bold text-emerald-600 whitespace-nowrap">${isMasuk ? formattedNominal : '-'}</td>
              <td class="py-2.5 px-3.5 text-right font-bold text-rose-600 whitespace-nowrap">${!isMasuk ? formattedNominal : '-'}</td>
              <td class="py-2.5 px-3.5 text-right font-extrabold text-slate-900 bg-blue-50/30 whitespace-nowrap">${formattedSaldo}</td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400 font-medium">Belum ada riwayat mutasi untuk kavling ini.</td></tr>`;
      }
    } else {
      tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-rose-500 font-medium">Gagal memuat riwayat mutasi.</td></tr>`;
    }
  } catch (e) {
    console.error("Error getRiwayatMutasi:", e);
    tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-rose-500 font-medium">Terjadi kesalahan koneksi sistem.</td></tr>`;
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeModalBukuRekening() {
  const modal = document.getElementById("modalBukuRekening");
  if (modal) modal.classList.add("hidden");
}

// Fungsi untuk membuka Modal Update Deposit
function showUpdateDepositModal(kavling = '', nama = '') {
    const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
    if (activeSess.role === "Viewer") {
        if (typeof showToast === 'function') showToast("Akses ditolak! Akun Viewer hanya dapat melihat data.", "error");
        return;
    }

    const elKav = document.getElementById("depKavling");
    const elNama = document.getElementById("depNama");
    const elNom = document.getElementById("depNominal");
    const elKet = document.getElementById("depKeterangan");
    const elTgl = document.getElementById("depTanggal");
    const elBukti = document.getElementById("depBukti");
    const modal = document.getElementById("modalDeposit");

    if (elKav) elKav.value = kavling;
    if (elNama) elNama.value = nama;
    if (elNom) elNom.value = '';
    if (elBukti) elBukti.value = '';
    
    // Set default tanggal hari ini
    if (elTgl) {
        const today = new Date();
        const tzOffset = today.getTimezoneOffset() * 60000;
        elTgl.value = (new Date(today - tzOffset)).toISOString().split('T')[0];
    }
    
    if (elKet) elKet.value = (kavling !== '') ? 'Penyesuaian saldo manual' : 'Top Up saldo';

    if (kavling !== '' && (!nama || nama === 'undefined')) {
        autoFillNamaDeposit();
    }
    
    if (modal) modal.classList.remove("hidden");
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeDepositModal() {
    const modal = document.getElementById("modalDeposit");
    if (modal) modal.classList.add("hidden");
}

// Auto-fill nama warga berdasarkan kavling dari data pelanggan global
function autoFillNamaDeposit() {
    const kavInput = document.getElementById("depKavling");
    const namaInput = document.getElementById("depNama");
    if (!kavInput || !namaInput) return;

    const queryKav = kavInput.value.trim().toUpperCase();
    if (queryKav === "") {
        namaInput.value = "";
        return;
    }

    if (typeof rawListPelanggan !== 'undefined' && rawListPelanggan.length > 0) {
        const found = rawListPelanggan.find(p => p.kavling.toUpperCase() === queryKav);
        if (found) {
            namaInput.value = found.nama;
            return;
        }
    }

    if (typeof dataDepositGlobal !== 'undefined' && dataDepositGlobal.length > 0) {
        const foundDep = dataDepositGlobal.find(d => d.kavling.toUpperCase() === queryKav);
        if (foundDep) {
            namaInput.value = foundDep.nama || "-";
            return;
        }
    }

    namaInput.value = "Warga / Pelanggan Baru";
}

// Format input nominal agar otomatis ada titik ribuan
function formatInputNominal(input) {
    let val = input.value.replace(/[^\d-]/g, ""); 
    let isNegative = val.startsWith("-");
    if (isNegative) val = val.substring(1);

    if (val !== "") {
        let num = parseInt(val, 10);
        if (!isNaN(num)) {
            input.value = (isNegative ? "-" : "") + new Intl.NumberFormat('id-ID').format(num);
        }
    } else {
        input.value = "";
    }
}

// Helper ubah file ke Base64 untuk upload ke Google Drive
function getBase64Deposit(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// Fungsi utama untuk mengirim data mutasi saldo & upload bukti ke Apps Script
async function submitUpdateDeposit() {
    const activeSess = JSON.parse(sessionStorage.getItem("user_session") || "{}");
    if (activeSess.role === "Viewer") {
        if (typeof showToast === 'function') showToast("Akses ditolak! Akun Viewer tidak memiliki izin mengubah deposit.", "error");
        return;
    }

    const kavlingInput = document.getElementById("depKavling");
    const namaInput = document.getElementById("depNama");
    const nominalInput = document.getElementById("depNominal");
    const ketInput = document.getElementById("depKeterangan");
    const tglInput = document.getElementById("depTanggal");
    const buktiInput = document.getElementById("depBukti");
    const btnSubmit = document.getElementById("btnSubmitDeposit");

    const kavling = kavlingInput ? kavlingInput.value.trim().toUpperCase() : '';
    const nama = namaInput ? namaInput.value.trim() : '';
    const rawNominal = nominalInput ? nominalInput.value.replace(/\./g, '').trim() : '';
    const nominal = Number(rawNominal) || 0;
    const keterangan = ketInput ? ketInput.value.trim() : '';
    const tanggalTransaksi = tglInput && tglInput.value ? tglInput.value : new Date().toISOString().split('T')[0];

    if (!kavling || rawNominal === '' || isNaN(nominal) || nominal === 0) {
        if (typeof showToast === 'function') showToast("Kavling dan Nominal wajib diisi dengan benar (tidak boleh 0)!", "error");
        return;
    }

    if (nominal > 0 && (!buktiInput || buktiInput.files.length === 0)) {
        if (typeof showToast === 'function') showToast("Bukti transfer WAJIB diunggah untuk Top-Up Deposit!", "error");
        return;
    }

    let fileBase64 = "";
    let fileName = "";
    let mimeType = "";

    if (buktiInput && buktiInput.files.length > 0) {
        const file = buktiInput.files[0];
        if (file.size > 3 * 1024 * 1024) { 
            if (typeof showToast === 'function') showToast("Ukuran file maksimal 3MB.", "error");
            return;
        }
        try {
            fileBase64 = await getBase64Deposit(file);
            fileName = file.name;
            mimeType = file.type;
        } catch (e) {
            if (typeof showToast === 'function') showToast("Gagal membaca file bukti transfer.", "error");
            return;
        }
    }

    if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Memproses...`;
    }
    if (typeof showToast === 'function') showToast("Menyimpan mutasi deposit & mengupload bukti ke Drive...", "info");

    try {
        const req = await fetch(API_URL, {
            method: "POST",
            body: JSON.stringify({
                action: "updateDeposit",
                apiKey: API_KEY,
                kavling: kavling,
                nama: nama,
                nominal: nominal,
                keterangan: keterangan,
                tanggalTransaksi: tanggalTransaksi,
                fileBase64: fileBase64,
                fileName: fileName,
                mimeType: mimeType
            })
        });
        const res = await req.json();
        
        if (res.status === "success") {
            if (typeof showToast === 'function') showToast(res.message || "Saldo deposit & Mutasi berhasil diperbarui!", "success");
            closeDepositModal();
            loadDepositData(); 
        } else {
            if (typeof showToast === 'function') showToast(res.message || "Gagal memperbarui deposit.", "error");
        }
    } catch (error) {
        console.error("System Error:", error);
        if (typeof showToast === 'function') showToast("Terjadi kesalahan sistem saat menyimpan deposit.", "error");
    } finally {
        if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i data-lucide="save" class="w-4 h-4"></i> Simpan Mutasi`;
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}