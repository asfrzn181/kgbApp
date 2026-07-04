export const TplAuth = `
<div class="row justify-content-center align-items-center p-3" style="min-height: 80vh;">
    <div class="col-12 col-sm-10 col-md-6 col-lg-4">

        <div class="text-center mb-4 d-md-none">
            <h3 class="fw-bold text-primary">Sistem KGB</h3>
            <p class="text-muted small">Silakan login untuk melanjutkan</p>
        </div>

        <div class="card p-4 shadow-sm border-0">
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
                    <path fill="none" d="M0 0h48v48H0z"/>
                </svg>
                <span>{{ store.isLoading ? 'Memproses...' : 'Masuk dengan Google' }}</span>
            </button>

        </div>
        
        <div class="text-center mt-4 text-muted small">
            &copy; 2025 He Dope Joke a we
        </div>
    </div>
</div>
`;