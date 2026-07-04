import { ref, onMounted, watch } from 'vue';
import { 
    auth, signInWithEmailAndPassword, signInWithPopup, googleProvider, signOut,
    db, doc, getDoc, setDoc, serverTimestamp
} from '../firebase.js'; 
import { store } from '../store.js';

// IMPORT VIEW HTML
import { TplAuth } from '../views/AuthView.js';

export default {
    template: TplAuth,
    setup() {

        // ============================================================
        // STEP 1: Email/Password
        // ============================================================
        const email    = ref('');
        const password = ref('');
        const errorMsg = ref('');

        // Captcha
        const captchaCode   = ref('');
        const captchaInput  = ref('');
        const captchaCanvas = ref(null);

        // ============================================================
        // STEP 2 (Setup QR) & STEP 3 (Verify TOTP)
        // ============================================================
        const totpCode   = ref('');
        const qrDataUrl  = ref('');
        const tempSecret = ref('');
        const isVerifying = ref(false);
        const attemptCount = ref(0);
        const MAX_ATTEMPTS = 3;

        // ============================================================
        // CAPTCHA FUNCTIONS
        // ============================================================
        const generateCaptcha = () => {
            const canvas = captchaCanvas.value;
            if (!canvas) return;
            const ctx    = canvas.getContext('2d');
            const width  = canvas.width;
            const height = canvas.height;

            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, width, height);

            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
            let code = '';
            for (let i = 0; i < 5; i++) {
                const char = chars.charAt(Math.floor(Math.random() * chars.length));
                code += char;
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = getRandomColor();
                ctx.textBaseline = 'middle';
                ctx.save();
                ctx.translate(20 + i * 22, height / 2);
                ctx.rotate((Math.random() - 0.5) * 0.4);
                ctx.fillText(char, 0, 0);
                ctx.restore();
            }
            captchaCode.value = code;

            for (let i = 0; i < 7; i++) {
                ctx.strokeStyle = getRandomColor(100);
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(Math.random() * width, Math.random() * height);
                ctx.lineTo(Math.random() * width, Math.random() * height);
                ctx.stroke();
            }
            for (let i = 0; i < 30; i++) {
                ctx.fillStyle = getRandomColor();
                ctx.beginPath();
                ctx.arc(Math.random() * width, Math.random() * height, 1, 0, 2 * Math.PI);
                ctx.fill();
            }
            captchaInput.value = '';
        };

        const getRandomColor = (max = 200) => {
            const r = Math.floor(Math.random() * max);
            const g = Math.floor(Math.random() * max);
            const b = Math.floor(Math.random() * max);
            return `rgb(${r},${g},${b})`;
        };

        // ============================================================
        // STEP 1: Login Email + Password
        // ============================================================
        const handleLogin = async () => {
            errorMsg.value = '';

            if (captchaInput.value.toUpperCase() !== captchaCode.value.toUpperCase()) {
                errorMsg.value = 'Kode keamanan salah! Coba lagi.';
                generateCaptcha();
                return;
            }

            store.setLoading(true);
            try {
                await signInWithEmailAndPassword(auth, email.value, password.value);
                // onAuthStateChanged di main.js akan cek 2FA dan set store.authStep
            } catch (e) {
                console.error('Login Error:', e.code, e.message);
                if      (e.code === 'auth/invalid-email')      errorMsg.value = 'Format email salah.';
                else if (e.code === 'auth/user-not-found')     errorMsg.value = 'Akun tidak ditemukan.';
                else if (e.code === 'auth/wrong-password')     errorMsg.value = 'Password salah.';
                else if (e.code === 'auth/invalid-credential') errorMsg.value = 'Email atau password salah.';
                else if (e.code === 'auth/too-many-requests')  errorMsg.value = 'Terlalu banyak percobaan. Akun dikunci sementara.';
                else                                            errorMsg.value = 'Gagal login. Cek koneksi internet.';
                generateCaptcha();
                password.value = '';
                store.setLoading(false);
            }
        };

        // Login via Google
        const handleGoogleLogin = async () => {
            errorMsg.value = '';
            store.setLoading(true);
            try {
                await signInWithPopup(auth, googleProvider);
                // onAuthStateChanged di main.js menangani selebihnya
            } catch (e) {
                console.error('Google Login Error:', e.code, e.message);
                if      (e.code === 'auth/popup-closed-by-user')    errorMsg.value = 'Login dibatalkan.';
                else if (e.code !== 'auth/cancelled-popup-request') errorMsg.value = 'Login Google gagal. Coba lagi.';
                store.setLoading(false);
            }
        };

        // ============================================================
        // STEP 2: Setup 2FA (QR Code — pertama kali)
        // Watch store.authStep untuk trigger generate QR
        // ============================================================
        watch(() => store.authStep, async (step) => {
            errorMsg.value = '';
            totpCode.value = '';
            if (step === 'setup_2fa') {
                await generateQRCode();
                store.setLoading(false);
            } else if (step === 'verify_2fa') {
                store.setLoading(false);
            }
        });

        const generateQRCode = async () => {
            const user = store.pendingUser;

            // Validasi library & user
            if (!user) {
                errorMsg.value = 'Session error. Silakan login ulang.';
                return;
            }
            if (!window.OTPAuth) {
                errorMsg.value = 'Library OTPAuth belum termuat. Refresh halaman.';
                console.error('window.OTPAuth tidak tersedia');
                return;
            }
            if (!window.QRCode) {
                errorMsg.value = 'Library QRCode belum termuat. Refresh halaman.';
                console.error('window.QRCode tidak tersedia');
                return;
            }

            try {
                // Generate TOTP secret
                const secret = new window.OTPAuth.Secret({ size: 20 });
                tempSecret.value = secret.base32;

                const totp = new window.OTPAuth.TOTP({
                    issuer:    'SIMPEL KGB',
                    label:     user.email,
                    algorithm: 'SHA1',
                    digits:    6,
                    period:    30,
                    secret
                });

                const otpauthUrl = totp.toString();
                console.log('OTPAuth URL:', otpauthUrl); // Debug

                // Generate QR dengan callback (lebih kompatibel di semua versi)
                qrDataUrl.value = await new Promise((resolve, reject) => {
                    window.QRCode.toDataURL(otpauthUrl, { 
                        width: 220, 
                        margin: 2,
                        errorCorrectionLevel: 'M'
                    }, (err, url) => {
                        if (err) {
                            console.error('QRCode.toDataURL error:', err);
                            reject(err);
                        } else {
                            resolve(url);
                        }
                    });
                });

                console.log('QR URL generated:', qrDataUrl.value ? 'OK' : 'EMPTY');
            } catch (e) {
                console.error('QR Generation Error:', e);
                errorMsg.value = `Gagal membuat QR Code: ${e.message || e}. Coba refresh halaman.`;
            }
        };

        // Konfirmasi setup (user scan QR dan masukkan kode pertama)
        const confirmSetup = async () => {
            errorMsg.value = '';
            if (totpCode.value.length !== 6) {
                errorMsg.value = 'Masukkan kode 6 digit dari aplikasi authenticator.';
                return;
            }
            isVerifying.value = true;
            try {
                const totp = new window.OTPAuth.TOTP({
                    secret:    window.OTPAuth.Secret.fromBase32(tempSecret.value),
                    period:    30, digits: 6, algorithm: 'SHA1'
                });
                if (totp.validate({ token: totpCode.value, window: 1 }) === null) {
                    errorMsg.value = 'Kode salah. Pastikan waktu HP Anda sudah tepat dan coba lagi.';
                    totpCode.value = '';
                    return;
                }

                // Simpan secret ke Firestore
                const user = store.pendingUser;
                await setDoc(doc(db, 'user_2fa', user.uid), {
                    secret:   tempSecret.value,
                    enabled:  true,
                    setup_at: serverTimestamp()
                });

                // Tandai 2FA sudah diverifikasi untuk sesi ini
                sessionStorage.setItem('kgb_2fa_ok', user.uid);

                // Selesaikan login
                startSessionAfter2FA(user);
            } catch (e) {
                console.error('Setup 2FA error:', e);
                errorMsg.value = 'Terjadi kesalahan. Coba lagi.';
            } finally {
                isVerifying.value = false;
            }
        };

        // ============================================================
        // STEP 3: Verifikasi TOTP (login berikutnya)
        // ============================================================
        const verifyTotp = async () => {
            errorMsg.value = '';
            if (totpCode.value.length !== 6) {
                errorMsg.value = 'Masukkan kode 6 digit.';
                return;
            }
            isVerifying.value = true;
            try {
                const user    = store.pendingUser;
                const docSnap = await getDoc(doc(db, 'user_2fa', user.uid));

                if (!docSnap.exists()) {
                    errorMsg.value = 'Data 2FA tidak ditemukan. Hubungi admin untuk reset.';
                    return;
                }

                const totp = new window.OTPAuth.TOTP({
                    secret:    window.OTPAuth.Secret.fromBase32(docSnap.data().secret),
                    period:    30, digits: 6, algorithm: 'SHA1'
                });

                if (totp.validate({ token: totpCode.value, window: 1 }) === null) {
                    attemptCount.value++;
                    if (attemptCount.value >= MAX_ATTEMPTS) {
                        await cancelToStep1();
                        errorMsg.value = 'Terlalu banyak percobaan gagal. Silakan login ulang.';
                        return;
                    }
                    errorMsg.value = `Kode salah. Sisa percobaan: ${MAX_ATTEMPTS - attemptCount.value}`;
                    totpCode.value = '';
                    return;
                }

                // Kode valid
                sessionStorage.setItem('kgb_2fa_ok', user.uid);
                attemptCount.value = 0;
                startSessionAfter2FA(user);
            } catch (e) {
                console.error('Verify TOTP error:', e);
                errorMsg.value = 'Terjadi kesalahan. Coba lagi.';
            } finally {
                isVerifying.value = false;
            }
        };

        // Helper: selesaikan login setelah 2FA berhasil
        const startSessionAfter2FA = async (user) => {
            store.authStep    = 'login';
            store.pendingUser = null;
            await store.fetchUserProfile(user);
        };

        // Batal 2FA, kembali ke Step 1
        const cancelToStep1 = async () => {
            store.authStep    = 'login';
            store.pendingUser = null;
            sessionStorage.removeItem('kgb_2fa_ok');
            try { await signOut(auth); } catch (_) {}
            totpCode.value = '';
            errorMsg.value = '';
            email.value    = '';
            password.value = '';
            generateCaptcha();
        };

        // Generate captcha saat mounted
        onMounted(() => {
            generateCaptcha();
        });

        return { 
            // Step 1
            email, password, errorMsg, handleLogin, handleGoogleLogin, store,
            captchaInput, generateCaptcha, captchaCanvas,
            // Step 2 & 3
            totpCode, qrDataUrl, isVerifying,
            confirmSetup, verifyTotp, cancelToStep1,
        };
    }
};