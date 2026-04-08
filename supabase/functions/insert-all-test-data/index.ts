import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_ID = '489bee82-2f27-4617-bc79-a9b03e966bdd';
const ORG_ID = 'a1b2c3d4-0001-0001-0001-000000000001';
const FIRMALAR = ['f004','f005','f006','f007','f008','f009','f010'];

const ADLAR = ['Ahmet','Mehmet','Ali','Hüseyin','Mustafa','İbrahim','Osman','Yusuf','Recep','Serkan','Emre','Kemal','Tarık','Cem','Burak','Volkan','Gökhan','Sinan','Murat','Tolga','Fatih','Hasan','Kadir','Orhan','Ramazan','Ufuk','Vedat','Yakup','Zafer','Bilal','Cengiz','Davut','Ercan','Ferhat','Gürkan','Halil','İsmail','Kazım','Levent','Mahmut','Necati','Ömer','Poyraz','Ramazan','Sami','Tahir','Umut','Veysel','Yılmaz','Zeki'];
const SOYADLAR = ['Yılmaz','Kaya','Demir','Şahin','Çelik','Öztürk','Koç','Aydın','Bulut','Güneş','Doğan','Kılıç','Erdoğan','Tekin','Acar','Yıldırım','Özdemir','Polat','Arslan','Yıldız','Kara','Güler','Ateş','Aslan','Avci','Balcı','Baran','Başar','Bayram','Bingöl','Bozkurt','Can','Ceylan','Çetin','Duman','Eren','Güzel','Keskin','Kurt','Mutlu','Narin','Oral','Pak','Rüzgar','Sarı','Tan','Uslu','Varol','Yavuz','Zengin'];
const GOREVLER = ['İşçi','Operatör','Teknisyen','Mühendis','Usta','Şoför','Güvenlik','Temizlik','Depo','Üretim','Bakım','Kalite','Lab','İdari','Muhasebe','Satış','Lojistik'];
const DEPT = ['Üretim','Bakım','Kalite','Depolama','İdari','Teknik','Güvenlik','Saha','Muhasebe','Satış'];
const KAN = ['A+','B+','0+','AB+','A-','B-','0-','AB-'];
const EVRAK_TUR = ['SGK Bildirgesi','İş Sözleşmesi','Kimlik Fotokopisi','Adli Sicil','Sağlık Raporu','Eğitim Belgesi','Sertifika'];
const EGITIM_TUR = ['İSG Temel Eğitim','Yangın Eğitimi','İlkyardım','İş Makinesi','Kimyasal Güvenlik','Yüksekte Çalışma','Kapalı Alan'];
const EKIPMAN_TUR = ['Forklift','Vinç','Kompresör','Jeneratör','Kaynak Makinesi','Hidrolik Kriko','Elektrik Panosu'];
const MARKA = ['Caterpillar','Komatsu','Hitachi','Bosch','Makita','Siemens','Schneider','Hyundai'];

