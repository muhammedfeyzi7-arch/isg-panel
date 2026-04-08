import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_ID = '489bee82-2f27-4617-bc79-a9b03e966bdd';
const ORG_ID = 'a1b2c3d4-0001-0001-0001-000000000001';

const FIRMALAR = ['f001','f002','f003','f004','f005','f006','f007','f008','f009','f010'];

const ADLAR = ['Ahmet','Mehmet','Ali','Hüseyin','Mustafa','İbrahim','Osman','Yusuf','Recep','Serkan','Emre','Kemal','Tarık','Cem','Burak','Volkan','Gökhan','Sinan','Murat','Tolga','Fatih','Hasan','Kadir','Orhan','Ramazan','Ufuk','Vedat','Yakup','Zafer','Bilal','Cengiz','Davut','Ercan','Ferhat','Gürkan','Halil','İsmail','Kazım','Levent','Mahmut'];
const SOYADLAR = ['Yılmaz','Kaya','Demir','Şahin','Çelik','Öztürk','Koç','Aydın','Bulut','Güneş','Doğan','Kılıç','Erdoğan','Tekin','Acar','Yıldırım','Özdemir','Polat','Arslan','Yıldız','Kara','Güler','Ateş','Aslan','Avci','Balcı','Baran','Başar','Bayram','Bingöl','Bozkurt','Can','Ceylan','Çetin','Duman','Eren','Güzel','Keskin','Kurt'];
const GOREVLER = ['İşçi','Operatör','Teknisyen','Mühendis','Usta','Şoför','Güvenlik','Temizlik','Depo','Üretim','Bakım','Kalite','Lab','İdari'];
const DEPARTMANLAR = ['Üretim','Bakım','Kalite','Depolama','İdari','Teknik','Güvenlik','Saha'];
const KAN_GRUPLARI = ['A+','B+','0+','AB+','A-','B-','0-','AB-'];

function rastgele(arr: string[]) { return arr[Math.floor(Math.random() * arr.length)]; }
function rastgeleInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function tcUret(i: number) { return String(10000000000 + i).padStart(11, '0'); }
function telUret(firmaIdx: number, personelIdx: number) { return `05${3 + (firmaIdx % 7)}${3} ${rastgeleInt(100,999)} ${String(personelIdx).padStart(2,'0')}${rastgeleInt(0,9)}`; }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const personeller = [];
    let globalIdx = 21; // p021'den başla
    
    // f002-f010 için 180 personel (her firmaya 20'şer)
    for (let f = 1; f < 10; f++) {
      const firmaId = FIRMALAR[f];
      for (let i = 0; i < 20; i++) {
        const ad = rastgele(ADLAR);
        const soyad = rastgele(SOYADLAR);
        const gorev = rastgele(GOREVLER);
        const departman = rastgele(DEPARTMANLAR);
        const kan = rastgele(KAN_GRUPLARI);
        const yil = rastgeleInt(2015, 2024);
        const ay = String(rastgeleInt(1,12)).padStart(2,'0');
        const gun = String(rastgeleInt(1,28)).padStart(2,'0');
        const dogumYil = rastgeleInt(1975, 2000);
        
        personeller.push({
          id: `p${String(globalIdx).padStart(3,'0')}`,
          user_id: ADMIN_ID,
          organization_id: ORG_ID,
          data: {
            id: `p${String(globalIdx).padStart(3,'0')}`,
            adSoyad: `${ad} ${soyad}`,
            tc: tcUret(globalIdx),
            telefon: telUret(f, i),
            email: `${ad.toLowerCase()}.${soyad.toLowerCase()}@firma${f+1}.com.tr`,
            dogumTarihi: `${dogumYil}-${String(rastgeleInt(1,12)).padStart(2,'0')}-${String(rastgeleInt(1,28)).padStart(2,'0')}`,
            gorev,
            departman,
            iseGirisTarihi: `${yil}-${ay}-${gun}`,
            firmaId,
            durum: Math.random() > 0.9 ? 'Ayrıldı' : 'Aktif',
            kanGrubu: kan,
            acilKisi: rastgele(ADLAR) + ' ' + soyad,
            acilTelefon: telUret(f, i+100),
            adres: 'İstanbul, Türkiye',
            olusturmaTarihi: `${yil}-${ay}-${gun}T08:00:00Z`,
            guncellemeTarihi: '2024-01-01T00:00:00Z',
            silinmis: false
          },
          created_at: `${yil}-${ay}-${gun}T08:00:00Z`
        });
        globalIdx++;
      }
    }

    // Batch insert (50'şerli)
    for (let i = 0; i < personeller.length; i += 50) {
      const batch = personeller.slice(i, i + 50);
      const { error } = await supabase.from('personeller').insert(batch);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `${personeller.length} personel eklendi`,
      total: personeller.length 
    }), {
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