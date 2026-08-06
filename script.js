/**
 * Antigravity - Transport & Accountabilities JS Controller (Static VPS Version)
 * Vanilla JavaScript ES6
 */

// State Aplikasi
const state = {
  activeView: 'dashboard', // View aktif saat ini
  role: 'admin',          // 'admin' atau 'peserta'
  activeParticipant: null,// Nama peserta yang aktif di portal
  participants: [],       // Cache daftar peserta
  expenses: [],           // Cache daftar pengeluaran
  funds: [],              // Cache dana masuk
  settings: {},           // Cache pengaturan
  filters: {              // Filter pengeluaran
    search: '',
    startDate: '',
    endDate: '',
    participant: '',
    travelType: '',
    transportType: '',
    verification: '',
    payment: ''
  },
  // Cache unggah berkas
  tempFile: null,
  tempPaymentFile: null,
  tempFundFile: null
};

// Inisialisasi Aplikasi Saat Window Dimuat
window.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const apiUrl = localStorage.getItem('gas_api_url');
  
  if (!apiUrl) {
    // Tampilkan screen config API jika URL belum diset
    const apiConfigScreen = document.getElementById('api-config-screen');
    const loginScreen = document.getElementById('portal-login-screen');
    const adminApp = document.getElementById('admin-app-layout');
    
    if (apiConfigScreen) {
      apiConfigScreen.style.display = 'flex';
      apiConfigScreen.classList.remove('hidden');
    }
    if (loginScreen) {
      loginScreen.style.display = 'none';
      loginScreen.classList.add('hidden');
    }
    if (adminApp) adminApp.classList.add('hidden');
    
    // Bind tombol simpan config API
    bindElClick('btn-save-api-config', handleSaveApiConfig);
    return;
  }
  
  // Set tampilan awal ke Portal login screen (Landing Page)
  const adminApp = document.getElementById('admin-app-layout');
  const loginScreen = document.getElementById('portal-login-screen');
  const apiConfigScreen = document.getElementById('api-config-screen');
  
  if (adminApp) adminApp.classList.add('hidden');
  if (apiConfigScreen) {
    apiConfigScreen.style.display = 'none';
    apiConfigScreen.classList.add('hidden');
  }
  if (loginScreen) {
    loginScreen.style.display = 'flex';
    loginScreen.classList.remove('hidden');
  }

  // Setup Event Bindings
  setupEventBindings();
  
  // Setup Menu Navigasi
  setupNavigation();
  
  // Ambil Data Awal (Settings & Dropdown Peserta)
  loadInitialData();
  
  // Format Live Input Rupiah
  setupRupiahInputFormatter();
  
  // Setup Event Listeners untuk Form Submissions
  setupFormSubmitHandlers();
  
  // Setup File Upload Previews
  setupFileUploadPreviews();

  // Route awal
  switchView('portal-login');
}

/**
 * Menyimpan konfigurasi URL API Apps Script pertama kali
 */
function handleSaveApiConfig() {
  const inputVal = document.getElementById('config-api-url').value.trim();
  if (!inputVal) {
    showToast('Harap masukkan URL API Google Apps Script.', 'error');
    return;
  }
  if (!inputVal.startsWith('https://script.google.com/')) {
    showToast('Format URL API tidak valid. Harus diawali https://script.google.com/', 'error');
    return;
  }
  
  localStorage.setItem('gas_api_url', inputVal);
  showToast('API URL berhasil disimpan dan dihubungkan.', 'success');
  
  // Reload App
  initApp();
}

/**
 * ================= REST API CLIENT HELPERS =================
 */

// Helper GET Request ke Apps Script
async function callApiGet(action, params = {}) {
  const apiUrl = localStorage.getItem('gas_api_url');
  if (!apiUrl) {
    showToast('Apps Script API URL belum dikonfigurasi!', 'error');
    throw new Error('API URL not set');
  }
  
  const url = new URL(apiUrl);
  url.searchParams.append('action', action);
  for (const key in params) {
    url.searchParams.append(key, params[key]);
  }
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    mode: 'cors',
    redirect: 'follow'
  });
  
  if (!response.ok) {
    throw new Error('Gagal mengambil data dari API.');
  }
  
  return await response.json();
}

// Helper POST Request ke Apps Script (Menggunakan text/plain untuk bypass CORS preflight)
async function callApiPost(action, data = {}) {
  const apiUrl = localStorage.getItem('gas_api_url');
  if (!apiUrl) {
    showToast('Apps Script API URL belum dikonfigurasi!', 'error');
    throw new Error('API URL not set');
  }
  
  const payload = {
    action: action,
    data: data
  };
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8' // Menghindari preflight OPTIONS request
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    throw new Error('Gagal mengirim data ke API.');
  }
  
  return await response.json();
}

// Helper khusus mengubah status verifikasi pengeluaran
async function updateExpenseStatus(expenseId, status, rejectionReason) {
  const apiUrl = localStorage.getItem('gas_api_url');
  const payload = {
    action: 'updateExpenseStatus',
    expenseId: expenseId,
    status: status,
    rejectionReason: rejectionReason
  };
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}

// Helper khusus mencatat pembayaran reimbursement
async function savePayment(expenseId, paymentData) {
  const apiUrl = localStorage.getItem('gas_api_url');
  const payload = {
    action: 'savePayment',
    expenseId: expenseId,
    data: paymentData
  };
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}

// Helper khusus menghapus pengeluaran
async function deleteExpense(expenseId) {
  const apiUrl = localStorage.getItem('gas_api_url');
  const payload = {
    action: 'deleteExpense',
    expenseId: expenseId
  };
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}

/**
 * Pengikatan Event Listeners (Memisahkan JS dari HTML)
 */
function setupEventBindings() {
  // 1. Portal Login Screen
  bindElClick('portal-login-btn', handlePortalAccess);
  bindElClick('btn-enter-admin', enterAdminMode);
  
  // 2. Admin Layout Navigation
  bindElClick('sidebar-logout-btn', exitAdminToPortal);
  bindElClick('header-portal-btn', exitAdminToPortal);
  
  // 3. Portal Layout Navigation
  bindElClick('portal-logout-btn', logoutPortal);
  bindElClick('portal-nav-logout', logoutPortal);
  bindElClick('btn-download-my-recap', downloadMyRecap);
  
  // 4. Dashboard Admin
  bindElClick('view-all-expenses', () => switchView('expenses'));
  
  // 5. Filter & Search
  const searchInput = document.getElementById('search-expense');
  if (searchInput) searchInput.addEventListener('input', renderExpensesList);
  
  bindElClick('chip-all', () => setChipFilter('', '', 'chip-all'));
  bindElClick('chip-pending', () => setChipFilter('verification', 'Menunggu', 'chip-pending'));
  bindElClick('chip-unpaid', () => setChipFilter('payment', 'Belum Dibayar', 'chip-unpaid'));
  
  bindElClick('open-filter-btn', () => openBottomSheet('filter-sheet'));
  bindElClick('reset-filter-btn', resetFilters);
  bindElClick('btn-apply-filter', applyFilters);
  
  // 6. Menu Lainnya (More View)
  bindElClick('menu-admin-participants', () => { switchView('admin-participants'); loadAdminParticipantsView(); });
  bindElClick('menu-funds', () => { switchView('funds'); loadFundsData(); });
  bindElClick('menu-verify-pdf', () => switchView('verify-pdf'));
  bindElClick('menu-settings', () => switchView('settings'));
  bindElClick('btn-generate-report', generateAdminReportPDF);
  
  // 7. Peserta View
  bindElClick('btn-add-participant', openAddParticipantModal);
  bindElClick('btn-back-participants', () => switchView('more'));
  
  // 8. Dana Masuk View
  bindElClick('btn-add-fund-nav', () => switchView('add-fund'));
  bindElClick('btn-back-funds', () => switchView('more'));
  bindElClick('btn-back-funds-2', () => switchView('more'));
  
  // 9. Back buttons
  bindElClick('btn-cancel-settings', () => switchView('more'));
  bindElClick('btn-cancel-verify', () => switchView('more'));
  
  // 10. Modals Submissions
  bindElClick('btn-submit-reject', submitRejection);
  bindElClick('btn-submit-payment', submitPayment);
  bindElClick('btn-submit-participant', submitParticipant);
  bindElClick('btn-submit-admin-pin', verifyAdminPin);

  // 12. Admin PIN input enter key listener
  const pinInput = document.getElementById('admin-pin-input');
  if (pinInput) {
    pinInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        verifyAdminPin();
      }
    });
  }

  // 11. Event Delegator untuk Dismiss Modal & Bottom Sheet
  document.addEventListener('click', (e) => {
    const dismissModal = e.target.closest('[data-dismiss="modal"]');
    if (dismissModal) {
      const modal = dismissModal.closest('.modal-overlay');
      if (modal) modal.classList.remove('active');
    }
    
    const dismissSheet = e.target.closest('[data-dismiss="bottom-sheet"]');
    if (dismissSheet) {
      const sheet = dismissSheet.closest('.bottom-sheet');
      if (sheet) sheet.classList.remove('active');
    }
  });
}

