/**
 * Antigravity - Transport & Accountabilities REST API Backend
 * Google Apps Script (Code.gs)
 */

/**
 * Handler GET REST API
 */
function doGet(e) {
  var action = e.parameter.action;
  var result;
  
  if (!action) {
    result = { success: false, message: 'Apps Script API aktif. Parameter action diperlukan.' };
    return createJsonResponse(result);
  }
  
  try {
    if (action === 'getDashboard') {
      result = getDashboardData();
    } else if (action === 'getParticipants') {
      result = getParticipants();
    } else if (action === 'getExpenses') {
      result = getExpenses();
    } else if (action === 'getFunds') {
      result = getFundTransactions();
    } else if (action === 'getParticipantRecaps') {
      result = getParticipantRecaps();
    } else if (action === 'getSettings') {
      result = getSettings();
    } else if (action === 'verifyParticipant') {
      result = verifyParticipantAccess(e.parameter.name);
    } else if (action === 'getParticipantDashboard') {
      result = getParticipantDashboard(e.parameter.name);
    } else if (action === 'verifyDocument') {
      result = verifyDocumentCode(e.parameter.code);
    } else if (action === 'generateReport') {
      result = generateReportPDF();
    } else if (action === 'generateTransactionPDF') {
      result = generateTransactionPDF(e.parameter.id, e.parameter.name);
    } else if (action === 'generateParticipantRecapPDF') {
      result = generateParticipantRecapPDF(e.parameter.name);
    } else {
      result = { success: false, message: 'Action GET tidak valid.' };
    }
  } catch (error) {
    result = { success: false, message: error.toString() };
  }
  
  return createJsonResponse(result);
}

/**
 * Handler POST REST API
 */
function doPost(e) {
  var result;
  var postData;
  
  try {
    if (!e.postData || !e.postData.contents) {
      result = { success: false, message: 'Data POST kosong.' };
      return createJsonResponse(result);
    }
    
    postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var data = postData.data;
    
    if (action === 'setup') {
      result = setupSpreadsheet();
    } else if (action === 'saveParticipant') {
      result = saveParticipant(data);
    } else if (action === 'saveFund') {
      result = saveFundTransaction(data);
    } else if (action === 'saveExpense') {
      result = saveExpense(data);
    } else if (action === 'updateExpenseStatus') {
      result = updateExpenseStatus(postData.expenseId, postData.status, postData.rejectionReason);
    } else if (action === 'savePayment') {
      result = savePayment(postData.expenseId, data);
    } else if (action === 'deleteExpense') {
      result = deleteExpense(postData.expenseId);
    } else if (action === 'saveSettings') {
      result = saveSettings(data);
    } else {
      result = { success: false, message: 'Action POST tidak valid.' };
    }
  } catch (error) {
    result = { success: false, message: error.toString() };
  }
  
  return createJsonResponse(result);
}

/**
 * Helper untuk mengembalikan output JSON
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Mendapatkan Spreadsheet database. Jika belum diset di Script Properties,
 * akan mendeteksi spreadsheet aktif atau membuat baru.
 */
function getSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch(e) {
      props.deleteProperty('SPREADSHEET_ID');
    }
  }
  
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      props.setProperty('SPREADSHEET_ID', ss.getId());
      return ss;
    }
  } catch(e) {}
  
  var ss = SpreadsheetApp.create('Database Transport & Pertanggungjawaban Dana');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

/**
 * Mendapatkan folder Google Drive untuk bukti atau laporan.
 * Jika belum ada, otomatis membuat folder baru.
 */
function getFolder(type) {
  var props = PropertiesService.getScriptProperties();
  var propKey = type === 'bukti' ? 'FOLDER_BUKTI_ID' : 'FOLDER_LAPORAN_ID';
  var id = props.getProperty(propKey);
  if (id) {
    try {
      return DriveApp.getFolderById(id);
    } catch(e) {
      props.deleteProperty(propKey);
    }
  }
  
  var folderName = type === 'bukti' ? 'Bukti Pengeluaran Transport' : 'Laporan Pertanggungjawaban Transport';
  var folder = DriveApp.createFolder(folderName);
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {}
  
  props.setProperty(propKey, folder.getId());
  return folder;
}

/**
 * Setup Awal Spreadsheet (Membuat sheet dan mengisi data awal)
 */
