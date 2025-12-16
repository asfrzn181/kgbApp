import { ref } from 'https://unpkg.com/vue@3.3.4/dist/vue.esm-browser.prod.js';
import { db, setDoc, doc, serverTimestamp } from '../firebase.js';

export default {
    emits: ['close', 'saved'], // Event ke parent (Dashboard)
    template: `
    <div class="modal fade show d-block" style="background: rgba(0,0,0,0.5);" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-warning">
                    <h5 class="modal-title fw-bold">Input Master Pegawai</h5>
                    <button type="button" class="btn-close" @click="$emit('close')"></button>
                </div>
                <div class="modal-body">
                    <form @submit.prevent="simpanMaster">
                        <div class="mb-3">
                            <label>NIP</label>
                            <input v-model="form.nip" type="text" class="form-control" required placeholder="NIP Unik">
                        </div>
                        <div class="mb-3">
                            <label>Nama Lengkap</label>
                            <input v-model="form.nama" type="text" class="form-control" required>
                        </div>
                        <div class="mb-3">
                            <label>Tempat Lahir</label>
                            <input v-model="form.tempat_lahir" type="text" class="form-control">
                        </div>
                        <div class="d-grid">
                            <button type="submit" class="btn btn-primary" :disabled="isSaving">
                                {{ isSaving ? 'Menyimpan...' : 'Simpan Master' }}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
    `,
    setup(props, { emit }) {
        const isSaving = ref(false);
        const form = ref({ nip: '', nama: '', tempat_lahir: '' });

        const simpanMaster = async () => {
            isSaving.value = true;
            try {
                // ai> simpan pakai setDoc(doc(db, col, ID)) agar ID=NIP
                await setDoc(doc(db, "master_pegawai", form.value.nip), {
                    ...form.value,
                    updated_at: serverTimestamp()
                });
                alert("Master Pegawai Tersimpan!");
                emit('saved'); // Beritahu parent untuk refresh jika perlu
                emit('close'); // Tutup modal
            } catch (e) {
                alert("Gagal: " + e.message);
            } finally {
                isSaving.value = false;
            }
        };

        return { form, isSaving, simpanMaster };
    }
};