function bindElClick(id, handler) {
  const el = document.getElementById(id);
  if (el) {
    // Hindari duplikasi listener
    el.replaceWith(el.cloneNode(true));
    const newEl = document.getElementById(id);
    newEl.addEventListener('click', handler);
  }
}

/**
 * Routing & Navigasi
 */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item, .sidebar-link');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      const targetView = item.getAttribute('data-view');
      if (targetView) {
        switchView(targetView);
      }
    });
  });
}

function switchView(viewName) {
  // Jika membuka form tambah pengeluaran, pindahkan element ke container layout role yang aktif
  if (viewName === 'add') {
    const viewAdd = document.getElementById('view-add');
    if (viewAdd) {
      if (state.role === 'admin') {
        const adminContainer = document.querySelector('#admin-app-layout .container');
        if (adminContainer && viewAdd.parentElement !== adminContainer) {
          adminContainer.appendChild(viewAdd);
        }
      } else {
        const portalContainer = document.querySelector('#portal-app-layout .container');
        if (portalContainer && viewAdd.parentElement !== portalContainer) {
          portalContainer.appendChild(viewAdd);
        }
      }
    }
  }

  // Hilangkan kelas active dari semua view
  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.remove('active');
    view.classList.add('hidden');
  });
  
  // Aktifkan view target
  const targetViewEl = document.getElementById(`view-${viewName}`);
  if (targetViewEl) {
    targetViewEl.classList.add('active');
    targetViewEl.classList.remove('hidden');
    state.activeView = viewName;
    
    // Perbarui status aktif di Navigasi Bawah & Sidebar
    document.querySelectorAll('.nav-item, .sidebar-link').forEach(nav => {
      if (nav.getAttribute('data-view') === viewName) {
        nav.classList.add('active');
      } else {
        nav.classList.remove('active');
      }
    });
    
    // Auto-scroll ke atas saat pindah halaman
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Jalankan trigger khusus per halaman
    onViewChange(viewName);
  }
}

function onViewChange(viewName) {
  if (state.role === 'admin') {
    if (viewName === 'dashboard') {
      loadDashboardData();
    } else if (viewName === 'expenses') {
      loadExpensesData();
    } else if (viewName === 'funds') {
      loadFundsData();
    } else if (viewName === 'recap') {
      loadRecapData();
    } else if (viewName === 'settings') {
      loadSettingsData();
    }
  } else {
    // Role Peserta Portal
    if (viewName === 'portal-dashboard') {
      loadPortalDashboard();
    }
  }
}

/**
 * Memuat data awal saat aplikasi baru dibuka
 */
function loadInitialData() {
  showGlobalLoading(true);
  
  let loadedCount = 0;
  const onDone = () => {
    loadedCount++;
    if (loadedCount === 2) {
      showGlobalLoading(false);
    }
  };

  callApiGet('getSettings')
    .then((settings) => {
      state.settings = settings;
      
      const setApiUrlInput = document.getElementById('set-api-url');
      if (setApiUrlInput) setApiUrlInput.value = localStorage.getItem('gas_api_url') || '';
      
      // Perbarui judul kegiatan di header
      document.querySelectorAll('.app-activity-name').forEach(el => {
        el.textContent = settings.namaKegiatan;
      });
      onDone();
    })
    .catch((err) => {
      showToast('Gagal memuat pengaturan: ' + err.message, 'error');
      onDone();
    });

  callApiGet('getParticipants')
    .then((participants) => {
      state.participants = participants;
      populateParticipantDropdowns();
      onDone();
    })
    .catch((err) => {
      showToast('Gagal memuat daftar peserta: ' + err.message, 'error');
      onDone();
    });
}

/**
 * Mengisi Dropdown pilihan peserta di form pengeluaran & filter
 */
function populateParticipantDropdowns() {
  const selects = ['exp-peserta', 'filter-peserta', 'portal-peserta-select'];
  
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    
    // Simpan nilai lama
    const oldVal = select.value;
    
    // Kosongkan dan set default
    select.innerHTML = '';
    
    if (id !== 'portal-peserta-select' && id !== 'exp-peserta') {
      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = 'Semua Peserta';
      select.appendChild(defOpt);
    } else if (id === 'exp-peserta') {
      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = '-- Pilih Peserta --';
      select.appendChild(defOpt);
    } else {
      const defOpt = document.createElement('option');
      defOpt.value = '';
      defOpt.textContent = '-- Pilih Nama Anda --';
      select.appendChild(defOpt);
    }
    
    // Isi data peserta yang aktif
    state.participants.forEach(p => {
      if (p.status === 'Aktif') {
        const opt = document.createElement('option');
        opt.value = p.nama;
        opt.textContent = p.nama;
        select.appendChild(opt);
      }
    });
    
    // Kembalikan nilai lama jika ada
    if (oldVal) select.value = oldVal;
  });
}

/**
 * Form Interaktif: Format Rupiah live saat mengetik
 */