function setupSpreadsheet() {
  var ss = getSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  
  // 1. Setup Sheet PESERTA
  var sheetPeserta = ss.getSheetByName('PESERTA');
  if (!sheetPeserta) {
    sheetPeserta = ss.insertSheet('PESERTA');
    var headers = ['ID Peserta', 'Nama', 'Nomor HP', 'Keterangan', 'Status Aktif', 'Dibuat Pada'];
    sheetPeserta.appendRow(headers);
    sheetPeserta.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
    
    var initPeserta = [
      ['PST-001', 'Ridho', '081234567890', 'Peserta 1', 'Aktif', new Date()],
      ['PST-002', 'Budi', '081234567891', 'Peserta 2', 'Aktif', new Date()],
      ['PST-003', 'Ani', '081234567892', 'Peserta 3', 'Aktif', new Date()],
      ['PST-004', 'Joko', '081234567893', 'Peserta 4', 'Aktif', new Date()],
      ['PST-005', 'Siti', '081234567894', 'Peserta 5', 'Aktif', new Date()],
      ['PST-006', 'Rudi', '081234567895', 'Peserta 6', 'Aktif', new Date()]
    ];
    for (var i = 0; i < initPeserta.length; i++) {
      sheetPeserta.appendRow(initPeserta[i]);
    }
  }
  
  // 2. Setup Sheet DANA_MASUK
  var sheetDana = ss.getSheetByName('DANA_MASUK');
  if (!sheetDana) {
    sheetDana = ss.insertSheet('DANA_MASUK');
    var headers = ['ID Dana', 'Tanggal', 'Jenis Dana', 'Nominal', 'Bukti Transfer', 'Keterangan', 'Dibuat Pada'];
    sheetDana.appendRow(headers);
    sheetDana.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
    
    var dpAwal = props.getProperty('DP_AWAL') || '1000000';
    sheetDana.appendRow([
      'DNM-20260806-001',
      new Date(2026, 7, 6),
      'DP Awal',
      Number(dpAwal),
      '',
      'Dana Awal Pertanggungjawaban Transportasi',
      new Date()
    ]);
  }
  
  // 3. Setup Sheet PENGELUARAN
  var sheetPengeluaran = ss.getSheetByName('PENGELUARAN');
  if (!sheetPengeluaran) {
    sheetPengeluaran = ss.insertSheet('PENGELUARAN');
    var headers = [
      'ID Pengeluaran', 'Tanggal Input', 'Nama Peserta', 'Tanggal Perjalanan', 'Jenis Perjalanan', 
      'Lokasi Asal', 'Lokasi Tujuan', 'Jenis Transportasi', 'Nominal', 'Dibayar Oleh', 
      'Link Bukti', 'Keterangan', 'Status Verifikasi', 'Alasan Penolakan', 'Status Pembayaran', 
      'Tanggal Pembayaran', 'Metode Pembayaran', 'Link Bukti Pembayaran', 'Dibuat Pada', 'Diperbarui Pada'
    ];
    sheetPengeluaran.appendRow(headers);
    sheetPengeluaran.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
  }
  
  if (!props.getProperty('NAMA_KEGIATAN')) props.setProperty('NAMA_KEGIATAN', 'Perjalanan Transportasi Bandara');
  if (!props.getProperty('PENANGGUNG_JAWAB')) props.setProperty('PENANGGUNG_JAWAB', 'Admin Transport');
  if (!props.getProperty('MENGETAHUI')) props.setProperty('MENGETAHUI', 'Bendahara Utama');
  if (!props.getProperty('TANGGAL_KEGIATAN')) props.setProperty('TANGGAL_KEGIATAN', '2026-08-06 s/d 2026-08-10');
  if (!props.getProperty('DP_AWAL')) props.setProperty('DP_AWAL', '1000000');
  
  getFolder('bukti');
  getFolder('laporan');
  
  return {
    success: true,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetId: ss.getId(),
    buktiFolderId: props.getProperty('FOLDER_BUKTI_ID'),
    laporanFolderId: props.getProperty('FOLDER_LAPORAN_ID')
  };
}

/**
 * Mendapatkan seluruh Pengaturan Aplikasi
 */
function getSettings() {
  var props = PropertiesService.getScriptProperties();
  return {
    namaKegiatan: props.getProperty('NAMA_KEGIATAN') || 'Perjalanan Transportasi Bandara',
    penanggungJawab: props.getProperty('PENANGGUNG_JAWAB') || 'Admin Transport',
    mengetahui: props.getProperty('MENGETAHUI') || 'Bendahara Utama',
    tanggalKegiatan: props.getProperty('TANGGAL_KEGIATAN') || '2026-08-06 s/d 2026-08-10',
    dpAwal: Number(props.getProperty('DP_AWAL') || '1000000'),
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || '',
    folderBuktiId: props.getProperty('FOLDER_BUKTI_ID') || '',
    folderLaporanId: props.getProperty('FOLDER_LAPORAN_ID') || ''
  };
}