function r(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }
function ri(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const results = { personel: 0, evrak: 0, egitim: 0, muayene: 0, ekipman: 0, uygunsuzluk: 0 };
    let globalIdx = 61;

    // 140 personel (f004-f010, her firmaya 20'şer)
    for (const firmaId of FIRMALAR) {
      for (let i = 0; i < 20; i++) {
        const ad = r(ADLAR); const soyad = r(SOYADLAR);
        const pid = `p${String(globalIdx).padStart(3, '0')}`;
        const yil = ri(2018, 2024);
        await supabase.from('personeller').insert({
          id: pid, user_id: ADMIN_ID, organization_id: ORG_ID,
          data: {
            id: pid, adSoyad: `${ad} ${soyad}`, tc: String(10000000000 + globalIdx),
            telefon: `05${ri(30,39)} ${ri(100,999)} ${String(globalIdx).padStart(2,'0')}${ri(0,9)}`,
            email: `${ad.toLowerCase()}.${soyad.toLowerCase()}@${firmaId}.com`,
            dogumTarihi: `${ri(1975,2000)}-${String(ri(1,12)).padStart(2,'0')}-${String(ri(1,28)).padStart(2,'0')}`,
            gorev: r(GOREVLER), departman: r(DEPT), iseGirisTarihi: `${yil}-${String(ri(1,12)).padStart(2,'0')}-${String(ri(1,28)).padStart(2,'0')}`,
            firmaId, durum: Math.random() > 0.9 ? 'Ayrıldı' : 'Aktif', kanGrubu: r(KAN),
            acilKisi: `${r(ADLAR)} ${soyad}`, acilTelefon: `05${ri(30,39)} 000 0000`,
            adres: 'Türkiye', olusturmaTarihi: '2023-01-01T08:00:00Z', guncellemeTarihi: '2024-01-01T00:00:00Z', silinmis: false
          },
          created_at: `${yil}-01-01T08:00:00Z`
        });
        results.personel++;
        globalIdx++;
      }
    }

    // Tüm personelleri al
    const { data: tumPersoneller } = await supabase.from('personeller').select('id,data->firmaId').eq('organization_id', ORG_ID);
    const personelList = tumPersoneller || [];

    // Evraklar (her personele 1-3 evrak)
    let eid = 1;
    for (const p of personelList.slice(0, 150)) {
      for (let i = 0; i < ri(1, 3); i++) {
        const durum = Math.random() > 0.3 ? 'Yüklü' : Math.random() > 0.5 ? 'Eksik' : 'Süre Dolmuş';
        await supabase.from('evraklar').insert({
          id: `e${String(eid).padStart(4,'0')}`, user_id: ADMIN_ID, organization_id: ORG_ID,
          data: {
            id: `e${String(eid).padStart(4,'0')}`, ad: r(EVRAK_TUR), tur: r(EVRAK_TUR),
            firmaId: p.firmaId, personelId: p.id, durum,
            yuklemeTarihi: durum === 'Yüklü' ? '2024-01-15' : null,
            gecerlilikTarihi: Math.random() > 0.5 ? `2025-${String(ri(1,12)).padStart(2,'0')}-15` : null,
            notlar: '', olusturmaTarihi: '2024-01-01T08:00:00Z', silinmis: false
          },
          created_at: '2024-01-01T08:00:00Z'
        });
        results.evrak++; eid++;
      }
    }

    // Eğitimler (her firmaya 3-5 eğitim)
    let egid = 1;
    for (const firmaId of ['f001','f002','f003','f004','f005','f006','f007','f008','f010']) {
      const firmaPersonel = personelList.filter(p => p.firmaId === firmaId).map(p => p.id);
      for (let i = 0; i < ri(3, 5); i++) {
        const katilimciSayi = Math.min(ri(5, 15), firmaPersonel.length);
        const katilimcilar = firmaPersonel.slice(0, katilimciSayi).map((pid, idx) => ({
          personelId: pid, katildi: idx < katilimciSayi * 0.8
        }));
        await supabase.from('egitimler').insert({
          id: `eg${String(egid).padStart(3,'0')}`, user_id: ADMIN_ID, organization_id: ORG_ID,
          data: {
            id: `eg${String(egid).padStart(3,'0')}`, ad: r(EGITIM_TUR),
            firmaId, tarih: `2024-${String(ri(1,12)).padStart(2,'0')}-${String(ri(1,28)).padStart(2,'0')}`,
            egitmen: r(ADLAR) + ' ' + r(SOYADLAR), aciklama: 'Eğitim açıklaması',
            katilimcilar, durum: 'Tamamlandı',
            olusturmaTarihi: '2024-01-01T08:00:00Z', silinmis: false
          },
          created_at: '2024-01-01T08:00:00Z'
        });
        results.egitim++; egid++;
      }
    }

    // Muayeneler (her personele 1 muayene)
    let mid = 1;
    for (const p of personelList.slice(0, 180)) {
      const muayeneTarih = `2024-${String(ri(1,6)).padStart(2,'0')}-${String(ri(1,28)).padStart(2,'0')}`;
      const sonrakiTarih = `202${ri(5,6)}-${String(ri(1,12)).padStart(2,'0')}-${String(ri(1,28)).padStart(2,'0')}`;
      await supabase.from('muayeneler').insert({
        id: `m${String(mid).padStart(4,'0')}`, user_id: ADMIN_ID, organization_id: ORG_ID,
        data: {
          id: `m${String(mid).padStart(4,'0')}`, personelId: p.id, firmaId: p.firmaId,
          muayeneTarihi, sonrakiTarih,
          sonuc: r(['Çalışabilir','Kısıtlı Çalışabilir','Çalışabilir']),
          hastane: r(['Özel Hastane','Devlet Hastanesi','Sağlık Ocağı']) + ' ' + ri(1,10),
          doktor: 'Dr. ' + r(ADLAR) + ' ' + r(SOYADLAR),
          notlar: '', belgeMevcut: true,
          olusturmaTarihi: '2024-01-01T08:00:00Z', silinmis: false
        },
        created_at: '2024-01-01T08:00:00Z'
      });
      results.muayene++; mid++;
    }

    // Ekipmanlar (her firmaya 5-10 ekipman)
    let ekid = 1;
    for (const firmaId of ['f001','f002','f003','f004','f005','f006','f007','f008','f010']) {
      for (let i = 0; i < ri(5, 10); i++) {
        await supabase.from('ekipmanlar').insert({
          id: `ek${String(ekid).padStart(3,'0')}`, user_id: ADMIN_ID, organization_id: ORG_ID,
          data: {
            id: `ek${String(ekid).padStart(3,'0')}`, ad: r(EKIPMAN_TUR) + ' ' + ri(1,99),
            tur: r(EKIPMAN_TUR), firmaId, bulunduguAlan: r(DEPT),
            seriNo: 'SN' + ri(10000,99999), marka: r(MARKA), model: 'Model-' + ri(1,20),
            sonKontrolTarihi: '2024-01-15',
            sonrakiKontrolTarihi: `202${ri(5,6)}-${String(ri(1,12)).padStart(2,'0')}-15`,
            durum: r(['Uygun','Uygun','Uygun','Bakımda','Uygun Değil']),
            aciklama: '', belgeMevcut: Math.random() > 0.3,
            notlar: '', sahaFotolari: [],
            olusturmaTarihi: '2024-01-01T08:00:00Z', silinmis: false
          },
          created_at: '2024-01-01T08:00:00Z'
        });
        results.ekipman++; ekid++;
      }
    }

    // Uygunsuzluklar (toplam 30-40 adet)
    let uid = 1;
    for (let i = 0; i < 35; i++) {
      const firmaId = r(['f001','f002','f003','f004','f005','f006','f007','f008','f010']);
      const durum = Math.random() > 0.4 ? 'Açık' : 'Kapandı';
      await supabase.from('uygunsuzluklar').insert({
        id: `u${String(uid).padStart(3,'0')}`, user_id: ADMIN_ID, organization_id: ORG_ID,
        data: {
          id: `u${String(uid).padStart(3,'0')}`,
          acilisNo: `DÖF-${2024}-${String(uid).padStart(3,'0')}`,
          baslik: 'Uygunsuzluk ' + uid,
          aciklama: 'Tespit edilen uygunsuzluk açıklaması',
          onlem: durum === 'Kapandı' ? 'Alınan önlem açıklaması' : '',
          firmaId,
          tarih: `2024-${String(ri(1,12)).padStart(2,'0')}-${String(ri(1,28)).padStart(2,'0')}`,
          severity: r(['Düşük','Orta','Yüksek','Kritik']),
          durum,
          sorumlu: r(ADLAR) + ' ' + r(SOYADLAR),
          hedefTarih: durum === 'Açık' ? `2025-${String(ri(1,6)).padStart(2,'0')}-15` : null,
          kapatmaTarihi: durum === 'Kapandı' ? '2024-12-15' : null,
          kapatmaAciklama: durum === 'Kapandı' ? 'Kapatma açıklaması' : '',
          acilisFotoMevcut: Math.random() > 0.5,
          kapatmaFotoMevcut: durum === 'Kapandı' && Math.random() > 0.5,
          notlar: '',
          olusturmaTarihi: '2024-01-01T08:00:00Z', silinmis: false
        },
        created_at: '2024-01-01T08:00:00Z'
      });
      results.uygunsuzluk++; uid++;
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});