function setupRupiahInputFormatter() {
  const rupiahInputs = document.querySelectorAll('.input-rupiah');
  
  rupiahInputs.forEach(input => {
    input.addEventListener('input', (e) => {
      let val = e.target.value.replace(/[^0-9]/g, '');
      if (val === '') {
        e.target.value = '';
        return;
      }
      e.target.value = formatNumber(parseInt(val, 10));
    });
  });
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatRupiah(number) {
  if (isNaN(number) || number === null) return 'Rp0';
  return 'Rp' + formatNumber(number);
}

function parseRupiah(str) {
  if (!str) return 0;
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '-';
  
  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  
  return `${date.getDate()} ${namaBulan[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Toast Notification Helper
 */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  if (type === 'success') {
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  } else if (type === 'error') {
    icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  }
  
  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toast-in 0.3s ease reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3500);
}

/**
 * Global Loading Indicator
 */
function showGlobalLoading(show) {
  const loader = document.getElementById('global-loader');
  if (loader) {
    if (show) {
      loader.style.display = 'flex';
    } else {
      loader.style.display = 'none';
    }
  }
}

/**
 * Modals & Bottom Sheets Controllers
 */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function openBottomSheet(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeBottomSheet(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

/**
 * File Input Handlers (Convert Files to Base64)
 */
function setupFileUploadPreviews() {
  const cameraInput = document.getElementById('exp-camera');
  const galleryInput = document.getElementById('exp-gallery');
  
  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => handleSelectedFile(e.target.files[0], 'tempFile', 'exp-preview'));
  }
  if (galleryInput) {
    galleryInput.addEventListener('change', (e) => handleSelectedFile(e.target.files[0], 'tempFile', 'exp-preview'));
  }
  
  const payFile = document.getElementById('pay-bukti');
  if (payFile) {
    payFile.addEventListener('change', (e) => handleSelectedFile(e.target.files[0], 'tempPaymentFile', 'pay-preview'));
  }
  
  const fundFile = document.getElementById('fund-bukti');
  if (fundFile) {
    fundFile.addEventListener('change', (e) => handleSelectedFile(e.target.files[0], 'tempFundFile', 'fund-preview'));
  }
}

function handleSelectedFile(file, stateProp, previewContainerId) {
  if (!file) return;
  
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Format berkas harus JPG, JPEG, PNG, atau PDF.', 'error');
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    showToast('Ukuran berkas maksimal 5 MB.', 'error');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = (e) => {
    state[stateProp] = {
      base64: e.target.result,
      name: file.name,
      type: file.type
    };
    
    const previewContainer = document.getElementById(previewContainerId);
    if (previewContainer) {
      previewContainer.innerHTML = '';
      previewContainer.style.display = 'flex';
      previewContainer.classList.remove('hidden');
      
      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-preview-info';
      
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = e.target.result;
        fileInfo.appendChild(img);
      } else {
        fileInfo.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:red;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>';
      }
      
      const nameText = document.createElement('span');
      nameText.textContent = file.name;
      fileInfo.appendChild(nameText);
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-preview-remove';
      removeBtn.type = 'button';
      removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"></svg>';
      
      removeBtn.addEventListener('click', () => {
        state[stateProp] = null;
        previewContainer.innerHTML = '';
        previewContainer.style.display = 'none';
        previewContainer.classList.add('hidden');
        
        const inputs = ['exp-camera', 'exp-gallery', 'pay-bukti', 'fund-bukti'];
        inputs.forEach(id => {
          const el = document.getElementById(id);
          if (el) el.value = '';
        });
      });
      
      previewContainer.appendChild(fileInfo);
      previewContainer.appendChild(removeBtn);
    }
  };
  
  reader.readAsDataURL(file);
}

/**
 * ================= DATA FETCHING (ADMIN: DASHBOARD) =================
 */
function loadDashboardData() {
  document.getElementById('dash-main-card-loader').style.display = 'block';
  document.getElementById('dash-main-card-loader').classList.remove('hidden');
  document.getElementById('dash-main-card-content').style.display = 'none';
  document.getElementById('dash-main-card-content').classList.add('hidden');
  document.getElementById('dash-quick-grid').style.opacity = '0.5';
  
  callApiGet('getDashboard')
    .then((data) => {
      document.getElementById('dash-main-card-loader').style.display = 'none';
      document.getElementById('dash-main-card-loader').classList.add('hidden');
      
      const contentEl = document.getElementById('dash-main-card-content');
      contentEl.style.display = 'block';
      contentEl.classList.remove('hidden');
      
      document.getElementById('dash-quick-grid').style.opacity = '1';
      
      const balanceTypeLabel = document.getElementById('dash-balance-type');
      const balanceVal = document.getElementById('dash-balance-val');
      const statusBanner = document.getElementById('dash-status-banner');
      
      if (data.saldoDana >= 0 && data.kekuranganDana <= 0) {
        balanceTypeLabel.textContent = 'Saldo Dana Transport';
        balanceVal.textContent = formatRupiah(data.saldoDana);
        statusBanner.className = 'status-banner surplus';
        statusBanner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Sisa dana transport aman sebesar ${formatRupiah(data.saldoDana)}`;
      } else {
        balanceTypeLabel.textContent = 'Kekurangan Dana';
        balanceVal.textContent = formatRupiah(data.kekuranganDana);
        statusBanner.className = 'status-banner deficit';
        statusBanner.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg> Dana transport kurang sebesar ${formatRupiah(data.kekuranganDana)}`;
      }
      
      document.getElementById('dash-total-masuk').textContent = formatRupiah(data.totalDanaMasuk);
      document.getElementById('dash-total-keluar').textContent = formatRupiah(data.totalDisetujui);
      
      document.getElementById('dash-stat-pending').textContent = data.menungguVerifikasi;
      document.getElementById('dash-stat-approved').textContent = formatRupiah(data.totalDisetujui);
      document.getElementById('dash-stat-unpaid').textContent = formatRupiah(data.totalBelumBayar);
      document.getElementById('dash-stat-peserta').textContent = data.jumlahPeserta;
      
      loadRecentActivities();
    })
    .catch((err) => {
      showToast('Gagal memuat dashboard: ' + err.message, 'error');
    });
}

function loadRecentActivities() {
  const container = document.getElementById('dash-activities-list');
  container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
  
  callApiGet('getExpenses')
    .then((expenses) => {
      state.expenses = expenses;
      container.innerHTML = '';
      
      if (expenses.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h3>Belum ada pengeluaran transport</h3>
            <p>Silakan catat pengeluaran baru menggunakan tombol tambah di bawah.</p>
            <button class="btn btn-primary btn-sm" id="btn-dashboard-empty-add">Catat Pengeluaran</button>
          </div>
        `;
        
        bindElClick('btn-dashboard-empty-add', () => switchView('add'));
        return;
      }
      
      const recent = expenses.slice(0, 3);
      recent.forEach(e => {
        container.appendChild(createTransactionCard(e));
      });
    })
    .catch((err) => {
      showToast('Gagal memuat aktivitas terbaru: ' + err.message, 'error');
    });
}

/**
 * Membuat Elemen Kartu Transaksi Reusable
 */
function createTransactionCard(e) {
  const card = document.createElement('div');
  card.className = 'transaction-card';
  card.setAttribute('data-id', e.id);
  
  const statusVerifClass = e.statusVerifikasi.toLowerCase();
  const statusBayarClass = e.statusPembayaran.toLowerCase().replace(/\s+/g, '-');
  
  const badgeVerif = `<span class="badge ${statusVerifClass}">${e.statusVerifikasi}</span>`;
  const badgeBayar = `<span class="badge ${statusBayarClass}">${e.statusPembayaran}</span>`;
  
  const initial = e.namaPeserta ? e.namaPeserta.charAt(0).toUpperCase() : '?';
  const travelDate = formatTanggalIndo(e.tanggalPerjalanan);
  
  card.innerHTML = `
    <div class="t-header">
      <div class="t-user">
        <div class="t-avatar">${initial}</div>
        <div class="t-info">
          <h3>${e.namaPeserta}</h3>
          <p>${travelDate}</p>
        </div>
      </div>
      <div class="t-badges">
        ${badgeVerif}
        ${badgeBayar}
      </div>
    </div>
    <div class="t-meta">
      <div class="t-route">${e.jenisPerjalanan} &middot; <strong style="color:var(--primary);">${e.jenisTransportasi}</strong></div>
      <div class="t-amount">${formatRupiah(e.nominal)}</div>
    </div>
  `;
  
  card.addEventListener('click', () => {
    openExpenseDetail(e.id);
  });
  
  return card;
}

/**
 * ================= DATA FETCHING (ADMIN: LIST EXPENSES & FILTERS) =================
 */
function loadExpensesData() {
  const listContainer = document.getElementById('expenses-list-container');
  listContainer.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
  
  callApiGet('getExpenses')
    .then((expenses) => {
      state.expenses = expenses;
      renderExpensesList();
    })
    .catch((err) => {
      showToast('Gagal mengambil daftar pengeluaran: ' + err.message, 'error');
    });
}

function renderExpensesList() {
  const container = document.getElementById('expenses-list-container');
  container.innerHTML = '';
  
  const filtered = state.expenses.filter(e => {
    if (state.filters.search && !e.namaPeserta.toLowerCase().includes(state.filters.search.toLowerCase())) {
      return false;
    }
    if (state.filters.participant && e.namaPeserta !== state.filters.participant) {
      return false;
    }
    if (state.filters.startDate) {
      const expDate = new Date(e.tanggalPerjalanan);
      const sDate = new Date(state.filters.startDate);
      sDate.setHours(0,0,0,0);
      if (expDate < sDate) return false;
    }
    if (state.filters.endDate) {
      const expDate = new Date(e.tanggalPerjalanan);
      const eDate = new Date(state.filters.endDate);
      eDate.setHours(23,59,59,999);
      if (expDate > eDate) return false;
    }
    if (state.filters.travelType && e.jenisPerjalanan !== state.filters.travelType) {
      return false;
    }
    if (state.filters.transportType && e.jenisTransportasi !== state.filters.transportType) {
      return false;
    }
    if (state.filters.verification && e.statusVerifikasi !== state.filters.verification) {
      return false;
    }
    if (state.filters.payment && e.statusPembayaran !== state.filters.payment) {
      return false;
    }
    return true;
  });
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <h3>Tidak ada pengeluaran cocok</h3>
        <p>Silakan sesuaikan filter atau kata pencarian Anda.</p>
        <button class="btn btn-secondary btn-sm" id="btn-reset-empty-filter">Reset Filter</button>
      </div>
    `;
    bindElClick('btn-reset-empty-filter', resetFilters);
    return;
  }
  
  const isDesktop = window.innerWidth >= 768;
  
  if (isDesktop) {
    const tableWrapper = document.createElement('div');
    tableWrapper.className = 'responsive-table-wrapper';
    
    let tableHtml = `
      <table class="table-desktop">
        <thead>
          <tr>
            <th>ID</th>
            <th>Tanggal</th>
            <th>Peserta</th>
            <th>Perjalanan</th>
            <th>Transportasi</th>
            <th>Nominal</th>
            <th>Dibayar Oleh</th>
            <th>Verifikasi</th>
            <th>Pembayaran</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    filtered.forEach(e => {
      const vClass = e.statusVerifikasi.toLowerCase();
      const pClass = e.statusPembayaran.toLowerCase().replace(/\s+/g, '-');
      
      tableHtml += `
        <tr data-row-id="${e.id}" style="cursor:pointer;">
          <td><strong>${e.id}</strong></td>
          <td>${formatTanggalIndo(e.tanggalPerjalanan)}</td>
          <td><strong>${e.namaPeserta}</strong></td>
          <td>${e.jenisPerjalanan}</td>
          <td>${e.jenisTransportasi}</td>
          <td><strong>${formatRupiah(e.nominal)}</strong></td>
          <td>${e.dibayarOleh}</td>
          <td><span class="badge ${vClass}">${e.statusVerifikasi}</span></td>
          <td><span class="badge ${pClass}">${e.statusPembayaran}</span></td>
        </tr>
      `;
    });
    
    tableHtml += `</tbody></table>`;
    tableWrapper.innerHTML = tableHtml;
    container.appendChild(tableWrapper);
    
    tableWrapper.querySelectorAll('tr[data-row-id]').forEach(row => {
      row.addEventListener('click', () => {
        openExpenseDetail(row.getAttribute('data-row-id'));
      });
    });
  } else {
    filtered.forEach(e => {
      container.appendChild(createTransactionCard(e));
    });
  }
}

