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
        const email = ref('');
        const password = ref('');
        const errorMsg = ref('');


        // ============================================================
        // STEP 2 (Setup QR) & STEP 3 (Verify TOTP)
        // ============================================================
        const totpCode = ref('');
        const qrDataUrl = ref('');
        const tempSecret = ref('');
        const isVerifying = ref(false);
        const attemptCount = ref(0);
        const MAX_ATTEMPTS = 3;


        // ============================================================
        // STEP 1: Login Email + Password
        // ============================================================
        const handleLogin = async () => {
            errorMsg.value = '';

            store.setLoading(true);
            try {
                await signInWithEmailAndPassword(auth, email.value, password.value);
                // onAuthStateChanged di main.js akan cek 2FA dan set store.authStep
            } catch (e) {
                console.error('Login Error:', e.code, e.message);
                if (e.code === 'auth/invalid-email') errorMsg.value = 'Format email salah.';
                else if (e.code === 'auth/user-not-found') errorMsg.value = 'Akun tidak ditemukan.';
                else if (e.code === 'auth/wrong-password') errorMsg.value = 'Password salah.';
                else if (e.code === 'auth/invalid-credential') errorMsg.value = 'Email atau password salah.';
                else if (e.code === 'auth/too-many-requests') errorMsg.value = 'Terlalu banyak percobaan. Akun dikunci sementara.';
                else errorMsg.value = 'Gagal login. Cek koneksi internet.';

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
                if (e.code === 'auth/popup-closed-by-user') errorMsg.value = 'Login dibatalkan.';
                else if (e.code !== 'auth/cancelled-popup-request') errorMsg.value = 'Login Google gagal. Coba lagi.';
                store.setLoading(false);
            }
        };

        // ============================================================
        // STEP 2: generateQRCode (harus didefinisikan SEBELUM watch)
        // ============================================================
        const generateQRCode = async () => {
            console.log('[2FA] generateQRCode dipanggil');
            const user = store.pendingUser;

            if (!user) {
                errorMsg.value = 'Session error. Silakan login ulang.';
                console.error('[2FA] pendingUser null');
                return;
            }
            if (!window.OTPAuth) {
                errorMsg.value = 'Library OTPAuth belum termuat. Refresh halaman.';
                console.error('[2FA] window.OTPAuth tidak tersedia');
                return;
            }

            try {
                // Generate TOTP secret
                const secret = new window.OTPAuth.Secret({ size: 20 });
                tempSecret.value = secret.base32;

                const totp = new window.OTPAuth.TOTP({
                    issuer: 'MASPRI',
                    label: user.email,
                    algorithm: 'SHA1',
                    digits: 6,
                    period: 30,
                    secret
                });

                const otpauthUrl = totp.toString();
                console.log('[2FA] OTPAuth URL:', otpauthUrl);

                // Generate QR — coba library dulu, fallback ke external API
                if (window.QRCode && typeof window.QRCode.toDataURL === 'function') {
                    qrDataUrl.value = await new Promise((resolve, reject) => {
                        window.QRCode.toDataURL(otpauthUrl, {
                            width: 220, margin: 2, errorCorrectionLevel: 'M'
                        }, (err, url) => {
                            if (err) reject(err);
                            else resolve(url);
                        });
                    });
                } else {
                    // Fallback: external QR API (tidak kirim secret, hanya otpauth URL)
                    console.warn('[2FA] window.QRCode tidak ada, pakai external API');
                    qrDataUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(otpauthUrl)}`;
                }

                console.log('[2FA] QR siap:', qrDataUrl.value ? 'OK' : 'KOSONG');
            } catch (e) {
                console.error('[2FA] QR Generation Error:', e);
                // Fallback jika library error
                try {
                    const totp2 = new window.OTPAuth.TOTP({
                        issuer: 'SIMPEL KGB', label: store.pendingUser?.email,
                        algorithm: 'SHA1', digits: 6, period: 30,
                        secret: window.OTPAuth.Secret.fromBase32(tempSecret.value)
                    });
                    qrDataUrl.value = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(totp2.toString())}`;
                } catch (_) {
                    errorMsg.value = `Gagal membuat QR Code. Coba refresh halaman.`;
                }
            }
        };

        // ============================================================
        // Watch authStep — SETELAH generateQRCode didefinisikan
        // { immediate: true } agar fire langsung jika sudah 'setup_2fa'
        // ============================================================
        watch(() => store.authStep, async (step) => {
            console.log('[2FA] authStep watch fired:', step);
            errorMsg.value = '';
            totpCode.value = '';
            if (step === 'setup_2fa') {
                await generateQRCode();
                store.setLoading(false);
            } else if (step === 'verify_2fa') {
                store.setLoading(false);
            }
        }, { immediate: true });

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
                    secret: window.OTPAuth.Secret.fromBase32(tempSecret.value),
                    period: 30, digits: 6, algorithm: 'SHA1'
                });
                if (totp.validate({ token: totpCode.value, window: 1 }) === null) {
                    errorMsg.value = 'Kode salah. Pastikan waktu HP Anda sudah tepat dan coba lagi.';
                    totpCode.value = '';
                    return;
                }

                // Simpan secret ke Firestore
                const user = store.pendingUser;
                await setDoc(doc(db, 'user_2fa', user.uid), {
                    secret: tempSecret.value,
                    enabled: true,
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
                const user = store.pendingUser;
                const docSnap = await getDoc(doc(db, 'user_2fa', user.uid));

                if (!docSnap.exists()) {
                    errorMsg.value = 'Data 2FA tidak ditemukan. Hubungi admin untuk reset.';
                    return;
                }

                const totp = new window.OTPAuth.TOTP({
                    secret: window.OTPAuth.Secret.fromBase32(docSnap.data().secret),
                    period: 30, digits: 6, algorithm: 'SHA1'
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
            store.authStep = 'login';
            store.pendingUser = null;
            await store.fetchUserProfile(user);
        };

        // Batal 2FA, kembali ke Step 1
        const cancelToStep1 = async () => {
            store.authStep = 'login';
            store.pendingUser = null;
            sessionStorage.removeItem('kgb_2fa_ok');
            try { await signOut(auth); } catch (_) { }
            totpCode.value = '';
            errorMsg.value = '';
            email.value = '';
            password.value = '';

        };


        return {
            // Step 1
            email, password, errorMsg, handleLogin, handleGoogleLogin, store,

            // Step 2 & 3
            totpCode, qrDataUrl, isVerifying,
            confirmSetup, verifyTotp, cancelToStep1,
        };
    }
};