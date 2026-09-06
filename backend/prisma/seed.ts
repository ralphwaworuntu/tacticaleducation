import { CalculatorType, MaterialType, Prisma, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function seedUsers() {
  const adminPassword = await hashPassword('Admin@123');
  const developerPassword = await hashPassword('Developer@123');
  const memberPassword = await hashPassword('Member@123');

  const admin = await prisma.user.upsert({
    where: { email: 'admin@tacticaleducation.id' },
    update: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerifiedAt: new Date(),
    },
    create: {
      name: 'Super Admin',
      email: 'admin@tacticaleducation.id',
      passwordHash: adminPassword,
      role: 'ADMIN',
      referralCode: 'TACTADMIN',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  const member = await prisma.user.upsert({
    where: { email: 'member@tacticaleducation.id' },
    update: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerifiedAt: new Date(),
    },
    create: {
      name: 'Member Demo',
      email: 'member@tacticaleducation.id',
      passwordHash: memberPassword,
      role: 'MEMBER',
      referralCode: 'TACT1234',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.user.upsert({
    where: { email: 'developer@tacticaleducation.id' },
    update: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerifiedAt: new Date(),
      role: 'ADMIN',
    },
    create: {
      name: 'Developer Admin',
      email: 'developer@tacticaleducation.id',
      passwordHash: developerPassword,
      role: 'ADMIN',
      referralCode: 'TACTDEV01',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.memberArea.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, slug: 'area-admin' },
  });

  await prisma.memberArea.upsert({
    where: { userId: member.id },
    update: {},
    create: { userId: member.id, slug: 'area-member' },
  });
}

export async function seedPremiumMember() {
  const passwordHash = await hashPassword('Premium@123');

  const user = await prisma.user.upsert({
    where: { email: 'premium@tacticaleducation.id' },
    update: {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerifiedAt: new Date(),
    },
    create: {
      name: 'Member Premium',
      email: 'premium@tacticaleducation.id',
      passwordHash,
      role: 'MEMBER',
      referralCode: 'TACTPREMIUM',
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.memberArea.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, slug: 'area-premium' },
  });

  const packages = await prisma.membershipPackage.findMany({
    where: { isActive: true },
    orderBy: { durationDays: 'desc' },
  });

  if (!packages.length) {
    return;
  }

  const addons = await prisma.addonPackage.findMany({ where: { isActive: true } });
  const activatedAt = new Date();
  const primaryPackage = packages.find((pkg) => pkg.accessAllPackages) ?? packages[0]!;
  let primaryMembershipId: string | null = null;
  let bonusTryout = 0;
  let bonusModule = 0;

  for (const pkg of packages) {
    const expiresAt = new Date(activatedAt);
    expiresAt.setDate(expiresAt.getDate() + pkg.durationDays);
    const isPrimary = pkg.id === primaryPackage.id;
    if (isPrimary) {
      expiresAt.setDate(expiresAt.getDate() + 365);
    }

    const code = `SEED-PREMIUM-${pkg.slug.toUpperCase().replace(/-/g, '_')}`;
    const membership = await prisma.transaction.upsert({
      where: { code },
      update: {
        userId: user.id,
        packageId: pkg.id,
        amount: pkg.price,
        method: 'SEED',
        type: 'MEMBERSHIP',
        status: 'PAID',
        activatedAt,
        expiresAt,
        tryoutQuota: pkg.tryoutQuota,
        tryoutUsed: 0,
        moduleQuota: pkg.moduleQuota,
        moduleUsed: 0,
        description: 'Membership premium seed',
      },
      create: {
        code,
        userId: user.id,
        packageId: pkg.id,
        amount: pkg.price,
        method: 'SEED',
        type: 'MEMBERSHIP',
        status: 'PAID',
        activatedAt,
        expiresAt,
        tryoutQuota: pkg.tryoutQuota,
        tryoutUsed: 0,
        moduleQuota: pkg.moduleQuota,
        moduleUsed: 0,
        description: 'Membership premium seed',
      },
    });

    if (isPrimary) {
      primaryMembershipId = membership.id;
    }
  }

  if (!primaryMembershipId) {
    return;
  }

  const primaryMembership = await prisma.transaction.findUnique({
    where: { id: primaryMembershipId },
    select: { expiresAt: true, tryoutQuota: true, moduleQuota: true },
  });

  if (!primaryMembership) {
    return;
  }

  for (const addon of addons) {
    bonusTryout += addon.tryoutBonus;
    bonusModule += addon.moduleBonus;

    const code = `SEED-PREMIUM-ADDON-${addon.slug.toUpperCase().replace(/-/g, '_')}`;
    await prisma.transaction.upsert({
      where: { code },
      update: {
        userId: user.id,
        packageId: primaryPackage.id,
        addonId: addon.id,
        targetTransactionId: primaryMembershipId,
        amount: addon.price,
        method: 'SEED',
        type: 'ADDON',
        status: 'PAID',
        activatedAt,
        expiresAt: primaryMembership.expiresAt,
        description: 'Addon premium seed',
      },
      create: {
        code,
        userId: user.id,
        packageId: primaryPackage.id,
        addonId: addon.id,
        targetTransactionId: primaryMembershipId,
        amount: addon.price,
        method: 'SEED',
        type: 'ADDON',
        status: 'PAID',
        activatedAt,
        expiresAt: primaryMembership.expiresAt,
        description: 'Addon premium seed',
      },
    });
  }

  await prisma.transaction.update({
    where: { id: primaryMembershipId },
    data: {
      tryoutQuota: primaryPackage.tryoutQuota + bonusTryout,
      moduleQuota: primaryPackage.moduleQuota + bonusModule,
    },
  });
}

async function seedLandingContent() {
  await prisma.landingStat.deleteMany();
  await prisma.landingStat.createMany({
    data: [
      { label: 'Materi Video', value: 1200 },
      { label: 'Soal Try Out', value: 4500 },
      { label: 'Jumlah Alumni', value: 724 },
      { label: 'Modul Interaktif', value: 35 },
    ],
  });

  await prisma.testimonial.deleteMany();
  await prisma.testimonial.createMany({
    data: [
      {
        name: 'Casis AKPOL 2024',
        message: 'Berhasil lolos berkat pembahasan detail Tactical Education! Mentornya suportif banget.',
        role: 'AKPOL',
      },
      {
        name: 'Bintara TNI 2024',
        message: 'Latihan fisik & psikotesnya terintegrasi, bikin percaya diri pas seleksi.',
        role: 'TNI',
      },
    ],
  });

  await prisma.youtubeVideo.deleteMany();
  await prisma.youtubeVideo.createMany({
    data: [
      {
        title: 'Strategi Lolos Tes Psikologi POLRI',
        embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        description: 'Tips & trik menghadapi psikotes.',
      },
      {
        title: 'Latihan CAT AKMIL',
        embedUrl: 'https://www.youtube.com/embed/oHg5SJYRHA0',
      },
    ],
  });

  await prisma.galleryItem.deleteMany();
  await prisma.galleryItem.createMany({
    data: [
      {
        title: 'Alumni Lolos POLRI',
        imageUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1',
        kind: 'ALUMNI',
      },
      {
        title: 'Bootcamp Intensif',
        imageUrl: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d',
        kind: 'AKTIVITAS',
      },
    ],
  });

  await prisma.announcement.deleteMany();
  await prisma.announcement.createMany({
    data: [
      {
        title: 'Tryout Nasional POLRI Dibuka',
        body: 'Segera daftar dan manfaatkan diskon early bird.',
      },
      {
        title: 'Live Class Psikotes Mingguan',
        body: 'Khusus member Gold ke atas.',
      },
    ],
  });

  await prisma.faq.deleteMany();
  await prisma.faq.createMany({
    data: [
      {
        question: 'Bagaimana sistem pembelajarannya?',
        answer: 'Menggunakan kombinasi video, live class, dan dashboard latihan.',
        order: 1,
      },
      {
        question: 'Apakah ada pendampingan offline?',
        answer: 'Tersedia bootcamp intensif sesuai jadwal tertentu.',
        order: 2,
      },
    ],
  });

  await prisma.newsArticle.deleteMany();
  await prisma.newsArticle.createMany({
    data: [
      {
        title: 'Tren Seleksi POLRI 2025',
        slug: 'tren-seleksi-polri-2025',
        excerpt: 'Kisi terbaru menunjukkan penguatan daya tahan fisik dan psikologi.',
        content: 'Konten lengkap mengenai strategi terbaru seleksi POLRI.',
        kind: 'NEWS',
      },
      {
        title: 'Insight Psikotes POLRI',
        slug: 'insight-psikotes-polri',
        excerpt: 'Cara membaca pola soal psikotes terbaru.',
        content: 'Insight mendalam terkait psikotes POLRI.',
        kind: 'INSIGHT',
      },
    ],
  });
}

async function seedHeroSlides() {
  await prisma.heroSlide.deleteMany();
  await prisma.heroSlide.createMany({
    data: [
      { imageUrl: '/Alumni.png', order: 0 },
      { imageUrl: '/1.png', order: 1 },
      { imageUrl: '/2.png', order: 2 },
    ],
  });
}

async function seedMemberOverviewSlides() {
  await prisma.memberOverviewSlide.deleteMany();
  await prisma.memberOverviewSlide.createMany({
    data: [
      {
        title: 'Pantau progres tryout real-time',
        subtitle: 'Setiap poin otomatis tersimpan dan dianalisis.',
        imageUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61',
        ctaLabel: 'Lihat riwayat',
        ctaLink: '/app/latihan/tryout/riwayat',
        order: 0,
      },
      {
        title: 'Latihan soal fleksibel',
        subtitle: 'Dashboard mengingat soal terakhir dan rekomendasi berikutnya.',
        imageUrl: 'https://images.unsplash.com/photo-1545239351-1141bd82e8a6',
        ctaLabel: 'Ke latihan soal',
        ctaLink: '/app/latihan-soal',
        order: 1,
      },
    ],
  });
}

type WeightedFieldConfig = {
  key: string;
  label: string;
  weight: number;
  unit?: string;
  placeholder?: string;
};

type CalculatorSeedItem = {
  slug: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  section?: string | null;
  sectionLabel?: string | null;
  order: number;
  sectionOrder: number;
  config: Record<string, unknown>;
};

function createWeightedConfig(fields: WeightedFieldConfig[], resultLabel: string) {
  return {
    formula: 'weighted',
    resultLabel,
    inputs: fields.map(({ weight, ...field }) => ({ type: 'number', ...field })),
    groups: fields.map((field) => ({
      key: field.key,
      label: field.label,
      weight: field.weight,
      aggregator: 'sum',
      inputs: [field.key],
    })),
  } satisfies Record<string, unknown>;
}

function createJasmaniPolriConfig() {
  return {
    formula: 'grouped',
    resultLabel: 'Nilai Jasmani POLRI',
    inputs: [
      { key: 'gender', label: 'Jenis Kelamin', type: 'select', options: [{ label: 'Pria', value: 'male' }, { label: 'Wanita', value: 'female' }] },
      { key: 'lari12', label: 'Jarak Lari 12 Menit (meter)', type: 'number', unit: 'meter' },
      { key: 'pullUp', label: 'Pull Up (1 menit)', type: 'number', unit: 'repetisi' },
      { key: 'sitUp', label: 'Sit Up (1 menit)', type: 'number', unit: 'repetisi' },
      { key: 'pushUp', label: 'Push Up (1 menit)', type: 'number', unit: 'repetisi' },
      { key: 'shuttleRun', label: 'Shuttle Run', type: 'number', unit: 'detik' },
      { key: 'swim', label: 'Renang', type: 'number', unit: 'detik' },
    ],
    groups: [
      {
        key: 'ukj',
        label: 'Nilai UKJ (Lari + Pull Up + Sit Up + Push Up + Shuttle Run)',
        weight: 0.8,
        aggregator: 'sum',
        inputs: ['lari12', 'pullUp', 'sitUp', 'pushUp', 'shuttleRun'],
      },
      {
        key: 'renang',
        label: 'Nilai Renang',
        weight: 0.2,
        aggregator: 'sum',
        inputs: ['swim'],
      },
    ],
  } satisfies Record<string, unknown>;
}

function createJasmaniTniConfig() {
  const higherBetterRows = [
    { value: 3200, score: 100 },
    { value: 3000, score: 95 },
    { value: 2800, score: 90 },
    { value: 2600, score: 85 },
    { value: 2400, score: 80 },
    { value: 2200, score: 75 },
    { value: 2000, score: 70 },
  ];
  const repRows = [
    { value: 20, score: 100 },
    { value: 18, score: 95 },
    { value: 16, score: 90 },
    { value: 14, score: 85 },
    { value: 12, score: 80 },
    { value: 10, score: 75 },
    { value: 8, score: 70 },
  ];
  const shuttleRows = [
    { value: 13.0, score: 100 },
    { value: 13.5, score: 95 },
    { value: 14.0, score: 90 },
    { value: 14.5, score: 85 },
    { value: 15.0, score: 80 },
    { value: 15.5, score: 75 },
    { value: 16.0, score: 70 },
  ];

  return {
    formula: 'tni',
    resultLabel: 'Nilai Jasmani TNI',
    inputs: [
      { key: 'gender', label: 'Jenis Kelamin', type: 'select', options: [{ label: 'Pria', value: 'male' }, { label: 'Wanita', value: 'female' }] },
      { key: 'age', label: 'Usia', type: 'number', unit: 'tahun' },
      { key: 'height', label: 'Tinggi Badan', type: 'number', unit: 'cm' },
      { key: 'weight', label: 'Berat Badan', type: 'number', unit: 'kg' },
      { key: 'a12', label: 'Garjas A - Lari 12 Menit (meter)', type: 'number', unit: 'meter' },
      { key: 'b1', label: 'Garjas B1 - Pull Up (1 menit)', type: 'number', unit: 'repetisi' },
      { key: 'b2', label: 'Garjas B2 - Sit Up (1 menit)', type: 'number', unit: 'repetisi' },
      { key: 'b3', label: 'Garjas B3 - Lunges', type: 'number', unit: 'repetisi' },
      { key: 'b4', label: 'Garjas B4 - Push Up (1 menit)', type: 'number', unit: 'repetisi' },
      { key: 'b5', label: 'Garjas B5 - Shuttle Run (detik)', type: 'number', unit: 'detik' },
    ],
    groups: [
      { key: 'garjasA', label: 'Nilai Garjas A', weight: 0.5, aggregator: 'sum', inputs: ['a12'] },
      { key: 'garjasB', label: 'Nilai Garjas B', weight: 0.5, aggregator: 'average', inputs: ['b1', 'b2', 'b3', 'b4', 'b5'] },
    ],
    thresholds: [
      { inputKey: 'a12', comparison: 'HIGHER_BETTER', rows: higherBetterRows },
      { inputKey: 'b1', comparison: 'HIGHER_BETTER', rows: repRows },
      { inputKey: 'b2', comparison: 'HIGHER_BETTER', rows: repRows },
      { inputKey: 'b3', comparison: 'HIGHER_BETTER', rows: repRows },
      { inputKey: 'b4', comparison: 'HIGHER_BETTER', rows: repRows },
      { inputKey: 'b5', comparison: 'LOWER_BETTER', rows: shuttleRows },
    ],
    extras: {
      bmiCategories: [
        { min: 0, max: 18.4, label: 'LLA' },
        { min: 18.5, max: 22.9, label: 'LA' },
        { min: 23, max: 27.4, label: 'LB' },
        { min: 27.5, max: 99, label: 'LLB' },
      ],
    },
  } satisfies Record<string, unknown>;
}

async function seedCalculators() {
  const calculators: CalculatorSeedItem[] = [
    {
      slug: 'hasil-tes-polri-nilai-akademik-bintara-ptu',
      title: 'Nilai Akademik - Bintara PTU',
      description: 'Hitung komponen nilai akademik Bintara PTU dengan bobot terbaru.',
      category: 'hasil-tes-polri',
      categoryLabel: 'Kalkulator Hasil Tes Polri',
      section: 'nilai-akademik',
      sectionLabel: 'Hitungan Nilai Akademik',
      order: 0,
      sectionOrder: 0,
      config: createWeightedConfig(
        [
          { key: 'pengetahuanUmum', label: 'Nilai Pengetahuan Umum', weight: 0.3 },
          { key: 'wawasanKebangsaan', label: 'Nilai Wawasan Kebangsaan', weight: 0.4 },
          { key: 'penalaranNumerik', label: 'Nilai Penalaran Numerik', weight: 0.15 },
          { key: 'bahasaInggris', label: 'Nilai Bahasa Inggris', weight: 0.15 },
        ],
        'Nilai Akademik',
      ),
    },
    {
      slug: 'hasil-tes-polri-nilai-akademik-bintara-kompetensi-khusus',
      title: 'Nilai Akademik - Bintara Kompetensi Khusus',
      description: 'Perhitungan nilai pengetahuan, keterampilan, dan perilaku.',
      category: 'hasil-tes-polri',
      categoryLabel: 'Kalkulator Hasil Tes Polri',
      section: 'nilai-akademik',
      sectionLabel: 'Hitungan Nilai Akademik',
      order: 1,
      sectionOrder: 0,
      config: createWeightedConfig(
        [
          { key: 'pengetahuan', label: 'Nilai Pengetahuan', weight: 0.3 },
          { key: 'keterampilan', label: 'Nilai Keterampilan', weight: 0.3 },
          { key: 'perilaku', label: 'Nilai Perilaku', weight: 0.4 },
        ],
        'Nilai Akademik',
      ),
    },
    {
      slug: 'hasil-tes-polri-nilai-akademik-tamtama',
      title: 'Nilai Akademik - Tamtama',
      description: 'Perhitungan nilai akademik Tamtama POLRI.',
      category: 'hasil-tes-polri',
      categoryLabel: 'Kalkulator Hasil Tes Polri',
      section: 'nilai-akademik',
      sectionLabel: 'Hitungan Nilai Akademik',
      order: 2,
      sectionOrder: 0,
      config: createWeightedConfig(
        [
          { key: 'pengetahuanUmum', label: 'Nilai Pengetahuan Umum', weight: 0.3 },
          { key: 'wawasanKebangsaan', label: 'Nilai Wawasan Kebangsaan', weight: 0.4 },
          { key: 'penalaranNumerik', label: 'Nilai Penalaran Numerik', weight: 0.15 },
          { key: 'bahasaInggris', label: 'Nilai Bahasa Inggris', weight: 0.15 },
        ],
        'Nilai Akademik',
      ),
    },
    {
      slug: 'hasil-tes-polri-menuju-rikes-ii-bintara-ptu',
      title: 'Nilai Menuju Rikes II - Bintara PTU',
      description: 'Gabungkan nilai akademik dan psikologi sebelum rikes II.',
      category: 'hasil-tes-polri',
      categoryLabel: 'Kalkulator Hasil Tes Polri',
      section: 'menuju-rikes-ii',
      sectionLabel: 'Hitungan Nilai Menuju Rikes II',
      order: 0,
      sectionOrder: 1,
      config: createWeightedConfig(
        [
          { key: 'nilaiAkademik', label: 'Nilai Akademik', weight: 0.45 },
          { key: 'nilaiPsikologi', label: 'Nilai Psikologi', weight: 0.55 },
        ],
        'Nilai Menuju Rikes II',
      ),
    },
    {
      slug: 'hasil-tes-polri-menuju-rikes-ii-tamtama',
      title: 'Nilai Menuju Rikes II - Tamtama',
      description: 'Perhitungan pra-rikes II untuk Tamtama.',
      category: 'hasil-tes-polri',
      categoryLabel: 'Kalkulator Hasil Tes Polri',
      section: 'menuju-rikes-ii',
      sectionLabel: 'Hitungan Nilai Menuju Rikes II',
      order: 1,
      sectionOrder: 1,
      config: createWeightedConfig(
        [
          { key: 'nilaiAkademik', label: 'Nilai Akademik', weight: 0.6 },
          { key: 'nilaiPsikologi', label: 'Nilai Psikologi', weight: 0.4 },
        ],
        'Nilai Menuju Rikes II',
      ),
    },
    {
      slug: 'hasil-tes-polri-nilai-akhir-bintara-ptu',
      title: 'Nilai Akhir - Bintara PTU',
      description: 'Akumulasi nilai akademik, psikologi, dan jasmani.',
      category: 'hasil-tes-polri',
      categoryLabel: 'Kalkulator Hasil Tes Polri',
      section: 'nilai-akhir',
      sectionLabel: 'Hitungan Nilai Akhir',
      order: 0,
      sectionOrder: 2,
      config: createWeightedConfig(
        [
          { key: 'nilaiAkademik', label: 'Nilai Akademik', weight: 0.35 },
          { key: 'nilaiPsikologi', label: 'Nilai Psikologi', weight: 0.4 },
          { key: 'nilaiJasmani', label: 'Nilai Jasmani', weight: 0.25 },
        ],
        'Nilai Akhir',
      ),
    },
    {
      slug: 'hasil-tes-polri-nilai-akhir-bintara-kompetensi-khusus',
      title: 'Nilai Akhir - Bintara Kompetensi Khusus',
      description: 'Kombinasi nilai keahlian, psikologi, dan jasmani.',
      category: 'hasil-tes-polri',
      categoryLabel: 'Kalkulator Hasil Tes Polri',
      section: 'nilai-akhir',
      sectionLabel: 'Hitungan Nilai Akhir',
      order: 1,
      sectionOrder: 2,
      config: createWeightedConfig(
        [
          { key: 'nilaiKeahlian', label: 'Nilai Keahlian', weight: 0.45 },
          { key: 'nilaiPsikologi', label: 'Nilai Psikologi', weight: 0.35 },
          { key: 'nilaiJasmani', label: 'Nilai Jasmani', weight: 0.2 },
        ],
        'Nilai Akhir',
      ),
    },
    {
      slug: 'hasil-tes-polri-nilai-akhir-tamtama',
      title: 'Nilai Akhir - Tamtama',
      description: 'Perhitungan nilai akhir seleksi Tamtama.',
      category: 'hasil-tes-polri',
      categoryLabel: 'Kalkulator Hasil Tes Polri',
      section: 'nilai-akhir',
      sectionLabel: 'Hitungan Nilai Akhir',
      order: 2,
      sectionOrder: 2,
      config: createWeightedConfig(
        [
          { key: 'nilaiAkademik', label: 'Nilai Akademik', weight: 0.25 },
          { key: 'nilaiPsikologi', label: 'Nilai Psikologi', weight: 0.35 },
          { key: 'nilaiJasmani', label: 'Nilai Jasmani', weight: 0.4 },
        ],
        'Nilai Akhir',
      ),
    },
    {
      slug: 'jasmani-polri',
      title: 'Kalkulator Jasmani POLRI',
      description: 'Hitung Nilai UKJ dan Renang dengan bobot 80/20.',
      category: 'jasmani-polri',
      categoryLabel: 'Kalkulator Jasmani Polri',
      section: null,
      sectionLabel: null,
      order: 0,
      sectionOrder: 0,
      config: createJasmaniPolriConfig(),
    },
    {
      slug: 'jasmani-tni',
      title: 'Kalkulator Jasmani TNI',
      description: 'Konversi nilai Garjas A dan B lengkap dengan BMI.',
      category: 'jasmani-tni',
      categoryLabel: 'Kalkulator Jasmani TNI',
      section: null,
      sectionLabel: null,
      order: 0,
      sectionOrder: 0,
      config: createJasmaniTniConfig(),
    },
  ];

  for (const calculator of calculators) {
    await prisma.psychCalculatorTemplate.upsert({
      where: { slug: calculator.slug },
      update: {
        title: calculator.title,
        description: calculator.description,
        type: CalculatorType.GENERAL,
        config: calculator.config as Prisma.InputJsonValue,
        category: calculator.category,
        categoryLabel: calculator.categoryLabel,
        section: calculator.section ?? null,
        sectionLabel: calculator.sectionLabel ?? null,
        order: calculator.order,
        sectionOrder: calculator.sectionOrder,
      },
      create: {
        title: calculator.title,
        slug: calculator.slug,
        description: calculator.description,
        type: CalculatorType.GENERAL,
        config: calculator.config as Prisma.InputJsonValue,
        category: calculator.category,
        categoryLabel: calculator.categoryLabel,
        section: calculator.section ?? null,
        sectionLabel: calculator.sectionLabel ?? null,
        order: calculator.order,
        sectionOrder: calculator.sectionOrder,
      },
    });
  }
}

async function seedSiteContact() {
  await prisma.siteSetting.upsert({
    where: { key: 'company_email' },
    update: { value: 'hallo@tacticaleducation.id' },
    create: { key: 'company_email', value: 'hallo@tacticaleducation.id' },
  });

  await prisma.siteSetting.upsert({
    where: { key: 'whatsapp_primary' },
    update: { value: '6281234567890' },
    create: { key: 'whatsapp_primary', value: '6281234567890' },
  });

  await prisma.siteSetting.upsert({
    where: { key: 'whatsapp_consult' },
    update: { value: '628111223344' },
    create: { key: 'whatsapp_consult', value: '628111223344' },
  });
}

async function seedMaterials() {
  await prisma.material.deleteMany();
  const data: Array<Omit<Parameters<typeof prisma.material.create>[0]['data'], 'uploadedById'>> = [
    {
      title: 'Modul Strategi Tes POLRI',
      category: 'POLRI',
      type: 'PDF' satisfies MaterialType,
      description: 'Panduan belajar lengkap untuk menghadapi tes POLRI.',
      fileUrl: '/dummy-modul.pdf',
    },
    {
      title: 'Bank Soal TKP POLRI',
      category: 'POLRI',
      type: 'PDF' satisfies MaterialType,
      description: 'Ratusan soal TKP beserta pembahasan.',
      fileUrl: '/dummy-tkp.pdf',
    },
    {
      title: 'Samapta Handbook TNI',
      category: 'TNI',
      type: 'PDF' satisfies MaterialType,
      description: 'Tips latihan fisik & samapta AKMIL/Bintara.',
      fileUrl: '/dummy-samapta.pdf',
    },
    {
      title: 'Video Psikotes TNI',
      category: 'TNI',
      type: 'VIDEO' satisfies MaterialType,
      description: 'Pembahasan pola soal psikotes TNI terkini.',
      fileUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    },
  ];

  const materials = [] as Array<{ id: string }>;
  for (const item of data) {
    const record = await prisma.material.create({ data: item });
    materials.push(record);
  }
  return materials;
}

async function seedPackages(materials: Array<{ id: string }>) {
  await prisma.packageMaterial.deleteMany();
  const packages = [
    {
      name: 'Silver Membership',
      slug: 'silver-membership',
      category: 'POLRI',
      tagline: 'Akses dasar latihan soal',
      description: 'Akses modul dasar, 10 tryout, grup komunitas.',
      price: 499000,
      durationDays: 90,
      tryoutQuota: 10,
      moduleQuota: 10,
      features: ['10 Tryout', 'Modul PDF', 'Group Mentorship'],
    },
    {
      name: 'Gold Membership',
      slug: 'gold-membership',
      category: 'TNI',
      tagline: 'Pendampingan penuh',
      description: 'Semua modul + live class + psikotes.',
      price: 999000,
      durationDays: 180,
      tryoutQuota: 20,
      moduleQuota: 20,
      features: ['20 Tryout', 'Live Class', 'Psikotest'],
      badgeLabel: 'Populer',
    },
    {
      name: 'Premium All Access',
      slug: 'premium-all-access',
      category: 'ALL',
      tagline: 'Akses semua paket & multi perangkat',
      description: 'Akses penuh semua fitur, tryout, modul, dan login di banyak perangkat sekaligus.',
      price: 1499000,
      durationDays: 365,
      tryoutQuota: 0,
      moduleQuota: 0,
      features: ['Semua Paket', 'Multi Perangkat', 'Tryout Unlimited'],
      badgeLabel: 'Premium',
      accessAllPackages: true,
    },
  ];

  const membershipRecords = await Promise.all(
    packages.map((pkg) =>
      prisma.membershipPackage.upsert({
        where: { slug: pkg.slug },
        update: pkg,
        create: pkg,
      }),
    ),
  );

  const silver = membershipRecords[0]!;
  const gold = membershipRecords[1]!;
  const premium = membershipRecords[2]!;

  const silverMaterials = materials.slice(0, 2).map((mat) => ({ packageId: silver.id, materialId: mat.id }));
  const goldMaterials = materials.map((mat) => ({ packageId: gold.id, materialId: mat.id }));
  const premiumMaterials = materials.map((mat) => ({ packageId: premium.id, materialId: mat.id }));

  await prisma.packageMaterial.createMany({ data: [...silverMaterials, ...goldMaterials, ...premiumMaterials] });
}

async function seedAddons(materials: Array<{ id: string }>) {
  await prisma.addonPackageMaterial.deleteMany();
  await prisma.addonPackage.deleteMany();

  const addons = await prisma.addonPackage.createMany({
    data: [
      {
        name: 'Tryout Booster +5',
        slug: 'addon-tryout-plus-5',
        description: 'Tambah 5 kuota tryout aktif.',
        price: 199000,
        tryoutBonus: 5,
        moduleBonus: 0,
      },
      {
        name: 'Modul Premium TNI',
        slug: 'addon-modul-premium-tni',
        description: 'Buka akses modul premium fisik & mental.',
        price: 249000,
        tryoutBonus: 0,
        moduleBonus: 5,
      },
    ],
  });

  const addonRecords = await prisma.addonPackage.findMany();
  const premiumAddon = addonRecords.find((addon) => addon.slug === 'addon-modul-premium-tni');
  if (premiumAddon) {
    const extraMaterials = materials.slice(-2).map((mat) => ({ addonId: premiumAddon.id, materialId: mat.id }));
    if (extraMaterials.length) {
      await prisma.addonPackageMaterial.createMany({ data: extraMaterials });
    }
  }
}

async function seedTryouts() {
  await prisma.tryoutAnswer.deleteMany();
  await prisma.tryoutResult.deleteMany();
  await prisma.tryoutOption.deleteMany();
  await prisma.tryoutQuestion.deleteMany();
  await prisma.tryout.deleteMany();
  await prisma.tryoutSubCategory.deleteMany();
  await prisma.tryoutCategory.deleteMany();

  const category = await prisma.tryoutCategory.create({
    data: {
      name: 'Tes Masuk POLRI',
      slug: 'tes-masuk-polri',
    },
  });

  const subCategory = await prisma.tryoutSubCategory.create({
    data: {
      name: 'AKPOL Dasar',
      slug: 'akpol-dasar',
      categoryId: category.id,
    },
  });

  const now = new Date();
  const openAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const closeAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const tryout = await prisma.tryout.create({
    data: {
      name: 'Tryout AKPOL Fundamental',
      slug: 'tryout-akpol-fundamental',
      summary: 'Simulasi AKPOL 100 soal dengan timer 90 menit.',
      description: 'Paket tryout dengan pembahasan detail untuk AKPOL.',
      durationMinutes: 90,
      totalQuestions: 5,
      subCategoryId: subCategory.id,
      openAt,
      closeAt,
    },
  });

  for (let i = 0; i < 5; i += 1) {
    const a = i + 2;
    const b = i + 3;
    const correct = a + b;
    const withImage = i < 2;
    await prisma.tryoutQuestion.create({
      data: {
        prompt: `Soal numerik ${i + 1}: hitung ${a} + ${b}`,
        imageUrl: withImage ? 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d' : null,
        explanation: 'Jumlahkan kedua bilangan untuk mendapatkan hasil.',
        order: i + 1,
        tryoutId: tryout.id,
        options: {
          create: [
            {
              label: String(correct),
              isCorrect: true,
              imageUrl: withImage ? 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61' : null,
            },
            { label: String(correct + 1), imageUrl: withImage ? 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b' : null },
            { label: String(correct - 1), imageUrl: withImage ? 'https://images.unsplash.com/photo-1519389950473-47ba0277781c' : null },
            { label: String(correct + 2), imageUrl: withImage ? 'https://images.unsplash.com/photo-1498050108023-c5249f4df085' : null },
          ],
        },
      },
    });
  }
}

async function seedPractice() {
  await prisma.practiceAnswer.deleteMany();
  await prisma.practiceResult.deleteMany();
  await prisma.practiceOption.deleteMany();
  await prisma.practiceQuestion.deleteMany();
  await prisma.practiceSet.deleteMany();
  await prisma.practiceSubSubCategory.deleteMany();
  await prisma.practiceSubCategory.deleteMany();
  await prisma.practiceCategory.deleteMany();

  const category = await prisma.practiceCategory.create({
    data: { name: 'POLRI', slug: 'polri' },
  });

  const subCategory = await prisma.practiceSubCategory.create({
    data: { name: 'Tes Akademik', slug: 'tes-akademik', categoryId: category.id },
  });

  const subSubCategory = await prisma.practiceSubSubCategory.create({
    data: { name: 'Matematika Dasar', slug: 'matematika-dasar', subCategoryId: subCategory.id },
  });

  const now = new Date();
  const openAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const closeAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const set = await prisma.practiceSet.create({
    data: {
      title: 'Latihan Matematika Dasar',
      slug: 'latihan-matematika-dasar',
      description: 'Berisi soal operasi hitung dasar.',
      level: 'Beginner',
      durationMinutes: 30,
      totalQuestions: 5,
      openAt,
      closeAt,
      subSubCategoryId: subSubCategory.id,
    },
  });

  for (let idx = 0; idx < 5; idx += 1) {
    const value = idx + 5;
    const correct = value * 2;
    const withImage = idx < 2;
    const question = await prisma.practiceQuestion.create({
      data: {
        prompt: `Hitung ${value} x 2`,
        imageUrl: withImage ? 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee' : null,
        order: idx + 1,
        setId: set.id,
      },
    });
    await prisma.practiceOption.createMany({
      data: [
        {
          questionId: question.id,
          label: `${correct}`,
          isCorrect: true,
          imageUrl: withImage ? 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee' : null,
        },
        { questionId: question.id, label: `${correct + 1}`, imageUrl: withImage ? 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d' : null },
        { questionId: question.id, label: `${correct - 1}`, imageUrl: withImage ? 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61' : null },
        { questionId: question.id, label: `${correct + 2}`, imageUrl: withImage ? 'https://images.unsplash.com/photo-1498050108023-c5249f4df085' : null },
      ],
    });
  }
}

async function main() {
  await seedUsers();
  await seedLandingContent();
  await seedHeroSlides();
  await seedMemberOverviewSlides();
  const materials = await seedMaterials();
  await seedPackages(materials);
  await seedAddons(materials);
  await seedTryouts();
  await seedPractice();
  await seedCalculators();
  await prisma.paymentSetting.deleteMany();
  await prisma.paymentSetting.create({
    data: {
      bankName: 'BCA',
      accountNumber: '1234567890',
      accountHolder: 'TACTICAL EDUCATION',
    },
  });

  await prisma.siteSetting.upsert({
    where: { key: 'hero_image' },
    update: { value: '/Alumni.png' },
    create: { key: 'hero_image', value: '/Alumni.png' },
  });

  await seedSiteContact();
  await seedPremiumMember();
}

if (require.main === module) {
  main()
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