/**
 * Filter Actions
 */
function applyFilters() {
  state.filters.search = document.getElementById('search-expense').value;
  state.filters.participant = document.getElementById('filter-peserta').value;
  state.filters.startDate = document.getElementById('filter-start-date').value;
  state.filters.endDate = document.getElementById('filter-end-date').value;
  state.filters.travelType = document.getElementById('filter-jenis-perjalanan').value;
  state.filters.transportType = document.getElementById('filter-jenis-transport').value;
  state.filters.verification = document.getElementById('filter-status-verif').value;
  state.filters.payment = document.getElementById('filter-status-bayar').value;
  
  updateFilterChips();
  renderExpensesList();
  closeBottomSheet('filter-sheet');
}

function resetFilters() {
  document.getElementById('search-expense').value = '';
  document.getElementById('filter-peserta').value = '';
  document.getElementById('filter-start-date').value = '';
  document.getElementById('filter-end-date').value = '';
  document.getElementById('filter-jenis-perjalanan').value = '';
  document.getElementById('filter-jenis-transport').value = '';
  document.getElementById('filter-status-verif').value = '';
  document.getElementById('filter-status-bayar').value = '';
  
  state.filters = {
    search: '',
    startDate: '',
    endDate: '',
    participant: '',
    travelType: '',
    transportType: '',
    verification: '',
    payment: ''
  };
  
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  document.getElementById('chip-all').classList.add('active');
  
  renderExpensesList();
  closeBottomSheet('filter-sheet');
}

function setChipFilter(type, value, chipId) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  const targetChip = document.getElementById(chipId);
  if (targetChip) targetChip.classList.add('active');
  
  state.filters.verification = '';
  state.filters.payment = '';
  
  if (type === 'verification') {
    state.filters.verification = value;
  } else if (type === 'payment') {
    state.filters.payment = value;
  }
  
  renderExpensesList();
}

function updateFilterChips() {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  
  if (state.filters.verification === 'Menunggu') {
    document.getElementById('chip-pending').classList.add('active');
  } else if (state.filters.payment === 'Belum Dibayar') {
    document.getElementById('chip-unpaid').classList.add('active');
  } else if (!state.filters.verification && !state.filters.payment) {
    document.getElementById('chip-all').classList.add('active');
  }
}

/**
 * ================= DATA FETCHING (ADMIN: DATA DANA MASUK) =================
 */
function loadFundsData() {
  const container = document.getElementById('funds-list-container');
  container.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
  
  callApiGet('getFunds')
    .then((funds) => {
      state.funds = funds;
      renderFundsList();
    })
    .catch((err) => {
      showToast('Gagal memuat dana masuk: ' + err.message, 'error');
    });
}

function renderFundsList() {
  const container = document.getElementById('funds-list-container');
  container.innerHTML = '';
  
  if (state.funds.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>Belum ada dana masuk</h3></div>';
    return;
  }
  
  state.funds.forEach(f => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '14px';
    card.style.marginBottom = '10px';
    
    let fileLink = '';
    if (f.buktiTransfer) {
      fileLink = `<a href="${f.buktiTransfer}" target="_blank" class="btn btn-secondary btn-sm" style="height:32px; font-size:11px; padding:0 8px; margin-top:8px;">Lihat Bukti Transfer</a>`;
    }
    
    card.innerHTML = `
      <div class="flex justify-between align-center">
        <div>
          <strong style="color:var(--primary); font-size:13px;">${f.id}</strong>
          <span style="font-size:10px; color:var(--text-muted); display:block;">${formatTanggalIndo(f.tanggal)}</span>
        </div>
        <span class="badge ${f.jenisDana === 'DP Awal' ? 'disetujui' : 'menunggu'}" style="font-size:9px;">${f.jenisDana}</span>
      </div>
      <div style="font-size:15px; font-weight:700; margin:8px 0; color:var(--text);">${formatRupiah(f.nominal)}</div>
      <p style="font-size:11px; color:var(--text-muted);">${f.keterangan || '-'}</p>
      ${fileLink}
    `;
    container.appendChild(card);
  });
}

/**
 * ================= DATA FETCHING (ADMIN: REKAPITULASI) =================
 */
function loadRecapData() {
  const summaryContainer = document.getElementById('recap-summary-container');
  const participantsContainer = document.getElementById('recap-participants-container');
  
  summaryContainer.innerHTML = '<div class="skeleton skeleton-card"></div>';
  participantsContainer.innerHTML = '<div class="skeleton skeleton-card"></div>';
  
  let dashboardData = null;
  let recapsData = null;
  
  const onDone = () => {
    if (dashboardData && recapsData) {
      renderRecap(dashboardData, recapsData);
    }
  };
  
  callApiGet('getDashboard')
    .then((data) => {
      dashboardData = data;
      onDone();
    })
    .catch((err) => showToast('Gagal memuat ringkasan rekap: ' + err.message, 'error'));
    
  callApiGet('getParticipantRecaps')
    .then((recaps) => {
      recapsData = recaps;
      onDone();
    })
    .catch((err) => showToast('Gagal memuat rekap peserta: ' + err.message, 'error'));
}

