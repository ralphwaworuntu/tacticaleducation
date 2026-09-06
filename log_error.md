PS E:\TACKTICAL EDUCATION\backend> npm run dev

> backend@1.0.0 dev
> ts-node-dev --respawn --transpile-only src/server.ts

[INFO] 20:45:14 ts-node-dev ver. 2.0.0 (using ts-node ver. 10.9.2, typescript ver. 5.9.3)
[dotenv@17.2.3] injecting env (8) from .env -- tip: ⚙️  load multiple .env files with { path: ['.env.local', '.env'] }     
🚀 Tactical Education API is running on port 5000
GET /api/v1/landing/home - - ms - -
GET /api/v1/landing/contact-info - - ms - -
prisma:error 
Invalid `prisma.landingStat.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:65:24

  62 
  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([
→ 65     prisma.landingStat.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error 
Invalid `prisma.membershipPackage.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:66:30

  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
  65     prisma.landingStat.findMany(),
→ 66     prisma.membershipPackage.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.testimonial.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:67:24

  64 const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([
  65   prisma.landingStat.findMany(),
  66   prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
→ 67   prisma.testimonial.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.youtubeVideo.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:68:25

  65 prisma.landingStat.findMany(),
  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
→ 68 prisma.youtubeVideo.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.heroSlide.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:70:22

  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
→ 70 prisma.heroSlide.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:71:24

  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
  70 prisma.heroSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
→ 71 prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:109:45

  106 }
  107
  108 export async function getContactInfo() {
→ 109   const settings = await prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.landingStat.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:65:24

  62
  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
→ 65     prisma.landingStat.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.membershipPackage.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:66:30

  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
  65     prisma.landingStat.findMany(),
→ 66     prisma.membershipPackage.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.testimonial.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:67:24

  64 const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([
  65   prisma.landingStat.findMany(),
  66   prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
→ 67   prisma.testimonial.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.youtubeVideo.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:68:25

  65 prisma.landingStat.findMany(),
  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
→ 68 prisma.youtubeVideo.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.heroSlide.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:70:22

  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
→ 70 prisma.heroSlide.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:71:24

  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
  70 prisma.heroSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
→ 71 prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:109:45

  106 }
  107
  108 export async function getContactInfo() {
→ 109   const settings = await prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findUnique()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:69:24

  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
→ 69 prisma.siteSetting.findUnique(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findUnique()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:69:24

  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
→ 69 prisma.siteSetting.findUnique(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
GET /api/v1/landing/contact-info 500 3517.887 ms - -
GET /api/v1/landing/home 500 3519.445 ms - -
GET /api/v1/dashboard/exam-control 401 6.991 ms - -
GET /api/v1/dashboard/overview 401 0.429 ms - -
GET /api/v1/dashboard/welcome-modal 401 0.647 ms - -
prisma:error 
Invalid `prisma.refreshToken.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\auth\auth.service.ts:227:46

  224   sessionVersion: number;
  225 };
  226
→ 227 const tokens = await prisma.refreshToken.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error 
Invalid `prisma.refreshToken.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\auth\auth.service.ts:227:46

  224   sessionVersion: number;
  225 };
  226
→ 227 const tokens = await prisma.refreshToken.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.refreshToken.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\auth\auth.service.ts:227:46

  224   sessionVersion: number;
  225 };
  226
→ 227 const tokens = await prisma.refreshToken.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:109:45

  106 }
  107
  108 export async function getContactInfo() {
→ 109   const settings = await prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.landingStat.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:65:24

  62
  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
→ 65     prisma.landingStat.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.membershipPackage.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:66:30

  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
  65     prisma.landingStat.findMany(),
→ 66     prisma.membershipPackage.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.testimonial.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:67:24

  64 const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([
  65   prisma.landingStat.findMany(),
  66   prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
→ 67   prisma.testimonial.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.youtubeVideo.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:68:25

  65 prisma.landingStat.findMany(),
  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
→ 68 prisma.youtubeVideo.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.heroSlide.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:70:22

  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
→ 70 prisma.heroSlide.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:71:24

  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
  70 prisma.heroSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
→ 71 prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findUnique()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:69:24

  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
→ 69 prisma.siteSetting.findUnique(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
POST /api/v1/auth/refresh 401 4040.825 ms - 299
POST /api/v1/auth/refresh 401 4034.261 ms - 299
POST /api/v1/auth/refresh 401 4033.719 ms - 299
GET /api/v1/landing/home 500 552.981 ms - -
GET /api/v1/landing/contact-info 500 2443.573 ms - -
GET /api/v1/landing/profile 200 0.508 ms - 571
GET /api/v1/landing/contact-info - - ms - -
GET /api/v1/landing/home - - ms - -
prisma:error 
Invalid `prisma.landingStat.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:65:24

  62
  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
→ 65     prisma.landingStat.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error 
Invalid `prisma.membershipPackage.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:66:30

  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
  65     prisma.landingStat.findMany(),
→ 66     prisma.membershipPackage.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.testimonial.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:67:24

  64 const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([
  65   prisma.landingStat.findMany(),
  66   prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
→ 67   prisma.testimonial.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.youtubeVideo.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:68:25

  65 prisma.landingStat.findMany(),
  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
→ 68 prisma.youtubeVideo.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.heroSlide.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:70:22

  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
→ 70 prisma.heroSlide.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:71:24

  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
  70 prisma.heroSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
→ 71 prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:109:45

  106 }
  107
  108 export async function getContactInfo() {
→ 109   const settings = await prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.landingStat.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:65:24

  62
  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
→ 65     prisma.landingStat.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.membershipPackage.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:66:30

  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
  65     prisma.landingStat.findMany(),
→ 66     prisma.membershipPackage.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.testimonial.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:67:24

  64 const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([
  65   prisma.landingStat.findMany(),
  66   prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
→ 67   prisma.testimonial.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.youtubeVideo.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:68:25

  65 prisma.landingStat.findMany(),
  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
→ 68 prisma.youtubeVideo.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.heroSlide.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:70:22

  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
→ 70 prisma.heroSlide.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:71:24

  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
  70 prisma.heroSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
→ 71 prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:109:45

  106 }
  107
  108 export async function getContactInfo() {
→ 109   const settings = await prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findUnique()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:69:24

  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
→ 69 prisma.siteSetting.findUnique(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findUnique()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:69:24

  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
→ 69 prisma.siteSetting.findUnique(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
GET /api/v1/landing/contact-info 500 1314.328 ms - -
GET /api/v1/landing/home 500 1315.335 ms - -
prisma:error 
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:109:45

  106 }
  107
  108 export async function getContactInfo() {
→ 109   const settings = await prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error 
Invalid `prisma.landingStat.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:65:24

  62
  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
→ 65     prisma.landingStat.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.membershipPackage.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:66:30

  63 export async function getHomeContent(baseUrl?: string) {
  64   const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([       
  65     prisma.landingStat.findMany(),
→ 66     prisma.membershipPackage.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.testimonial.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:67:24

  64 const [stats, packages, testimonials, videos, heroSetting, heroSlides, contactSettings] = await Promise.all([
  65   prisma.landingStat.findMany(),
  66   prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
→ 67   prisma.testimonial.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.youtubeVideo.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:68:25

  65 prisma.landingStat.findMany(),
  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
→ 68 prisma.youtubeVideo.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.heroSlide.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:70:22

  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
→ 70 prisma.heroSlide.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findMany()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:71:24

  68 prisma.youtubeVideo.findMany({ take: 6 }),
  69 prisma.siteSetting.findUnique({ where: { key: 'hero_image' } }),
  70 prisma.heroSlide.findMany({ orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }),
→ 71 prisma.siteSetting.findMany(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
prisma:error
Invalid `prisma.siteSetting.findUnique()` invocation in
E:\TACKTICAL EDUCATION\backend\src\modules\content\content.service.ts:69:24

  66 prisma.membershipPackage.findMany({ where: { isActive: true }, take: 6 }),
  67 prisma.testimonial.findMany({ take: 6 }),
  68 prisma.youtubeVideo.findMany({ take: 6 }),
→ 69 prisma.siteSetting.findUnique(
Can't reach database server at `localhost:3306`

Please make sure your database server is running at `localhost:3306`.
GET /api/v1/landing/contact-info 500 4053.791 ms - -
GET /api/v1/landing/home 500 4053.645 ms - -