// SEKARANG (Benar/Pendek):
import { ref } from 'vue';
import { auth, signInWithEmailAndPassword } from '../firebase.js';
import { store } from '../store.js';

export default {
    template: `
    <div class="row justify-content-center align-items-center" style="min-height: 80vh;">
        <div class="col-md-5 col-lg-4">
            <div class="text-center mb-5">
                <div class="bg-white p-3 d-inline-block rounded-circle shadow-sm mb-3">
                    <i class="bi bi-person-badge-fill text-primary" style="font-size: 2.5rem;"></i>
                </div>
                <h3 class="fw-bold">Selamat Datang</h3>
                <p class="text-muted">Aplikasi SIMPEG KGB</p>
            </div>

            <div class="card p-4">
                <form @submit.prevent="handleLogin">
                    <div class="mb-4">
                        <label class="form-label small text-muted text-uppercase fw-bold">Email Dinas</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light border-end-0"><i class="bi bi-envelope"></i></span>
                            <input v-model="email" type="email" class="form-control border-start-0 ps-0" placeholder="nama@instansi.go.id" required>
                        </div>
                    </div>
                    <div class="mb-4">
                        <label class="form-label small text-muted text-uppercase fw-bold">Password</label>
                        <div class="input-group">
                            <span class="input-group-text bg-light border-end-0"><i class="bi bi-lock"></i></span>
                            <input v-model="password" type="password" class="form-control border-start-0 ps-0" placeholder="••••••••" required>
                        </div>
                    </div>

                    <div v-if="errorMsg" class="alert alert-danger d-flex align-items-center small py-2">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i> {{ errorMsg }}
                    </div>

                    <button type="submit" class="btn btn-primary w-100 py-2 mb-3" :disabled="store.isLoading">
                        {{ store.isLoading ? 'Memproses...' : 'Masuk Aplikasi' }} <i class="bi bi-arrow-right ms-2"></i>
                    </button>
                </form>
            </div>
            <div class="text-center mt-4 text-muted small">
                &copy; 2025 BKPSDMD Bangka
            </div>
        </div>
    </div>
    `,
    setup() {
        const email = ref('');
        const password = ref('');
        const errorMsg = ref('');

        const handleLogin = async () => {
            store.setLoading(true);
            errorMsg.value = '';
            try {
                await signInWithEmailAndPassword(auth, email.value, password.value);
            } catch (e) {
                errorMsg.value = "Akun tidak ditemukan atau password salah.";
            } finally {
                store.setLoading(false);
            }
        };

        return { email, password, errorMsg, handleLogin, store };
    }
};