/**
 * Menyimpan Pengaturan Aplikasi
 */
function saveSettings(settings) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('NAMA_KEGIATAN', settings.namaKegiatan);
  props.setProperty('PENANGGUNG_JAWAB', settings.penanggungJawab);
  props.setProperty('MENGETAHUI', settings.mengetahui);
  props.setProperty('TANGGAL_KEGIATAN', settings.tanggalKegiatan);
  props.setProperty('DP_AWAL', settings.dpAwal.toString());
  
  if (settings.spreadsheetId) props.setProperty('SPREADSHEET_ID', settings.spreadsheetId);
  if (settings.folderBuktiId) props.setProperty('FOLDER_BUKTI_ID', settings.folderBuktiId);
  if (settings.folderLaporanId) props.setProperty('FOLDER_LAPORAN_ID', settings.folderLaporanId);
  
  return { success: true, message: 'Pengaturan berhasil disimpan.' };
}

/**
 * Menghasilkan ID Transaksi Unik secara aman (LockService)
 */
function generateTransactionId(sheetName, prefix) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    throw new Error('Gagal mendapatkan lock transaksi. Silakan coba lagi.');
  }
  
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  
  var today = new Date();
  var year = today.getFullYear();
  var month = ('0' + (today.getMonth() + 1)).slice(-2);
  var day = ('0' + today.getDate()).slice(-2);
  var dateStr = year + month + day;
  
  var nextNum = 1;
  if (lastRow > 1) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var maxNum = 0;
    
    if (prefix === 'PST') {
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i][0];
        if (id && id.indexOf('PST-') === 0) {
          var num = parseInt(id.replace('PST-', ''), 10);
          if (num > maxNum) maxNum = num;
        }
      }
      nextNum = maxNum + 1;
      var newId = prefix + '-' + ('00' + nextNum).slice(-3);
      lock.releaseLock();
      return newId;
    } else {
      var expectedPrefix = prefix + '-' + dateStr + '-';
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i][0];
        if (id && id.indexOf(expectedPrefix) === 0) {
          var num = parseInt(id.replace(expectedPrefix, ''), 10);
          if (num > maxNum) maxNum = num;
        }
      }
      nextNum = maxNum + 1;
      var newId = expectedPrefix + ('00' + nextNum).slice(-3);
      lock.releaseLock();
      return newId;
    }
  } else {
    lock.releaseLock();
    if (prefix === 'PST') {
      return 'PST-001';
    } else {
      return prefix + '-' + dateStr + '-001';
    }
  }
}

/**
 * Dashboard Data (Admin)
 */
function getDashboardData() {
  var ss = getSpreadsheet();
  var sheetDana = ss.getSheetByName('DANA_MASUK');
  var dpAwal = 0;
  var totalTambahan = 0;
  
  if (sheetDana && sheetDana.getLastRow() > 1) {
    var dataDana = sheetDana.getRange(2, 1, sheetDana.getLastRow() - 1, 7).getValues();
    for (var i = 0; i < dataDana.length; i++) {
      var jenis = dataDana[i][2];
      var nominal = Number(dataDana[i][3]) || 0;
      if (jenis === 'DP Awal') {
        dpAwal += nominal;
      } else if (jenis === 'Dana Tambahan') {
        totalTambahan += nominal;
      } else if (jenis === 'Penyesuaian') {
        totalTambahan += nominal;
      }
    }
  }
  
  var totalDanaMasuk = dpAwal + totalTambahan;
  
  var sheetPengeluaran = ss.getSheetByName('PENGELUARAN');
  var totalDiajukan = 0;   
  var totalDisetujui = 0;  
  var totalSudahBayar = 0; 
  var totalBelumBayar = 0; 
  var menungguVerifikasi = 0;
  
  if (sheetPengeluaran && sheetPengeluaran.getLastRow() > 1) {
    var dataExp = sheetPengeluaran.getRange(2, 1, sheetPengeluaran.getLastRow() - 1, 20).getValues();
    for (var i = 0; i < dataExp.length; i++) {
      var nominal = Number(dataExp[i][8]) || 0;
      var statusVerif = dataExp[i][12];
      var statusBayar = dataExp[i][14];
      
      if (statusVerif === 'Menunggu') {
        totalDiajukan += nominal;
        menungguVerifikasi++;
      } else if (statusVerif === 'Disetujui') {
        totalDisetujui += nominal;
        
        if (statusBayar === 'Sudah Dibayar') {
          totalSudahBayar += nominal;
        } else if (statusBayar === 'Belum Dibayar') {
          totalBelumBayar += nominal;
        }
      }
    }
  }
  
  var saldoDana = totalDanaMasuk - totalDisetujui;
  var kekuranganDana = totalDisetujui - totalDanaMasuk;
  if (kekuranganDana < 0) kekuranganDana = 0;
  
  var sheetPeserta = ss.getSheetByName('PESERTA');
  var jumlahPeserta = sheetPeserta ? Math.max(0, sheetPeserta.getLastRow() - 1) : 0;
  
  return {
    dpAwal: dpAwal,
    totalTambahan: totalTambahan,
    totalDanaMasuk: totalDanaMasuk,
    totalDiajukan: totalDiajukan,
    totalDisetujui: totalDisetujui,
    totalSudahBayar: totalSudahBayar,
    totalBelumBayar: totalBelumBayar,
    saldoDana: saldoDana,
    kekuranganDana: kekuranganDana,
    menungguVerifikasi: menungguVerifikasi,
    jumlahPeserta: jumlahPeserta
  };
}

