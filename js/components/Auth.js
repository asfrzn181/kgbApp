import { ref, onMounted } from 'vue';
import { auth, signInWithEmailAndPassword } from '../firebase.js'; 
import { store } from '../store.js';

// IMPORT VIEW HTML
import { TplAuth } from '../views/AuthView.js';

export default {
    template: TplAuth,
    setup() {
        const email = ref('');
        const password = ref('');
        const errorMsg = ref('');
        
        // State Captcha
        const captchaCode = ref(''); // Kode asli (disimpan di memori)
        const captchaInput = ref('');
        const captchaCanvas = ref(null); // Referensi ke elemen <canvas>

        // FUNGSI MEMBUAT GAMBAR CAPTCHA
        const generateCaptcha = () => {
            const canvas = captchaCanvas.value;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const width = canvas.width;
            const height = canvas.height;

            // 1. Bersihkan Canvas
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = '#f8f9fa'; // Warna background
            ctx.fillRect(0, 0, width, height);

            // 2. Generate Karakter Acak (Huruf Besar, Kecil, Angka)
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // Hilangkan I, l, 1, O, 0 agar tidak bingung
            let code = '';
            const length = 5;

            for (let i = 0; i < length; i++) {
                const char = chars.charAt(Math.floor(Math.random() * chars.length));
                code += char;
                
                // Style Huruf
                ctx.font = 'bold 24px Arial';
                ctx.fillStyle = getRandomColor();
                ctx.textBaseline = 'middle';

                // Rotasi & Posisi Acak Sedikit
                ctx.save();
                const x = 20 + i * 22;
                const y = height / 2;
                const angle = (Math.random() - 0.5) * 0.4; // Miring sedikit (-0.2 sampai 0.2 rad)
                
                ctx.translate(x, y);
                ctx.rotate(angle);
                ctx.fillText(char, 0, 0);
                ctx.restore();
            }
            captchaCode.value = code; // Simpan kode asli

            // 3. Tambahkan NOISE (Garis-garis coretan) - Agar susah dibaca bot
            for (let i = 0; i < 7; i++) {
                ctx.strokeStyle = getRandomColor(100); // Warna agak transparan
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(Math.random() * width, Math.random() * height);
                ctx.lineTo(Math.random() * width, Math.random() * height);
                ctx.stroke();
            }

            // 4. Tambahkan Titik-titik (Noise Dots)
            for (let i = 0; i < 30; i++) {
                ctx.fillStyle = getRandomColor();
                ctx.beginPath();
                ctx.arc(Math.random() * width, Math.random() * height, 1, 0, 2 * Math.PI);
                ctx.fill();
            }
            
            captchaInput.value = ''; // Reset input user
        };

        // Helper Warna Acak
        const getRandomColor = (max = 200) => {
            const r = Math.floor(Math.random() * max);
            const g = Math.floor(Math.random() * max);
            const b = Math.floor(Math.random() * max);
            return `rgb(${r},${g},${b})`;
        };

        const handleLogin = async () => {
            errorMsg.value = '';

            // 1. VALIDASI CAPTCHA (Client Side)
            // Kita buat case-insensitive (A = a)
            if (captchaInput.value.toUpperCase() !== captchaCode.value.toUpperCase()) {
                errorMsg.value = "Kode keamanan salah! Coba lagi.";
                generateCaptcha(); 
                return;
            }

            store.setLoading(true);
            try {
                await signInWithEmailAndPassword(auth, email.value, password.value);
            } catch (e) {
                console.error("Login Error:", e.code, e.message);
                if (e.code === 'auth/invalid-email') errorMsg.value = "Format email salah.";
                else if (e.code === 'auth/user-not-found') errorMsg.value = "Akun tidak ditemukan.";
                else if (e.code === 'auth/wrong-password') errorMsg.value = "Password salah.";
                else if (e.code === 'auth/too-many-requests') errorMsg.value = "Terlalu banyak percobaan. Akun dikunci sementara.";
                else errorMsg.value = "Gagal login. Cek koneksi internet.";
                
                generateCaptcha();
                password.value = ''; 
            } finally {
                store.setLoading(false);
            }
        };

        // Generate saat mounted
        onMounted(() => {
            generateCaptcha();
        });

        return { 
            email, password, errorMsg, handleLogin, store,
            captchaInput, generateCaptcha, captchaCanvas
        };
    }
};