function renderRecap(dash, recaps) {
  const summaryContainer = document.getElementById('recap-summary-container');
  
  let statusNotifyHtml = '';
  if (dash.totalDisetujui > dash.totalDanaMasuk) {
    statusNotifyHtml = `
      <div class="status-banner deficit" style="margin-top:12px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        <span>Dana transport kurang sebesar <strong>${formatRupiah(dash.totalDisetujui - dash.totalDanaMasuk)}</strong></span>
      </div>
    `;
  } else {
    statusNotifyHtml = `
      <div class="status-banner surplus" style="margin-top:12px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <span>Sisa dana transport sebesar <strong>${formatRupiah(dash.totalDanaMasuk - dash.totalDisetujui)}</strong></span>
      </div>
    `;
  }
  
  summaryContainer.innerHTML = `
    <div class="card" style="padding:16px;">
      <h3 style="font-size:13px; font-weight:700; color:var(--primary); margin-bottom:12px; text-transform:uppercase;">Rekapitulasi Dana Utama</h3>
      <table style="width:100%; border-collapse:collapse; font-size:12px;">
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 0; color:var(--text-muted);">DP Awal</td><td style="padding:6px 0; text-align:right; font-weight:600;">${formatRupiah(dash.dpAwal)}</td></tr>
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 0; color:var(--text-muted);">Dana Tambahan</td><td style="padding:6px 0; text-align:right; font-weight:600;">${formatRupiah(dash.totalTambahan)}</td></tr>
        <tr style="border-bottom:2px solid var(--primary);"><td style="padding:8px 0; font-weight:700; color:var(--primary);">Total Dana Masuk</td><td style="padding:8px 0; text-align:right; font-weight:700; color:var(--primary);">${formatRupiah(dash.totalDanaMasuk)}</td></tr>
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:8px 0; color:var(--text-muted);">Total Pengeluaran Disetujui</td><td style="padding:8px 0; text-align:right; font-weight:600;">${formatRupiah(dash.totalDisetujui)}</td></tr>
        <tr style="border-bottom:1px solid var(--border);"><td style="padding:6px 0; color:var(--text-muted);">Total Belum Dibayarkan (Reimburse)</td><td style="padding:6px 0; text-align:right; font-weight:600; color:var(--danger);">${formatRupiah(dash.totalBelumBayar)}</td></tr>
        <tr style="background-color:var(--background);"><td style="padding:8px; font-weight:700;">Sisa / (Kekurangan) Dana</td><td style="padding:8px; text-align:right; font-weight:800; color:${dash.saldoDana >= 0 ? 'var(--primary)' : 'var(--danger)'};">${dash.saldoDana >= 0 ? formatRupiah(dash.saldoDana) : '-' + formatRupiah(dash.kekuranganDana)}</td></tr>
      </table>
      ${statusNotifyHtml}
    </div>
  `;
  
  const participantsContainer = document.getElementById('recap-participants-container');
  participantsContainer.innerHTML = '';
  
  recaps.forEach((r, idx) => {
    const accordion = document.createElement('div');
    accordion.className = 'accordion';
    accordion.setAttribute('id', `accordion-recap-${idx}`);
    
    let detailsHtml = `
      <div style="font-size:11px; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
        <span>Rumah ke Bandara: <strong>${r.toAirport} kali</strong></span>
        <span>Bandara ke Rumah: <strong>${r.fromAirport} kali</strong></span>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:11px; margin-bottom:12px;">
        <tr><td style="padding:4px 0; color:var(--text-muted);">Total Seluruh Biaya</td><td style="padding:4px 0; text-align:right; font-weight:600;">${formatRupiah(r.totalCost)}</td></tr>
        <tr><td style="padding:4px 0; color:var(--text-muted);">Menggunakan Uang Pribadi</td><td style="padding:4px 0; text-align:right; font-weight:600;">${formatRupiah(r.personalPaid)}</td></tr>
        <tr><td style="padding:4px 0; color:var(--text-muted);">Telah Diganti (Reimburse)</td><td style="padding:4px 0; text-align:right; font-weight:600; color:var(--success);">${formatRupiah(r.reimbursed)}</td></tr>
        <tr style="background-color:var(--background); font-weight:700;"><td style="padding:6px; color:var(--text);">Belum Diganti (Outstanding)</td><td style="padding:6px; text-align:right; color:var(--danger);">${formatRupiah(r.unpaid)}</td></tr>
      </table>
    `;
    
    accordion.innerHTML = `
      <div class="accordion-header" data-toggle="accordion" data-target="accordion-recap-${idx}">
        <div class="accordion-title">
          <div class="t-avatar" style="width:26px; height:26px; font-size:11px;">${r.nama.charAt(0).toUpperCase()}</div>
          <div>
            <strong style="font-size:13px; color:var(--text);">${r.nama}</strong>
            <span style="font-size:10px; color:var(--text-muted); display:block;">${r.transactionCount} transaksi</span>
          </div>
        </div>
        <div class="flex align-center gap-8">
          <strong style="font-size:13px; color:var(--primary);">${formatRupiah(r.totalCost)}</strong>
          <span class="accordion-arrow">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </span>
        </div>
      </div>
      <div class="accordion-content">
        ${detailsHtml}
        <button class="btn btn-secondary btn-block" style="height:36px; font-size:12px;" data-action="download-recap" data-name="${r.nama}">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Unduh Rekap PDF Peserta
        </button>
      </div>
    `;
    
    accordion.querySelector('[data-toggle="accordion"]').addEventListener('click', () => {
      accordion.classList.toggle('active');
    });
    
    accordion.querySelector('[data-action="download-recap"]').addEventListener('click', (e) => {
      downloadRecapPDF(e.target.closest('[data-name]').getAttribute('data-name'));
    });
    
    participantsContainer.appendChild(accordion);
  });
}

/**
 * ================= DATA FETCHING (ADMIN: SETTINGS) =================
 */
function loadSettingsData() {
  showGlobalLoading(true);
  callApiGet('getSettings')
    .then((settings) => {
      state.settings = settings;
      
      document.getElementById('set-api-url').value = localStorage.getItem('gas_api_url') || '';
      document.getElementById('set-nama-kegiatan').value = settings.namaKegiatan;
      document.getElementById('set-penanggung-jawab').value = settings.penanggungJawab;
      document.getElementById('set-mengetahui').value = settings.mengetahui;
      document.getElementById('set-tanggal-kegiatan').value = settings.tanggalKegiatan;
      document.getElementById('set-dp-awal').value = formatNumber(settings.dpAwal);
      
      document.getElementById('set-sheet-id').value = settings.spreadsheetId;
      document.getElementById('set-folder-bukti').value = settings.folderBuktiId;
      document.getElementById('set-folder-lapor').value = settings.folderLaporanId;
      
      showGlobalLoading(false);
    })
    .catch((err) => {
      showToast('Gagal memuat setting: ' + err.message, 'error');
      showGlobalLoading(false);
    });
}

/**
 * ================= DETAIL TRANSAKSI & ACTIONS (SETUJU, TOLAK, BAYAR) =================
 */
let currentDetailId = null;

function openExpenseDetail(id) {
  currentDetailId = id;
  const e = state.expenses.find(item => item.id === id);
  if (!e) return;
  
  const container = document.getElementById('detail-content');
  
  let paymentDetailsHtml = '';
  let verifBadge = `<span class="badge ${e.statusVerifikasi.toLowerCase()}">${e.statusVerifikasi}</span>`;
  let bayarBadge = `<span class="badge ${e.statusPembayaran.toLowerCase().replace(/\s+/g, '-')}" style="margin-left:4px;">${e.statusPembayaran}</span>`;
  
  if (e.statusPembayaran === 'Sudah Dibayar') {
    let buktiBayarLinkHtml = '';
    if (e.linkBuktiPembayaran) {
      const viewUrl = getDirectViewUrl(e.linkBuktiPembayaran);
      buktiBayarLinkHtml = `
        <div style="margin-top:6px;">
          <img src="${viewUrl}" class="proof-preview-img" alt="Bukti Transfer Bayar">
          <a href="${e.linkBuktiPembayaran}" target="_blank" class="btn btn-secondary btn-block" style="height:36px; font-size:11px; margin-top:6px;">Buka Gambar Asli</a>
        </div>
      `;
    }
    
    paymentDetailsHtml = `
      <div class="detail-item" style="border-top: 1.5px dashed var(--border); padding-top:10px; margin-top:10px;">
        <span class="label">Rincian Reimbursement</span>
        <div style="font-size:12px; margin-top:6px;">
          <div>Tanggal Bayar: <strong>${formatTanggalIndo(e.tanggalPembayaran)}</strong></div>
          <div>Metode: <strong>${e.metodePembayaran}</strong></div>
          ${buktiBayarLinkHtml}
        </div>
      </div>
    `;
  }
  
  let proofHtml = '';
  if (e.linkBukti) {
    const viewUrl = getDirectViewUrl(e.linkBukti);
    proofHtml = `
      <div class="detail-item">
        <span class="label">Bukti Pengeluaran</span>
        <div>
          <img src="${viewUrl}" class="proof-preview-img" alt="Bukti Transport">
          <a href="${e.linkBukti}" target="_blank" class="btn btn-secondary btn-block" style="height:36px; font-size:11px; margin-top:6px;">Buka Gambar Asli</a>
        </div>
      </div>
    `;
  }
  
  let rejectionHtml = '';
  if (e.statusVerifikasi === 'Ditolak' && e.alasanPenolakan) {
    rejectionHtml = `
      <div class="detail-item" style="background-color:var(--danger-light); padding:10px; border-radius:var(--radius-sm); border:1px solid rgba(220,38,38,0.2);">
        <span class="label" style="color:var(--danger);">Alasan Penolakan</span>
        <div class="value" style="color:var(--danger);">${e.alasanPenolakan}</div>
      </div>
    `;
  }
  
  container.innerHTML = `
    <div class="detail-item">
      <span class="label">ID Transaksi & Status</span>
      <div class="value flex align-center justify-between" style="font-size:14px;">
        <strong>${e.id}</strong>
        <div>
          ${verifBadge}
          ${bayarBadge}
        </div>
      </div>
    </div>
    <div class="detail-item">
      <span class="label">Nama Peserta</span>
      <div class="value">${e.namaPeserta}</div>
    </div>
    <div class="detail-item">
      <span class="label">Tanggal Perjalanan</span>
      <div class="value">${formatTanggalIndo(e.tanggalPerjalanan)}</div>
    </div>
    <div class="detail-item">
      <span class="label">Jenis Perjalanan</span>
      <div class="value">${e.jenisPerjalanan}</div>
    </div>
    <div class="detail-item">
      <span class="label">Rute & Transportasi</span>
      <div class="value">${e.lokasiAsal} &rarr; ${e.lokasiTujuan} (${e.jenisTransportasi})</div>
    </div>
    <div class="detail-item">
      <span class="label">Biaya Pengeluaran</span>
      <div class="value" style="font-size:15px; font-weight:700; color:var(--primary);">${formatRupiah(e.nominal)}</div>
    </div>
    <div class="detail-item">
      <span class="label">Dibayar Menggunakan</span>
      <div class="value">${e.dibayarOleh}</div>
    </div>
    <div class="detail-item">
      <span class="label">Keterangan</span>
      <div class="value">${e.keterangan || '-'}</div>
    </div>
    ${rejectionHtml}
    ${proofHtml}
    ${paymentDetailsHtml}
    
    <div class="flex gap-10 mt-16">
      <button class="btn btn-secondary" style="flex:1;" id="btn-detail-download">Unduh Bukti PDF</button>
    </div>
    <div id="detail-actions-placeholder"></div>
  `;
  
  bindElClick('btn-detail-download', () => downloadSingleTransactionPDF(e.id));
  
  const actionsPlaceholder = document.getElementById('detail-actions-placeholder');
  if (state.role === 'admin') {
    let approveBtn = '';
    let rejectBtn = '';
    let payBtn = '';
    let deleteBtn = `<button class="btn btn-danger btn-block" id="btn-detail-delete">Hapus Transaksi</button>`;
    
    if (e.statusVerifikasi === 'Menunggu') {
      approveBtn = `<button class="btn btn-success" style="flex:1;" id="btn-detail-approve">Setujui</button>`;
      rejectBtn = `<button class="btn btn-danger" style="flex:1;" id="btn-detail-reject">Tolak</button>`;
    }
    
    if (e.statusVerifikasi === 'Disetujui' && e.statusPembayaran === 'Belum Dibayar') {
      payBtn = `<button class="btn btn-primary btn-block" id="btn-detail-pay">Tandai Sudah Dibayar</button>`;
    }
    
    actionsPlaceholder.innerHTML = `
      <div class="flex gap-10 mt-16">
        ${approveBtn}
        ${rejectBtn}
      </div>
      <div class="mt-10">
        ${payBtn}
      </div>
      <div class="mt-10">
        ${deleteBtn}
      </div>
    `;
    
    bindElClick('btn-detail-approve', () => triggerApprove(e.id));
    bindElClick('btn-detail-reject', () => openRejectionModal(e.id));
    bindElClick('btn-detail-pay', () => openPaymentModal(e.id));
    bindElClick('btn-detail-delete', () => triggerDeleteExpense(e.id));
  } else {
    actionsPlaceholder.innerHTML = '';
  }
  
  openBottomSheet('detail-sheet');
}

