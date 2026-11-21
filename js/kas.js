function renderRiwayatKasTable() {
  const tbody = document.getElementById("tbodyKasRiwayat");
  const totalEl = document.getElementById("totalKasPeriode");
  if (!tbody || !totalEl) return;

  const [startStr, endStr] = activeSiklusKas.split("_");
  const sParts = startStr.split("-");
  const startDate = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0);
  const eParts = endStr.split("-");
  const endDate = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59);

  const filtered = rawListKas.filter(item => {
    let parts = item.tanggal.includes('/') ? item.tanggal.split('/') : item.tanggal.split('-');
    let itemDate = item.tanggal.includes('/') 
      ? new Date(parts[2], parts[1]-1, parts[0], 12, 0, 0) 
      : new Date(parts[0], parts[1]-1, parts[2], 12, 0, 0);
    return itemDate >= startDate && itemDate <= endDate;
  });

  updatePaginationUI('kas', filtered.length);
  const paginatedList = getPaginatedData(filtered, 'kas');

  let netSaldo = 0;

  if (paginatedList.length > 0) {
    tbody.innerHTML = paginatedList.map(k => {
      let nominalVal = Number(k.nominal) || 0;
      let jenis = (k.jenis || "Pengeluaran").trim();
      
      let formattedNominal = new Intl.NumberFormat('id-ID').format(nominalVal);
      let jenisBadge = jenis.toLowerCase() === "pemasukan" 
        ? `<span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold text-[10px]">Pemasukan</span>`
        : `<span class="bg-rose-100 text-rose-800 px-2 py-0.5 rounded font-bold text-[10px]">Pengeluaran</span>`;
        
      let linkNotaHtml = k.linkNota && k.linkNota !== "-" ? `<a href="${k.linkNota}" target="_blank" class="text-blue-600 underline font-bold">Lihat Nota</a>` : '-';

      return `
        <tr>
          <td class="py-2.5 px-3.5">${k.tanggal}</td>
          <td class="py-2.5 px-3.5">${jenisBadge}</td>
          <td class="py-2.5 px-3.5 font-bold text-slate-900">${k.kategori}</td>
          <td class="py-2.5 px-3.5">${k.keterangan}</td>
          <td class="py-2.5 px-3.5 font-bold ${jenis.toLowerCase() === 'pemasukan' ? 'text-emerald-600' : 'text-rose-600'}">Rp ${formattedNominal}</td>
          <td class="py-2.5 px-3.5">${linkNotaHtml}</td>
        </tr>
      `;
    }).join('');
  } else {
    tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400">Belum ada catatan transaksi kas pada periode siklus ini.</td></tr>`;
  }

  filtered.forEach(k => {
      let nominalVal = Number(k.nominal) || 0;
      let jenis = (k.jenis || "Pengeluaran").trim();
      if (jenis.toLowerCase() === "pemasukan") netSaldo += nominalVal;
      else netSaldo -= nominalVal;
  });

  totalEl.innerText = "Rp " + new Intl.NumberFormat('id-ID').format(netSaldo);
}

function onChangePeriodeKas(val) {
  activeSiklusKas = val;
  renderRiwayatKasTable();
}

function toggleFormKas() {
  const wrapper = document.getElementById("wrapperFormKas");
  const txtBtn = document.getElementById("txtBtnForm");
  if (wrapper.classList.contains("hidden")) {
    wrapper.classList.remove("hidden");
    txtBtn.innerText = "Tutup Form Input";
  } else {
    wrapper.classList.add("hidden");
    txtBtn.innerText = "Buka Form Input / Tambah";
  }
}

function formatInputNominal(input) {
  let value = input.value.replace(/[^,\d]/g, '').toString();
  let split = value.split(',');
  let sisa = split[0].length % 3;
  let rupiah = split[0].substr(0, sisa);
  let ribuan = split[0].substr(sisa).match(/\d{3}/gi);

  if (ribuan) {
    let separator = sisa ? '.' : '';
    rupiah += separator + ribuan.join('.');
  }

  rupiah = split[1] !== undefined ? rupiah + ',' + split[1] : rupiah;
  input.value = rupiah;

  document.getElementById("kasNominalValue").value = value.replace(/\./g, '');
}