/**
 * CRUD Peserta
 */
function getParticipants() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PESERTA');
  var list = [];
  if (sheet && sheet.getLastRow() > 1) {
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();
    for (var i = 0; i < vals.length; i++) {
      list.push({
        id: vals[i][0],
        nama: vals[i][1],
        nohp: vals[i][2],
        keterangan: vals[i][3],
        status: vals[i][4],
        dibuatPada: vals[i][5]
      });
    }
  }
  return list;
}

function saveParticipant(p) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PESERTA');
  if (!sheet) setupSpreadsheet();
  
  if (p.id) {
    var lastRow = sheet.getLastRow();
    var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
    for (var i = 1; i < ids.length; i++) {
      if (ids[i][0] === p.id) {
        var row = i + 1;
        sheet.getRange(row, 2).setValue(p.nama);
        sheet.getRange(row, 3).setValue(p.nohp);
        sheet.getRange(row, 4).setValue(p.keterangan);
        sheet.getRange(row, 5).setValue(p.status);
        return { success: true, message: 'Data peserta berhasil diperbarui.' };
      }
    }
  } else {
    var newId = generateTransactionId('PESERTA', 'PST');
    sheet.appendRow([
      newId,
      p.nama,
      p.nohp,
      p.keterangan,
      'Aktif',
      new Date()
    ]);
    return { success: true, message: 'Peserta baru berhasil disimpan dengan ID ' + newId };
  }
  return { success: false, message: 'Peserta tidak ditemukan.' };
}

/**
 * CRUD Dana Masuk
 */
function getFundTransactions() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('DANA_MASUK');
  var list = [];
  if (sheet && sheet.getLastRow() > 1) {
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      list.push({
        id: vals[i][0],
        tanggal: vals[i][1],
        jenisDana: vals[i][2],
        nominal: Number(vals[i][3]) || 0,
        buktiTransfer: vals[i][4],
        keterangan: vals[i][5],
        dibuatPada: vals[i][6]
      });
    }
  }
  return list;
}

function saveFundTransaction(t) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('DANA_MASUK');
  if (!sheet) setupSpreadsheet();
  
  var newId = generateTransactionId('DANA_MASUK', 'DNM');
  var buktiUrl = '';
  
  if (t.fileData) {
    buktiUrl = uploadFileToDrive(t.fileData, 'Bukti-Dana-' + newId + '-' + t.fileName, getFolder('bukti').getId());
  }
  
  sheet.appendRow([
    newId,
    new Date(t.tanggal),
    t.jenisDana,
    Number(t.nominal),
    buktiUrl,
    t.keterangan,
    new Date()
  ]);
  
  return { success: true, message: 'Dana masuk berhasil dicatat dengan ID ' + newId };
}

/**
 * CRUD Pengeluaran
 */