// Mengubah link Drive ke format langsung embeddable
function getDirectViewUrl(driveUrl) {
  if (!driveUrl) return '';
  const match = driveUrl.match(/[-\w]{25,}/);
  if (match) {
    return 'https://drive.google.com/uc?export=view&id=' + match[0];
  }
  return driveUrl;
}

/**
 * Persetujuan & Penolakan
 */
function triggerApprove(id) {
  if (!confirm('Apakah Anda yakin ingin menyetujui pengajuan ini?')) return;
  
  showGlobalLoading(true);
  updateExpenseStatus(id, 'Disetujui', '')
    .then((res) => {
      showGlobalLoading(false);
      if (res.success) {
        showToast(res.message, 'success');
        closeBottomSheet('detail-sheet');
        onViewChange(state.activeView);
      } else {
        showToast(res.message, 'error');
      }
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Gagal memverifikasi: ' + err.message, 'error');
    });
}

function openRejectionModal(id) {
  document.getElementById('reject-expense-id').value = id;
  document.getElementById('reject-reason').value = '';
  openModal('reject-modal');
}

function submitRejection() {
  const id = document.getElementById('reject-expense-id').value;
  const reason = document.getElementById('reject-reason').value.trim();
  
  if (!reason) {
    showToast('Alasan penolakan wajib diisi.', 'error');
    return;
  }
  
  closeModal('reject-modal');
  showGlobalLoading(true);
  
  updateExpenseStatus(id, 'Ditolak', reason)
    .then((res) => {
      showGlobalLoading(false);
      if (res.success) {
        showToast(res.message, 'success');
        closeBottomSheet('detail-sheet');
        onViewChange(state.activeView);
      } else {
        showToast(res.message, 'error');
      }
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Gagal memproses penolakan: ' + err.message, 'error');
    });
}

/**
 * Pembayaran Penggantian Dana (Reimbursement)
 */
function openPaymentModal(id) {
  document.getElementById('pay-expense-id').value = id;
  document.getElementById('pay-tanggal').value = new Date().toISOString().split('T')[0];
  document.getElementById('pay-metode').value = 'Transfer Bank';
  document.getElementById('pay-bukti').value = '';
  document.getElementById('pay-preview').innerHTML = '';
  document.getElementById('pay-preview').style.display = 'none';
  state.tempPaymentFile = null;
  
  openModal('pay-modal');
}

function submitPayment() {
  const id = document.getElementById('pay-expense-id').value;
  const tanggal = document.getElementById('pay-tanggal').value;
  const metode = document.getElementById('pay-metode').value;
  
  if (!tanggal || !metode) {
    showToast('Semua input wajib diisi.', 'error');
    return;
  }
  
  const paymentData = {
    tanggalPembayaran: tanggal,
    metodePembayaran: metode,
    fileData: state.tempPaymentFile ? state.tempPaymentFile.base64 : null,
    fileName: state.tempPaymentFile ? state.tempPaymentFile.name : ''
  };
  
  closeModal('pay-modal');
  showGlobalLoading(true);
  
  savePayment(id, paymentData)
    .then((res) => {
      showGlobalLoading(false);
      if (res.success) {
        showToast(res.message, 'success');
        closeBottomSheet('detail-sheet');
        onViewChange(state.activeView);
      } else {
        showToast(res.message, 'error');
      }
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Gagal memproses pembayaran: ' + err.message, 'error');
    });
}

/**
 * Hapus Transaksi Pengeluaran
 */
function triggerDeleteExpense(id) {
  if (!confirm('Apakah Anda yakin ingin menghapus transaksi ini secara permanen?')) return;
  
  showGlobalLoading(true);
  deleteExpense(id)
    .then((res) => {
      showGlobalLoading(false);
      if (res.success) {
        showToast(res.message, 'success');
        closeBottomSheet('detail-sheet');
        onViewChange(state.activeView);
      } else {
        showToast(res.message, 'error');
      }
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Gagal menghapus: ' + err.message, 'error');
    });
}

/**
 * ================= FORM SUBMISSION EVENT HANDLERS =================
 */