function formatTitleCase(input) {
  let words = input.value.toLowerCase().split(' ');
  for (let i = 0; i < words.length; i++) {
    if (words[i]) {
      words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
    }
  }
  input.value = words.join(' ');
}

function convertDateToIdFormat(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

async function simpanKas(e) {
  e.preventDefault();
  showToast("Menyimpan transaksi kas...", "info");

  const rawDate = document.getElementById("kasTanggal").value;
  const formattedDate = convertDateToIdFormat(rawDate);
  const nominalClean = document.getElementById("kasNominalValue").value;

  const res = await callApi({
    action: "simpanKas",
    tanggal: formattedDate,
    jenis: document.getElementById("kasJenis").value,
    kategori: document.getElementById("kasKategori").value,
    nominal: nominalClean,
    keterangan: document.getElementById("kasKet").value,
    linkNota: document.getElementById("kasLinkNota").value || "-"
  });

  if (res.status === "success") {
    showToast(res.message, "success");
    document.getElementById("kasNominalDisplay").value = "";
    document.getElementById("kasNominalValue").value = "";
    document.getElementById("kasKet").value = "";
    document.getElementById("kasLinkNota").value = "";
    loadRiwayatKas();
  } else {
    showToast(res.message, "error");
  }
}

function exportExcelKas() {
  if (!rawListKas || rawListKas.length === 0) {
    showToast("Tidak ada data kas untuk diexport.", "error");
    return;
  }

  const [startStr, endStr] = activeSiklusKas.split("_");
  const sParts = startStr.split("-");
  const startDate = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0);
  const eParts = endStr.split("-");
  const endDate = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59);

  const filteredKas = rawListKas.filter(item => {
    let parts = item.tanggal.includes('/') ? item.tanggal.split('/') : item.tanggal.split('-');
    let itemDate = item.tanggal.includes('/') 
      ? new Date(parts[2], parts[1]-1, parts[0], 12, 0, 0) 
      : new Date(parts[0], parts[1]-1, parts[2], 12, 0, 0);
    return itemDate >= startDate && itemDate <= endDate;
  });

  if (filteredKas.length === 0) {
    showToast("Tidak ada data kas pada periode siklus ini untuk diexport.", "error");
    return;
  }

  const excelData = filteredKas.map(k => ({
    "ID Transaksi": k.idKas || '',
    "Tanggal": k.tanggal || '',
    "Jenis Transaksi": k.jenis || 'Pengeluaran',
    "Kategori": k.kategori || '',
    "Nominal (Rp)": Number(k.nominal) || 0,
    "Uraian / Keterangan": k.keterangan || '',
    "Link Nota": k.linkNota || '-'
  }));

  const selSiklus = document.getElementById("selectPeriodeKas");
  const labelPeriode = selSiklus ? selSiklus.options[selSiklus.selectedIndex].text : activeSiklusKas;

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Keuangan Kas");
  
  XLSX.writeFile(workbook, `Laporan_Kas_${labelPeriode.replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`);
  showToast("File Excel Kas berhasil diunduh!", "success");
}

