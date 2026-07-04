export const TplAuth = `
<div class="row justify-content-center align-items-center p-3" style="min-height: 80vh;">
    <div class="col-12 col-sm-10 col-md-6 col-lg-4">

        <div class="text-center mb-4 d-md-none">
            <h3 class="fw-bold text-primary">Sistem KGB</h3>
            <p class="text-muted small">Silakan login untuk melanjutkan</p>
        </div>

        <!-- ===================================================== -->
        <!-- STEP 1: EMAIL + PASSWORD                               -->
        <!-- ===================================================== -->
        <div v-if="store.authStep === 'login'" class="card p-4 shadow-sm border-0">
            <form @submit.prevent="handleLogin">
                <div class="mb-3">
                    <label class="form-label small text-muted text-uppercase fw-bold">Email Dinas</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="bi bi-envelope"></i></span>
                        <input v-model="email" type="email" class="form-control border-start-0 ps-0" placeholder="nama@gmail.com" required>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label small text-muted text-uppercase fw-bold">Password</label>
                    <div class="input-group">
                        <span class="input-group-text bg-light border-end-0"><i class="bi bi-lock"></i></span>
                        <input v-model="password" type="password" class="form-control border-start-0 ps-0" placeholder="••••••••" required>
                    </div>
                </div>

                <div class="mb-4">
                    <label class="form-label small text-muted text-uppercase fw-bold">Kode Keamanan</label>
                    <div class="d-flex align-items-center gap-2 mb-2">
                        <canvas ref="captchaCanvas" width="140" height="45" class="border rounded bg-light cursor-pointer flex-shrink-0" title="Klik untuk ganti" @click="generateCaptcha"></canvas>
                        <button type="button" class="btn btn-light border flex-fill" @click="generateCaptcha" title="Ganti Kode">
                            <i class="bi bi-arrow-clockwise"></i>
                        </button>
                    </div>
                    <input v-model="captchaInput" type="text" class="form-control" placeholder="Ketik kode di gambar..." required maxlength="6">
                </div>

                <div v-if="errorMsg" class="alert alert-danger d-flex align-items-center small py-2 mb-3">
                    <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ errorMsg }}
                </div>

                <button type="submit" class="btn btn-primary w-100 py-2 mb-3 shadow-sm" :disabled="store.isLoading">
                    {{ store.isLoading ? 'Memproses...' : 'Masuk Aplikasi' }} <i class="bi bi-arrow-right ms-2"></i>
                </button>
            </form>

            <!-- Separator -->
            <div class="d-flex align-items-center my-3">
                <hr class="flex-grow-1 text-secondary opacity-25">
                <span class="px-2 small text-muted">atau</span>
                <hr class="flex-grow-1 text-secondary opacity-25">
            </div>

            <!-- Tombol Google -->
            <button 
                type="button" 
                class="btn btn-outline-secondary w-100 py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                @click="handleGoogleLogin"
                :disabled="store.isLoading"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.96 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>{{ store.isLoading ? 'Memproses...' : 'Masuk dengan Google' }}</span>
            </button>
        </div>

        <!-- ===================================================== -->
        <!-- STEP 2: SETUP 2FA (QR Code — pertama kali)            -->
        <!-- ===================================================== -->
        <div v-else-if="store.authStep === 'setup_2fa'" class="card p-4 shadow-sm border-0">
            <div class="text-center mb-3">
                <div class="bg-warning bg-opacity-10 text-warning rounded-circle d-inline-flex p-3 mb-2">
                    <i class="bi bi-shield-lock fs-3"></i>
                </div>
                <h5 class="fw-bold mb-1">Setup Autentikasi 2 Faktor</h5>
                <p class="text-muted small mb-0">Diperlukan sekali untuk akun Anda</p>
            </div>

            <ol class="small text-muted ps-3 mb-3">
                <li class="mb-1">Install <strong>Google Authenticator</strong> atau <strong>Authy</strong> di HP Anda</li>
                <li class="mb-1">Buka aplikasi, pilih <strong>"Tambah Akun"</strong> → <strong>"Scan QR Code"</strong></li>
                <li>Scan kode di bawah ini, lalu masukkan kode 6 digit yang muncul</li>
            </ol>

            <!-- QR Code -->
            <div class="text-center mb-3">
                <div v-if="qrDataUrl" class="d-inline-block p-2 border rounded bg-white shadow-sm">
                    <img :src="qrDataUrl" alt="QR Code 2FA" width="200" height="200">
                </div>
                <div v-else class="d-flex justify-content-center align-items-center bg-light border rounded" style="width:200px;height:200px;margin:auto;">
                    <div class="spinner-border text-primary" role="status"></div>
                </div>
            </div>

            <!-- Input Kode Konfirmasi -->
            <div class="mb-3">
                <label class="form-label small text-muted text-uppercase fw-bold">Kode Verifikasi (6 digit)</label>
                <input 
                    v-model="totpCode" 
                    type="text" 
                    inputmode="numeric" 
                    pattern="[0-9]*"
                    class="form-control form-control-lg text-center fw-bold letter-spacing-wide" 
                    placeholder="_ _ _ _ _ _" 
                    maxlength="6"
                    @keyup.enter="confirmSetup"
                    style="font-size:1.5rem; letter-spacing: 0.5rem;"
                >
            </div>

            <div v-if="errorMsg" class="alert alert-danger d-flex align-items-center small py-2 mb-3">
                <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ errorMsg }}
            </div>

            <button 
                class="btn btn-success w-100 py-2 mb-2 fw-bold" 
                @click="confirmSetup" 
                :disabled="isVerifying || totpCode.length !== 6"
            >
                <span v-if="isVerifying"><span class="spinner-border spinner-border-sm me-2"></span>Memverifikasi...</span>
                <span v-else><i class="bi bi-check-circle me-2"></i>Konfirmasi & Aktifkan 2FA</span>
            </button>
            <button class="btn btn-outline-secondary btn-sm w-100" @click="cancelToStep1">
                <i class="bi bi-arrow-left me-1"></i> Kembali ke Login
            </button>
        </div>

        <!-- ===================================================== -->
        <!-- STEP 3: VERIFIKASI TOTP (login berikutnya)            -->
        <!-- ===================================================== -->
        <div v-else-if="store.authStep === 'verify_2fa'" class="card p-4 shadow-sm border-0">
            <div class="text-center mb-4">
                <div class="bg-primary bg-opacity-10 text-primary rounded-circle d-inline-flex p-3 mb-2">
                    <i class="bi bi-shield-check fs-3"></i>
                </div>
                <h5 class="fw-bold mb-1">Verifikasi Dua Faktor</h5>
                <p class="text-muted small mb-0">
                    Buka <strong>Google Authenticator</strong> dan masukkan<br>kode untuk <strong>SIMPEL KGB</strong>
                </p>
            </div>

            <div class="mb-4">
                <label class="form-label small text-muted text-uppercase fw-bold text-center d-block">Kode Autentikasi (6 digit)</label>
                <input 
                    v-model="totpCode" 
                    type="text" 
                    inputmode="numeric"
                    pattern="[0-9]*"
                    class="form-control form-control-lg text-center fw-bold" 
                    placeholder="_ _ _ _ _ _" 
                    maxlength="6"
                    autofocus
                    @keyup.enter="verifyTotp"
                    style="font-size: 2rem; letter-spacing: 0.8rem;"
                >
                <div class="text-center mt-2">
                    <small class="text-muted"><i class="bi bi-clock me-1"></i>Kode berubah setiap 30 detik</small>
                </div>
            </div>

            <div v-if="errorMsg" class="alert alert-danger d-flex align-items-center small py-2 mb-3">
                <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ errorMsg }}
            </div>

            <button 
                class="btn btn-primary w-100 py-2 mb-2 fw-bold" 
                @click="verifyTotp" 
                :disabled="isVerifying || totpCode.length !== 6"
            >
                <span v-if="isVerifying"><span class="spinner-border spinner-border-sm me-2"></span>Memverifikasi...</span>
                <span v-else><i class="bi bi-unlock me-2"></i>Verifikasi & Masuk</span>
            </button>
            <button class="btn btn-outline-secondary btn-sm w-100" @click="cancelToStep1">
                <i class="bi bi-arrow-left me-1"></i> Ganti Akun
            </button>
        </div>

        <div class="text-center mt-4 text-muted small">
            &copy; 2025 He Dope Joke a we
        </div>
    </div>
</div>
`;