function setupFormSubmitHandlers() {
  // 1. Form Pengeluaran Transport (Tambah)
  const expForm = document.getElementById('form-add-expense');
  if (expForm) {
    expForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const peserta = document.getElementById('exp-peserta').value;
      const tanggal = document.getElementById('exp-tanggal').value;
      const jenisPerjalanan = document.getElementById('exp-jenis-perjalanan').value;
      const asal = document.getElementById('exp-asal').value.trim();
      const tujuan = document.getElementById('exp-tujuan').value.trim();
      const transport = document.getElementById('exp-transport').value;
      const nominal = parseRupiah(document.getElementById('exp-nominal').value);
      const dibayarOleh = document.getElementById('exp-dibayar-oleh').value;
      const keterangan = document.getElementById('exp-keterangan').value.trim();
      
      if (!peserta) { showToast('Wajib memilih peserta.', 'error'); return; }
      if (!tanggal) { showToast('Tanggal perjalanan wajib diisi.', 'error'); return; }
      if (!jenisPerjalanan) { showToast('Jenis perjalanan wajib diisi.', 'error'); return; }
      if (!asal || !tujuan) { showToast('Lokasi asal dan tujuan wajib diisi.', 'error'); return; }
      if (!transport) { showToast('Jenis transportasi wajib diisi.', 'error'); return; }
      if (nominal <= 0) { showToast('Nominal biaya tidak valid.', 'error'); return; }
      if (!dibayarOleh) { showToast('Status penanggung bayar wajib dipilih.', 'error'); return; }
      if (!state.tempFile) { showToast('Foto bukti transaksi wajib diunggah.', 'error'); return; }
      
      const submitBtn = expForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      showGlobalLoading(true);
      
      const expenseObj = {
        namaPeserta: peserta,
        tanggalPerjalanan: tanggal,
        jenisPerjalanan: jenisPerjalanan,
        lokasiAsal: asal,
        lokasiTujuan: tujuan,
        jenisTransportasi: transport,
        nominal: nominal,
        dibayarOleh: dibayarOleh,
        keterangan: keterangan,
        fileData: state.tempFile ? state.tempFile.base64 : null,
        fileName: state.tempFile ? state.tempFile.name : ''
      };
      
      callApiPost('saveExpense', expenseObj)
        .then((res) => {
          showGlobalLoading(false);
          submitBtn.disabled = false;
          
          if (res.success) {
            showToast(res.message, 'success');
            expForm.reset();
            state.tempFile = null;
            document.getElementById('exp-preview').innerHTML = '';
            document.getElementById('exp-preview').style.display = 'none';
            
            if (state.role === 'admin') {
              switchView('dashboard');
            } else {
              switchView('portal-dashboard');
            }
          } else {
            showToast(res.message, 'error');
          }
        })
        .catch((err) => {
          showGlobalLoading(false);
          submitBtn.disabled = false;
          showToast('Gagal mengirim data: ' + err.message, 'error');
        });
    });
  }
  
  // 2. Form Dana Masuk (Tambah Dana Tambahan)
  const fundForm = document.getElementById('form-add-fund');
  if (fundForm) {
    fundForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const tanggal = document.getElementById('fund-tanggal').value;
      const jenisDana = document.getElementById('fund-jenis').value;
      const nominal = parseRupiah(document.getElementById('fund-nominal').value);
      const keterangan = document.getElementById('fund-keterangan').value.trim();
      
      if (!tanggal || !jenisDana) { showToast('Tanggal dan jenis dana wajib diisi.', 'error'); return; }
      if (nominal <= 0) { showToast('Nominal dana tidak valid.', 'error'); return; }
      
      const submitBtn = fundForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      showGlobalLoading(true);
      
      const fundObj = {
        tanggal: tanggal,
        jenisDana: jenisDana,
        nominal: nominal,
        keterangan: keterangan,
        fileData: state.tempFundFile ? state.tempFundFile.base64 : null,
        fileName: state.tempFundFile ? state.tempFundFile.name : ''
      };
      
      callApiPost('saveFund', fundObj)
        .then((res) => {
          showGlobalLoading(false);
          submitBtn.disabled = false;
          
          if (res.success) {
            showToast(res.message, 'success');
            fundForm.reset();
            state.tempFundFile = null;
            document.getElementById('fund-preview').innerHTML = '';
            document.getElementById('fund-preview').style.display = 'none';
            switchView('funds');
          } else {
            showToast(res.message, 'error');
          }
        })
        .catch((err) => {
          showGlobalLoading(false);
          submitBtn.disabled = false;
          showToast('Gagal mencatat dana masuk: ' + err.message, 'error');
        });
    });
  }
  
  // 3. Form Pengaturan
  const settingsForm = document.getElementById('form-settings');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Update API URL di localStorage dahulu jika berubah
      const newApiUrl = document.getElementById('set-api-url').value.trim();
      if (newApiUrl) {
        localStorage.setItem('gas_api_url', newApiUrl);
      }
      
      const settingsObj = {
        namaKegiatan: document.getElementById('set-nama-kegiatan').value.trim(),
        penanggungJawab: document.getElementById('set-penanggung-jawab').value.trim(),
        mengetahui: document.getElementById('set-mengetahui').value.trim(),
        tanggalKegiatan: document.getElementById('set-tanggal-kegiatan').value.trim(),
        dpAwal: parseRupiah(document.getElementById('set-dp-awal').value),
        spreadsheetId: document.getElementById('set-sheet-id').value.trim(),
        folderBuktiId: document.getElementById('set-folder-bukti').value.trim(),
        folderLaporanId: document.getElementById('set-folder-lapor').value.trim()
      };
      
      if (!settingsObj.namaKegiatan || !settingsObj.penanggungJawab || settingsObj.dpAwal <= 0) {
        showToast('Nama kegiatan, penanggung jawab, and nominal DP awal wajib diisi secara valid.', 'error');
        return;
      }
      
      const submitBtn = settingsForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      showGlobalLoading(true);
      
      callApiPost('saveSettings', settingsObj)
        .then((res) => {
          showGlobalLoading(false);
          submitBtn.disabled = false;
          if (res.success) {
            showToast(res.message, 'success');
            state.settings = settingsObj;
            document.querySelectorAll('.app-activity-name').forEach(el => {
              el.textContent = settingsObj.namaKegiatan;
            });
          } else {
            showToast(res.message, 'error');
          }
        })
        .catch((err) => {
          showGlobalLoading(false);
          submitBtn.disabled = false;
          showToast('Gagal menyimpan pengaturan: ' + err.message, 'error');
        });
    });
  }
  
  // 4. Form Verifikasi Kode PDF Dokumen
  const verifyForm = document.getElementById('form-verify-code');
  if (verifyForm) {
    verifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const code = document.getElementById('verify-input-code').value.trim();
      if (!code) {
        showToast('Masukkan kode verifikasi terlebih dahulu.', 'error');
        return;
      }
      
      const resultBox = document.getElementById('verify-result-box');
      resultBox.style.display = 'none';
      resultBox.classList.add('hidden');
      showGlobalLoading(true);
      
      callApiGet('verifyDocument', { code: code })
        .then((res) => {
          showGlobalLoading(false);
          resultBox.style.display = 'block';
          resultBox.classList.remove('hidden');
          
          if (res.success) {
            resultBox.className = 'status-banner surplus verify-result-box';
            resultBox.innerHTML = `
              <div style="font-weight:700; font-size:13px; margin-bottom:4px; text-transform:uppercase;">Dokumen Valid</div>
              <div style="font-size:12px;">
                Tipe: <strong>${res.type}</strong><br>
                Rujukan: <strong>${res.reference}</strong><br>
                Detail: ${res.detail}<br>
                Status Sistem: <strong style="color:var(--primary);">${res.status}</strong>
              </div>
            `;
          } else {
            resultBox.className = 'status-banner deficit verify-result-box';
            resultBox.innerHTML = `
              <div style="font-weight:700; font-size:13px; margin-bottom:4px; text-transform:uppercase;">Verifikasi Gagal</div>
              <div style="font-size:12px;">${res.message}</div>
            `;
          }
        })
        .catch((err) => {
          showGlobalLoading(false);
          showToast('Gagal memverifikasi dokumen: ' + err.message, 'error');
        });
    });
  }
}

/**
 * ================= DOWNLOAD FILE PDF (BASE64 & BLOB) =================
 */
function downloadBase64File(base64Data, fileName, contentType) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: contentType });
  
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 1. Download Laporan Akhir Utama (Admin)
function generateAdminReportPDF() {
  showGlobalLoading(true);
  showToast('Sedang menyiapkan PDF...', 'success');
  
  callApiGet('generateReport')
    .then((res) => {
      showGlobalLoading(false);
      if (res.success) {
        showToast('Laporan PDF berhasil diunduh.', 'success');
        downloadBase64File(res.base64Data, res.fileName, 'application/pdf');
        
        const container = document.getElementById('report-pdf-link-container');
        if (container) {
          container.innerHTML = `
            <div class="status-banner surplus" style="margin-top:10px;">
              <span>PDF Berhasil dibuat. <a href="${res.pdfUrl}" target="_blank" style="font-weight:700; text-decoration:underline; color:var(--primary);">Buka Laporan di Google Drive</a></span>
            </div>
          `;
        }
      } else {
        showToast('Bukti PDF gagal dibuat. Silakan coba kembali.', 'error');
      }
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Gagal membuat PDF: ' + err.message, 'error');
    });
}

// 2. Download Bukti Transaksi Tunggal
function downloadSingleTransactionPDF(transactionId) {
  showGlobalLoading(true);
  showToast('Sedang menyiapkan PDF...', 'success');
  
  const pName = state.role === 'peserta' ? state.activeParticipant : '';
  
  callApiGet('generateTransactionPDF', { id: transactionId, name: pName })
    .then((res) => {
      showGlobalLoading(false);
      showToast('Bukti PDF berhasil diunduh.', 'success');
      downloadBase64File(res.base64Data, res.fileName, 'application/pdf');
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Gagal mengunduh bukti PDF: ' + err.message, 'error');
    });
}

// 3. Download Rekap Peserta Tunggal (Admin / Peserta)
function downloadRecapPDF(participantName) {
  showGlobalLoading(true);
  showToast('Sedang menyiapkan PDF...', 'success');
  
  callApiGet('generateParticipantRecapPDF', { name: participantName })
    .then((res) => {
      showGlobalLoading(false);
      showToast('Bukti PDF berhasil diunduh.', 'success');
      downloadBase64File(res.base64Data, res.fileName, 'application/pdf');
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Gagal mengunduh rekap PDF: ' + err.message, 'error');
    });
}

/**
 * ================= PORTAL PESERTA FLOWS =================
 */