function getExpenses() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PENGELUARAN');
  var list = [];
  if (sheet && sheet.getLastRow() > 1) {
    var vals = sheet.getRange(2, 1, sheet.getLastRow() - 1, 20).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      list.push({
        id: vals[i][0],
        tanggalInput: vals[i][1],
        namaPeserta: vals[i][2],
        tanggalPerjalanan: vals[i][3],
        jenisPerjalanan: vals[i][4],
        lokasiAsal: vals[i][5],
        lokasiTujuan: vals[i][6],
        jenisTransportasi: vals[i][7],
        nominal: Number(vals[i][8]) || 0,
        dibayarOleh: vals[i][9],
        linkBukti: vals[i][10],
        keterangan: vals[i][11],
        statusVerifikasi: vals[i][12],
        alasanPenolakan: vals[i][13],
        statusPembayaran: vals[i][14],
        tanggalPembayaran: vals[i][15],
        metodePembayaran: vals[i][16],
        linkBuktiPembayaran: vals[i][17],
        dibuatPada: vals[i][18],
        diperbaruiPada: vals[i][19]
      });
    }
  }
  return list;
}

function saveExpense(e) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PENGELUARAN');
  if (!sheet) setupSpreadsheet();
  
  var newId = generateTransactionId('PENGELUARAN', 'TRP');
  var buktiUrl = '';
  
  if (e.fileData) {
    var fileExtension = e.fileName.split('.').pop();
    var cleanParticipant = e.namaPeserta.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    var newFileName = 'Bukti-Transport-' + cleanParticipant + '-' + newId + '.' + fileExtension;
    buktiUrl = uploadFileToDrive(e.fileData, newFileName, getFolder('bukti').getId());
  } else if (e.linkBukti) {
    buktiUrl = e.linkBukti;
  }
  
  var statusPembayaran = 'Belum Dibayar';
  if (e.dibayarOleh === 'Dana Transport') {
    statusPembayaran = 'Tidak Perlu Diganti';
  }
  
  var rowData = [
    newId,
    new Date(),
    e.namaPeserta,
    new Date(e.tanggalPerjalanan),
    e.jenisPerjalanan,
    e.lokasiAsal,
    e.lokasiTujuan,
    e.jenisTransportasi,
    Number(e.nominal),
    e.dibayarOleh,
    buktiUrl,
    e.keterangan || '',
    'Menunggu',
    '',
    statusPembayaran,
    '',
    '',
    '',
    new Date(),
    new Date()
  ];
  
  sheet.appendRow(rowData);
  return { success: true, message: 'Pengeluaran transport berhasil diajukan dengan ID ' + newId };
}

/**
 * Mengubah Status Verifikasi Pengeluaran
 */
function updateExpenseStatus(expenseId, status, rejectionReason) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PENGELUARAN');
  if (!sheet) return { success: false, message: 'Sheet tidak ditemukan.' };
  
  var lastRow = sheet.getLastRow();
  var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    if (ids[i][0] === expenseId) {
      var row = i + 1;
      
      sheet.getRange(row, 13).setValue(status);
      sheet.getRange(row, 14).setValue(rejectionReason || '');
      sheet.getRange(row, 20).setValue(new Date());
      
      if (status === 'Ditolak') {
        sheet.getRange(row, 15).setValue('Tidak Perlu Diganti');
      } else if (status === 'Disetujui') {
        var dibayarOleh = sheet.getRange(row, 10).getValue();
        if (dibayarOleh === 'Uang Pribadi Peserta') {
          sheet.getRange(row, 15).setValue('Belum Dibayar');
        } else {
          sheet.getRange(row, 15).setValue('Tidak Perlu Diganti');
        }
      }
      
      return { success: true, message: 'Status verifikasi pengeluaran ' + expenseId + ' berhasil diubah menjadi ' + status };
    }
  }
  return { success: false, message: 'Transaksi tidak ditemukan.' };
}

/**
 * Mencatat Pembayaran/Penggantian Dana (Reimbursement)
 */
function savePayment(expenseId, p) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PENGELUARAN');
  if (!sheet) return { success: false, message: 'Sheet tidak ditemukan.' };
  
  var lastRow = sheet.getLastRow();
  var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    if (ids[i][0] === expenseId) {
      var row = i + 1;
      
      var buktiUrl = '';
      if (p.fileData) {
        buktiUrl = uploadFileToDrive(p.fileData, 'Bukti-Bayar-' + expenseId + '-' + p.fileName, getFolder('bukti').getId());
      }
      
      sheet.getRange(row, 15).setValue('Sudah Dibayar');
      sheet.getRange(row, 16).setValue(new Date(p.tanggalPembayaran));
      sheet.getRange(row, 17).setValue(p.metodePembayaran);
      if (buktiUrl) {
        sheet.getRange(row, 18).setValue(buktiUrl);
      }
      sheet.getRange(row, 20).setValue(new Date());
      
      return { success: true, message: 'Penggantian dana untuk ' + expenseId + ' berhasil dicatat.' };
    }
  }
  return { success: false, message: 'Transaksi tidak ditemukan.' };
}