function exportPdfKas() {
  const [startStr, endStr] = activeSiklusKas.split("_");
  const sParts = startStr.split("-");
  const startDate = new Date(sParts[0], sParts[1] - 1, sParts[2], 0, 0, 0);
  const eParts = endStr.split("-");
  const endDate = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59);

  let saldoAwal = 0;
  let totalPengeluaran = 0;
  const filtered = [];

  rawListKas.forEach(item => {
    let parts = item.tanggal.includes('/') ? item.tanggal.split('/') : item.tanggal.split('-');
    let yyyy = item.tanggal.includes('/') ? parts[2] : parts[0];
    let mm = item.tanggal.includes('/') ? parts[1] : parts[1];
    let dd = item.tanggal.includes('/') ? parts[0] : parts[2];
    let itemDate = new Date(yyyy, mm - 1, dd, 12, 0, 0);
    
    let nominal = Number(item.nominal) || 0;
    let jenis = (item.jenis || "").trim().toLowerCase();
    let kategori = (item.kategori || "").trim().toLowerCase();
    let yyyymmdd = `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;

    if (kategori.includes("dana operasional") && jenis === "pemasukan" && yyyymmdd === startStr) {
        saldoAwal = nominal;
    }

    if (itemDate < startDate) {
        if (jenis === "pemasukan") saldoAwal += nominal;
        else saldoAwal -= nominal;
    } else if (itemDate >= startDate && itemDate <= endDate) {
        filtered.push(item);
    }
  });

  if (filtered.length === 0 && saldoAwal === 0) {
    showToast("Tidak ada data transaksi kas pada periode siklus ini untuk diexport.", "error");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const selSiklus = document.getElementById("selectPeriodeKas");
  const labelPeriode = selSiklus ? selSiklus.options[selSiklus.selectedIndex].text : activeSiklusKas;

  const monthsFull = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  let namaBulanSiklus = monthsFull[startDate.getMonth()];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`LAPORAN PENGELUARAN BIAYA OPERASIONAL (PERIODE ${labelPeriode.toUpperCase()})`, 14, 15);
  
  let runningSaldo = 0;
  let tableRows = [];
  let sumDebit = 0;
  let sumKredit = 0;

  filtered.forEach((k, index) => {
    let nominal = Number(k.nominal) || 0;
    let jenis = (k.jenis || "Pengeluaran").trim().toLowerCase();
    let debetStr = "";
    let kreditStr = "";

    if (jenis === "pemasukan") {
      runningSaldo += nominal;
      sumKredit += nominal;
      kreditStr = new Intl.NumberFormat('id-ID').format(nominal);
    } else {
      totalPengeluaran += nominal;
      sumDebit += nominal;
      runningSaldo -= nominal;
      debetStr = new Intl.NumberFormat('id-ID').format(nominal);
    }

    tableRows.push([
      index + 1,
      k.tanggal,
      k.keterangan || k.kategori,
      debetStr,
      kreditStr,
      new Intl.NumberFormat('id-ID').format(runningSaldo)
    ]);
  });

  tableRows.push([
    '',
    '',
    'TOTAL / SALDO AKHIR',
    new Intl.NumberFormat('id-ID').format(sumDebit),
    new Intl.NumberFormat('id-ID').format(sumKredit),
    new Intl.NumberFormat('id-ID').format(runningSaldo)
  ]);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  let textSaldoAwal = `Rp ${new Intl.NumberFormat('id-ID').format(saldoAwal)}`;
  let textTotalKeluar = `Rp ${new Intl.NumberFormat('id-ID').format(totalPengeluaran)}`;
  let textSisaSaldo = `Rp ${new Intl.NumberFormat('id-ID').format(runningSaldo)}`;

  doc.text(`Saldo Awal ${namaBulanSiklus}`, 14, 23);
  doc.text(textSaldoAwal, 196, 23, { align: 'right' });

  doc.text(`Total Pengeluaran ${namaBulanSiklus}`, 14, 28);
  doc.text(textTotalKeluar, 196, 28, { align: 'right' });

  doc.text(`Sisa Saldo ${namaBulanSiklus}`, 14, 33);
  doc.text(textSisaSaldo, 196, 33, { align: 'right' });

  doc.autoTable({
    startY: 38,
    head: [['NO', 'Tanggal', 'Uraian', 'Debit', 'Kredit', 'Saldo']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8.5, cellPadding: 1.5, lineWidth: 0.1, lineColor: [0, 0, 0] },
    bodyStyles: { fontSize: 8.5, textColor: [0, 0, 0], cellPadding: 1.5, lineWidth: 0.1, lineColor: [0, 0, 0] },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 22 },
      2: { cellWidth: 84 },
      3: { halign: 'right', cellWidth: 23 },
      4: { halign: 'right', cellWidth: 23 },
      5: { halign: 'right', cellWidth: 24 }
    },
    didParseCell: function(data) {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [255, 255, 255];
      }
    }
  });

  doc.save(`Laporan_Kas_${labelPeriode.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`);
  showToast("File PDF Laporan Kas berhasil diunduh!", "success");
}