function handlePortalAccess() {
  const nameSelect = document.getElementById('portal-peserta-select');
  const name = nameSelect.value;
  
  if (!name) {
    showToast('Silakan pilih nama Anda terlebih dahulu.', 'error');
    return;
  }
  
  showGlobalLoading(true);
  
  callApiGet('verifyParticipant', { name: name })
    .then((res) => {
      showGlobalLoading(false);
      if (res.success) {
        state.role = 'peserta';
        state.activeParticipant = res.participant.nama;
        
        const loginScreen = document.getElementById('portal-login-screen');
        const portalLayout = document.getElementById('portal-app-layout');
        const welcomeName = document.getElementById('portal-welcome-name');
        const portalBottomNav = document.getElementById('portal-bottom-nav');
        
        if (loginScreen) {
          loginScreen.style.display = 'none';
          loginScreen.classList.add('hidden');
        }
        if (portalLayout) {
          portalLayout.style.display = 'block';
          portalLayout.classList.remove('hidden');
        }
        if (welcomeName) welcomeName.textContent = res.participant.nama;
        if (portalBottomNav) {
          portalBottomNav.style.display = 'flex';
          portalBottomNav.classList.remove('hidden');
        }
        
        switchView('portal-dashboard');
        showToast(`Selamat datang di portal, ${res.participant.nama}!`);
      } else {
        showToast(res.message, 'error');
      }
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Akses ditolak: ' + err.message, 'error');
    });
}

function loadPortalDashboard() {
  const welcomeText = document.getElementById('portal-welcome-name');
  if (welcomeText) welcomeText.textContent = state.activeParticipant;
  
  document.getElementById('portal-stats-card').style.opacity = '0.5';
  const listContainer = document.getElementById('portal-expenses-list');
  listContainer.innerHTML = '<div class="skeleton skeleton-card"></div><div class="skeleton skeleton-card"></div>';
  
  callApiGet('getParticipantDashboard', { name: state.activeParticipant })
    .then((data) => {
      document.getElementById('portal-stats-card').style.opacity = '1';
      listContainer.innerHTML = '';
      
      const r = data.recap;
      document.getElementById('portal-stat-total-transaksi').textContent = `${r.transactionCount} kali`;
      document.getElementById('portal-stat-total-disetujui').textContent = formatRupiah(r.totalCost);
      document.getElementById('portal-stat-sudah-diganti').textContent = formatRupiah(r.reimbursed);
      document.getElementById('portal-stat-belum-diganti').textContent = formatRupiah(r.unpaid);
      
      if (data.expenses.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <h3>Belum ada pengeluaran transport</h3>
            <p>Silakan catat pengeluaran transport Anda melalui tombol + di bawah.</p>
          </div>
        `;
        return;
      }
      
      data.expenses.forEach(e => {
        listContainer.appendChild(createTransactionCard(e));
      });
    })
    .catch((err) => {
      showToast('Gagal memuat portal: ' + err.message, 'error');
    });
}

function downloadMyRecap() {
  if (!state.activeParticipant) return;
  downloadRecapPDF(state.activeParticipant);
}

function logoutPortal() {
  state.role = 'admin';
  state.activeParticipant = null;
  
  const loginScreen = document.getElementById('portal-login-screen');
  const portalLayout = document.getElementById('portal-app-layout');
  const portalBottomNav = document.getElementById('portal-bottom-nav');
  
  if (loginScreen) {
    loginScreen.style.display = 'flex';
    loginScreen.classList.remove('hidden');
  }
  if (portalLayout) {
    portalLayout.style.display = 'none';
    portalLayout.classList.add('hidden');
  }
  if (portalBottomNav) {
    portalBottomNav.style.display = 'none';
    portalBottomNav.classList.add('hidden');
  }
  
  switchView('portal-login');
  showToast('Anda telah keluar dari portal.');
}

/**
 * ================= DOCK SWITCHER (ADMIN VS PORTAL) =================
 */
function exitAdminToPortal() {
  const adminLayout = document.getElementById('admin-app-layout');
  const loginScreen = document.getElementById('portal-login-screen');
  
  if (adminLayout) {
    adminLayout.style.display = 'none';
    adminLayout.classList.add('hidden');
  }
  if (loginScreen) {
    loginScreen.style.display = 'flex';
    loginScreen.classList.remove('hidden');
  }
  
  switchView('portal-login');
}

function enterAdminMode() {
  const pinInput = document.getElementById('admin-pin-input');
  if (pinInput) {
    pinInput.value = '';
  }
  openModal('admin-pin-modal');
  setTimeout(() => {
    if (pinInput) pinInput.focus();
  }, 100);
}

function verifyAdminPin() {
  const pinInput = document.getElementById('admin-pin-input');
  if (!pinInput) return;
  
  const pinVal = pinInput.value;
  if (pinVal === '0708') {
    closeModal('admin-pin-modal');
    
    const loginScreen = document.getElementById('portal-login-screen');
    const portalLayout = document.getElementById('portal-app-layout');
    const adminLayout = document.getElementById('admin-app-layout');
    
    if (loginScreen) {
      loginScreen.style.display = 'none';
      loginScreen.classList.add('hidden');
    }
    if (portalLayout) {
      portalLayout.style.display = 'none';
      portalLayout.classList.add('hidden');
    }
    if (adminLayout) {
      adminLayout.style.display = 'block';
      adminLayout.classList.remove('hidden');
    }
    
    state.role = 'admin';
    state.activeParticipant = null;
    
    switchView('dashboard');
    showToast('Akses Administrator Diterima.');
  } else {
    showToast('PIN Administrator salah! Akses ditolak.', 'error');
  }
}

/**
 * Menambahkan data peserta dari halaman peserta (Admin)
 */
function openAddParticipantModal() {
  document.getElementById('part-id').value = '';
  document.getElementById('part-nama').value = '';
  document.getElementById('part-nohp').value = '';
  document.getElementById('part-ket').value = '';
  document.getElementById('part-status').value = 'Aktif';
  
  document.getElementById('part-modal-title').textContent = 'Tambah Peserta Baru';
  openModal('part-modal');
}

function openEditParticipant(idx) {
  const p = state.participants[idx];
  if (!p) return;
  
  document.getElementById('part-id').value = p.id;
  document.getElementById('part-nama').value = p.nama;
  document.getElementById('part-nohp').value = p.nohp;
  document.getElementById('part-ket').value = p.keterangan;
  document.getElementById('part-status').value = p.status;
  
  document.getElementById('part-modal-title').textContent = 'Edit Data Peserta';
  openModal('part-modal');
}

function submitParticipant() {
  const id = document.getElementById('part-id').value;
  const nama = document.getElementById('part-nama').value.trim();
  const nohp = document.getElementById('part-nohp').value.trim();
  const keterangan = document.getElementById('part-ket').value.trim();
  const status = document.getElementById('part-status').value;
  
  if (!nama || !nohp) {
    showToast('Nama dan Nomor HP wajib diisi.', 'error');
    return;
  }
  
  closeModal('part-modal');
  showGlobalLoading(true);
  
  const participantObj = { id, nama, nohp, keterangan, status };
  
  callApiPost('saveParticipant', participantObj)
    .then((res) => {
      showGlobalLoading(false);
      if (res.success) {
        showToast(res.message, 'success');
        
        // Refresh daftar peserta
        callApiGet('getParticipants')
          .then((participants) => {
            state.participants = participants;
            populateParticipantDropdowns();
            renderParticipantsAdminList();
          });
      } else {
        showToast(res.message, 'error');
      }
    })
    .catch((err) => {
      showGlobalLoading(false);
      showToast('Gagal memproses peserta: ' + err.message, 'error');
    });
}

function renderParticipantsAdminList() {
  const container = document.getElementById('part-list-container');
  container.innerHTML = '';
  
  if (state.participants.length === 0) {
    container.innerHTML = '<div class="empty-state"><h3>Belum ada peserta</h3></div>';
    return;
  }
  
  state.participants.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.style.padding = '14px';
    card.style.marginBottom = '10px';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    
    card.innerHTML = `
      <div>
        <strong style="color:var(--primary); font-size:14px;">${p.nama}</strong>
        <span style="font-size:11px; color:var(--text-muted); display:block;">ID: ${p.id} &middot; HP: ${p.nohp}</span>
        <span style="font-size:10px; color:var(--text-muted); display:block;">Keterangan: ${p.keterangan || '-'}</span>
      </div>
      <div class="flex align-center gap-8">
        <span class="badge ${p.status === 'Aktif' ? 'disetujui' : 'ditolak'}">${p.status}</span>
        <button class="btn btn-secondary" style="height:32px; padding:0 8px; font-size:11px;" data-edit-index="${idx}">Edit</button>
      </div>
    `;
    
    card.querySelector('[data-edit-index]').addEventListener('click', () => {
      openEditParticipant(idx);
    });
    
    container.appendChild(card);
  });
}

function loadAdminParticipantsView() {
  renderParticipantsAdminList();
}