/**
 * Menghapus transaksi pengeluaran secara permanen
 */
function deleteExpense(expenseId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('PENGELUARAN');
  if (!sheet) return { success: false, message: 'Sheet tidak ditemukan.' };
  
  var lastRow = sheet.getLastRow();
  var ids = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (var i = 1; i < ids.length; i++) {
    if (ids[i][0] === expenseId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Transaksi ' + expenseId + ' berhasil dihapus.' };
    }
  }
  return { success: false, message: 'Transaksi tidak ditemukan.' };
}

/**
 * Upload Helper (Base64 to Drive File)
 */
function uploadFileToDrive(fileData, fileName, folderId) {
  var folder = folderId ? DriveApp.getFolderById(folderId) : getFolder('bukti');
  var contentType = fileData.substring(5, fileData.indexOf(';base64'));
  var base64Data = fileData.substring(fileData.indexOf(';base64,') + 8);
  var decoded = Utilities.base64Decode(base64Data);
  var blob = Utilities.newBlob(decoded, contentType, fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/**
 * Rekap per Peserta
 */
function getParticipantRecaps() {
  var ss = getSpreadsheet();
  var participants = getParticipants();
  var expenses = getExpenses();
  
  var recaps = [];
  for (var i = 0; i < participants.length; i++) {
    var name = participants[i].nama;
    var toAirport = 0;
    var fromAirport = 0;
    var totalCost = 0;
    var personalPaid = 0;
    var reimbursed = 0;
    var unpaid = 0;
    var transactionCount = 0;
    
    for (var j = 0; j < expenses.length; j++) {
      var exp = expenses[j];
      if (exp.namaPeserta === name) {
        transactionCount++;
        
        if (exp.statusVerifikasi === 'Disetujui') {
          totalCost += exp.nominal;
          
          if (exp.jenisPerjalanan === 'Rumah ke Bandara') {
            toAirport++;
          } else if (exp.jenisPerjalanan === 'Bandara ke Rumah') {
            fromAirport++;
          }
          
          if (exp.dibayarOleh === 'Uang Pribadi Peserta') {
            personalPaid += exp.nominal;
            if (exp.statusPembayaran === 'Sudah Dibayar') {
              reimbursed += exp.nominal;
            } else if (exp.statusPembayaran === 'Belum Dibayar') {
              unpaid += exp.nominal;
            }
          }
        }
      }
    }
    
    recaps.push({
      nama: name,
      toAirport: toAirport,
      fromAirport: fromAirport,
      totalCost: totalCost,
      personalPaid: personalPaid,
      reimbursed: reimbursed,
      unpaid: unpaid,
      transactionCount: transactionCount
    });
  }
  return recaps;
}

/**
 * Portal Peserta
 */
function verifyParticipantAccess(participantName) {
  var participants = getParticipants();
  for (var i = 0; i < participants.length; i++) {
    if (participants[i].nama.toLowerCase() === participantName.toLowerCase() && participants[i].status === 'Aktif') {
      return { success: true, participant: participants[i] };
    }
  }
  return { success: false, message: 'Peserta tidak terdaftar atau nonaktif.' };
}

function getParticipantDashboard(participantName) {
  var recaps = getParticipantRecaps();
  var myRecap = null;
  for (var i = 0; i < recaps.length; i++) {
    if (recaps[i].nama.toLowerCase() === participantName.toLowerCase()) {
      myRecap = recaps[i];
      break;
    }
  }
  
  var allExpenses = getExpenses();
  var myExpenses = allExpenses.filter(function(e) {
    return e.namaPeserta.toLowerCase() === participantName.toLowerCase();
  });
  
  return {
    recap: myRecap || { nama: participantName, toAirport: 0, fromAirport: 0, totalCost: 0, personalPaid: 0, reimbursed: 0, unpaid: 0, transactionCount: 0 },
    expenses: myExpenses
  };
}

/**
 * Validasi kepemilikan transaksi oleh peserta
 */
function validateTransactionOwnership(transactionId, participantName) {
  var expenses = getExpenses();
  for (var i = 0; i < expenses.length; i++) {
    if (expenses[i].id === transactionId && expenses[i].namaPeserta.toLowerCase() === participantName.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Mengubah Google Drive link menjadi link Direct View (Embeddable Image/PDF)
 */
function getDirectViewUrl(driveUrl) {
  if (!driveUrl) return '';
  var match = driveUrl.match(/[-\w]{25,}/);
  if (match) {
    return 'https://drive.google.com/uc?export=view&id=' + match[0];
  }
  return driveUrl;
}

/**
 * Pembantu Format Rupiah (Backend)
 */
function formatRupiah(number) {
  if (isNaN(number)) return 'Rp0';
  return 'Rp' + number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatTanggalIndo(dateObj) {
  if (!dateObj) return '-';
  var date = new Date(dateObj);
  if (isNaN(date.getTime())) return '-';
  var namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  return date.getDate() + ' ' + namaBulan[date.getMonth()] + ' ' + date.getFullYear();
}

/**
 * Menghasilkan PDF blob dari HTML string
 */
function createPDFBlobFromHtml(htmlContent) {
  var blob = Utilities.newBlob(htmlContent, 'text/html', 'temp.html');
  var pdfBlob = blob.getAs('application/pdf');
  return pdfBlob;
}

/**
 * Menyimpan PDF ke folder Drive khusus
 */
function savePDFToDrive(pdfBlob, fileName) {
  var folder = getFolder('laporan');
  var file = folder.createFile(pdfBlob);
  file.setName(fileName);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/**
 * Mengubah Blob PDF menjadi Base64 untuk diunduh langsung di frontend
 */
function convertBlobToBase64(pdfBlob) {
  return Utilities.base64Encode(pdfBlob.getBytes());
}

/**
 * GENERATE PDF 1: Bukti Tunggal Transaksi (untuk Peserta/Admin)
 */
function generateTransactionPDF(transactionId, participantName) {
  if (participantName && !validateTransactionOwnership(transactionId, participantName)) {
    throw new Error('Akses ditolak. Dokumen bukan milik peserta ini.');
  }
  
  var expenses = getExpenses();
  var transaction = null;
  for (var i = 0; i < expenses.length; i++) {
    if (expenses[i].id === transactionId) {
      transaction = expenses[i];
      break;
    }
  }
  
  if (!transaction) throw new Error('Transaksi tidak ditemukan.');
  
  var settings = getSettings();
  var todayStr = formatTanggalIndo(new Date());
  
  var template = HtmlService.createTemplateFromFile('ReportTemplate');
  template.mode = 'transaction';
  template.t = transaction;
  template.settings = settings;
  template.todayStr = todayStr;
  template.documentNo = 'BKT-TRP-' + transactionId.split('-').slice(1).join('-');
  template.verificationCode = 'VER-' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, transactionId)).substring(0, 10).toUpperCase();
  template.helper = {
    formatRupiah: formatRupiah,
    formatTanggal: formatTanggalIndo,
    getDirectViewUrl: getDirectViewUrl
  };
  
  var htmlContent = template.evaluate().getContent();
  var pdfBlob = createPDFBlobFromHtml(htmlContent);
  
  var cleanName = transaction.namaPeserta.replace(/[^a-z0-9]/gi, '_');
  var fileName = 'Bukti-Transport-' + cleanName + '-' + transactionId + '.pdf';
  savePDFToDrive(pdfBlob, fileName);
  
  return {
    fileName: fileName,
    base64Data: convertBlobToBase64(pdfBlob)
  };
}

/**
 * GENERATE PDF 2: Rekapitulasi per Peserta
 */
function generateParticipantRecapPDF(participantName) {
  var participants = getParticipants();
  var participant = null;
  for (var i = 0; i < participants.length; i++) {
    if (participants[i].nama.toLowerCase() === participantName.toLowerCase()) {
      participant = participants[i];
      break;
    }
  }
  
  if (!participant) throw new Error('Peserta tidak ditemukan.');
  
  var recaps = getParticipantRecaps();
  var myRecap = null;
  for (var i = 0; i < recaps.length; i++) {
    if (recaps[i].nama.toLowerCase() === participantName.toLowerCase()) {
      myRecap = recaps[i];
      break;
    }
  }
  
  var allExpenses = getExpenses();
  var myExpenses = allExpenses.filter(function(e) {
    return e.namaPeserta.toLowerCase() === participantName.toLowerCase();
  });
  
  var settings = getSettings();
  var todayStr = formatTanggalIndo(new Date());
  
  var template = HtmlService.createTemplateFromFile('ReportTemplate');
  template.mode = 'participant_recap';
  template.participant = participant;
  template.recap = myRecap;
  template.expenses = myExpenses;
  template.settings = settings;
  template.todayStr = todayStr;
  template.verificationCode = 'REC-' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, participantName)).substring(0, 10).toUpperCase();
  template.helper = {
    formatRupiah: formatRupiah,
    formatTanggal: formatTanggalIndo,
    getDirectViewUrl: getDirectViewUrl
  };
  
  var htmlContent = template.evaluate().getContent();
  var pdfBlob = createPDFBlobFromHtml(htmlContent);
  
  var cleanName = participantName.replace(/[^a-z0-9]/gi, '_');
  var fileName = 'Rekap-Transport-' + cleanName + '-' + todayStr.replace(/\s+/g, '-') + '.pdf';
  savePDFToDrive(pdfBlob, fileName);
  
  return {
    fileName: fileName,
    base64Data: convertBlobToBase64(pdfBlob)
  };
}

/**
 * GENERATE PDF 3: Laporan Pertanggungjawaban Akhir Utama (Admin)
 */
function generateReportPDF() {
  var settings = getSettings();
  var dashboard = getDashboardData();
  var funds = getFundTransactions();
  var recaps = getParticipantRecaps();
  var expenses = getExpenses().filter(function(e) {
    return e.statusVerifikasi === 'Disetujui';
  });
  
  var today = new Date();
  var year = today.getFullYear();
  var month = ('0' + (today.getMonth() + 1)).slice(-2);
  
  var folder = getFolder('laporan');
  var files = folder.getFiles();
  var count = 1;
  while (files.hasNext()) {
    var f = files.next();
    if (f.getName().indexOf('Laporan-Pertanggungjawaban-Transport') === 0) {
      count++;
    }
  }
  
  var reportNo = 'TRP/' + year + '/' + month + '/' + ('00' + count).slice(-3);
  var todayStr = formatTanggalIndo(today);
  
  var template = HtmlService.createTemplateFromFile('ReportTemplate');
  template.mode = 'final_report';
  template.settings = settings;
  template.dashboard = dashboard;
  template.funds = funds;
  template.recaps = recaps;
  template.expenses = expenses;
  template.reportNo = reportNo;
  template.todayStr = todayStr;
  template.helper = {
    formatRupiah: formatRupiah,
    formatTanggal: formatTanggalIndo,
    getDirectViewUrl: getDirectViewUrl
  };
  
  var htmlContent = template.evaluate().getContent();
  var pdfBlob = createPDFBlobFromHtml(htmlContent);
  
  var fileName = 'Laporan-Pertanggungjawaban-Transport-' + reportNo.replace(/\//g, '-') + '.pdf';
  var pdfUrl = savePDFToDrive(pdfBlob, fileName);
  
  return {
    success: true,
    pdfUrl: pdfUrl,
    fileName: fileName,
    base64Data: convertBlobToBase64(pdfBlob)
  };
}

/**
 * Verifikasi Kode Dokumen
 */
function verifyDocumentCode(code) {
  var cleanCode = code.trim().toUpperCase();
  if (cleanCode.indexOf('VER-') === 0) {
    var expenses = getExpenses();
    for (var i = 0; i < expenses.length; i++) {
      var id = expenses[i].id;
      var calcCode = 'VER-' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, id)).substring(0, 10).toUpperCase();
      if (calcCode === cleanCode) {
        return {
          success: true,
          type: 'Bukti Transaksi Tunggal',
          reference: expenses[i].id,
          detail: 'Nama: ' + expenses[i].namaPeserta + ', Biaya: ' + formatRupiah(expenses[i].nominal) + ', Perjalanan: ' + expenses[i].jenisPerjalanan + ' (' + expenses[i].jenisTransportasi + '), Tanggal: ' + formatTanggalIndo(expenses[i].tanggalPerjalanan),
          status: 'Valid'
        };
      }
    }
  } else if (cleanCode.indexOf('REC-') === 0) {
    var participants = getParticipants();
    for (var i = 0; i < participants.length; i++) {
      var name = participants[i].nama;
      var calcCode = 'REC-' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, name)).substring(0, 10).toUpperCase();
      if (calcCode === cleanCode) {
        var recaps = getParticipantRecaps();
        var myRecap = recaps.filter(function(r) { return r.nama === name; })[0];
        return {
          success: true,
          type: 'Rekapitulasi Transport Peserta',
          reference: name,
          detail: 'Nama: ' + name + ', Jumlah Transaksi: ' + (myRecap ? myRecap.transactionCount : 0) + ', Total Biaya Disetujui: ' + (myRecap ? formatRupiah(myRecap.totalCost) : 'Rp0'),
          status: 'Valid'
        };
      }
    }
  }
  return { success: false, message: 'Kode dokumen tidak dapat dicocokkan atau tidak valid.' };
}
