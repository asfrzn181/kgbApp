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
        </div>
        
        <div class="text-center mt-4 text-muted small">
            &copy; 2025 He Dope Joke a we
        </div>
    </div>
</div>
`;