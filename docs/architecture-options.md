# Timeline Voice Notifier - Design And Tech Stack Options

## 1. Muc tieu san pham

Ung dung web cho phep nguoi dung tao mot kich ban gom nhieu moc thoi gian va phat thong bao bang am thanh khi den tung moc.

## 2. Pham vi tinh nang can ho tro

### 2.1 Tao kich ban event

- Tao nhieu moc thoi gian trong cung mot kich ban
- Chon mui gio cho tung kich ban, mac dinh `UTC+7`
- Nhap tieu de cho tung moc
- Chon am thanh thong bao
- Ho tro upload file audio tu may nguoi dung
- Co san mot vai am bao mac dinh
- Nhap mo ta cho tung moc, co the bo trong

### 2.2 Chay kich ban

- Hien thi danh sach cac moc thoi gian theo thu tu
- Highlight event hien tai
- Hien thi event sap toi o kich thuoc nho hon hoac secondary state
- Hien thi support text cho noi dung event
- Khi den thoi diem, phat am thanh thong bao

## 3. Luu y ky thuat quan trong

### 3.1 Luu file audio

`localStorage` khong phu hop de luu file media vi:

- Gioi han dung luong nho
- Chi luu string
- Khong toi uu cho blob/file lon

De luu audio tren trinh duyet, nen uu tien `IndexedDB`.

### 3.2 Voice notification tren web

Neu dung file audio, day la audio notification thay vi text-to-speech. Trinh duyet thuong chan autoplay audio neu chua co user interaction, vi vay man hinh chay kich ban can co hanh dong `Start` ro rang de mo quyen phat am thanh.

### 3.3 Lich kich hoat event

Neu ung dung dang chay tren tab dang mo, co the dung:

- `setTimeout` cho event gan nhat
- `requestAnimationFrame` hoac timer nhe de cap nhat UI countdown

Neu muon thong bao ngay ca khi user dong tab, bai toan se lon hon va can mo rong sang browser notifications, background sync, service worker, hoac server-side scheduler. MVP nen gioi han trong kich ban: user dang mo man hinh run scenario.

### 3.4 Mui gio

Nen luu du lieu thoi gian theo 2 truong:

- `timezone`: vi du `Asia/Ho_Chi_Minh`
- `scheduledAtUtc`: ISO UTC sau khi convert

Khi render thi hien thi theo mui gio cua kich ban hoac cho phep doi view theo local timezone.

## 4. Mo hinh du lieu de xuat

### 4.1 Scenario

```json
{
  "id": "scenario_001",
  "title": "Morning routine",
  "timezone": "Asia/Ho_Chi_Minh",
  "description": "Thong bao lich hop va cong viec",
  "events": [
    {
      "id": "event_001",
      "title": "Bat dau",
      "description": "Chuan bi vao hop",
      "scheduledAtLocal": "2026-05-12T09:00:00",
      "scheduledAtUtc": "2026-05-12T02:00:00Z",
      "audio": {
        "type": "builtin",
        "key": "bell-01"
      }
    }
  ],
  "createdAt": "2026-05-12T00:00:00Z",
  "updatedAt": "2026-05-12T00:00:00Z"
}
```

### 4.2 Audio asset

```json
{
  "id": "audio_001",
  "name": "meeting-bell.mp3",
  "storage": "indexeddb",
  "mimeType": "audio/mpeg",
  "size": 182034
}
```

## 5. Lua chon kien truc

## Option A - Static web + IndexedDB local-only

### Mo ta

- Frontend chay hoan toan tren browser
- Scenarios va audio files duoc luu local trong trinh duyet
- Co the deploy len static hosting
- Khong can backend cho MVP

### Stack de xuat

- UI: `React` + `TypeScript` + `Vite`
- Styling: `Tailwind CSS` hoac `CSS Modules`
- State: `Zustand`
- Forms: `React Hook Form` + `Zod`
- Date/time: `Luxon`
- Local database: `Dexie.js` tren `IndexedDB`
- Audio playback: `HTMLAudioElement` hoac `Howler.js`
- Hosting: `S3 + CloudFront` hoac `Vercel`/`Netlify`

### Uu diem

- Don gian nhat de xay dung
- Phu hop voi yeu cau web tinh
- Chi phi van hanh rat thap
- Khong can quan ly auth va API o giai doan dau

### Nhuoc diem

- Du lieu chi ton tai tren tung browser/thiet bi
- Khong dong bo giua nhieu may
- Khong de share scenario giua nhieu user
- Audio upload chi luu local, khong co backup mac dinh

### Khi nao nen chon

- Muon lam MVP nhanh
- Uu tien web tinh
- User dung tren mot may chinh

## Option B - Static web + AWS serverless + DynamoDB + S3

### Mo ta

- Frontend van la static web
- Scenario metadata luu trong DynamoDB
- File audio luu trong S3
- Frontend goi API qua API Gateway + Lambda hoac AppSync

### Stack de xuat

- UI: `React` + `TypeScript` + `Vite`
- Styling: `Tailwind CSS`
- State/query: `TanStack Query`
- Forms: `React Hook Form` + `Zod`
- Date/time: `Luxon`
- Backend API:
  - Cach 1: `API Gateway + Lambda + DynamoDB + S3`
  - Cach 2: `AWS Amplify Gen 2` + Auth + Storage + Data
- Hosting: `S3 + CloudFront`
- Auth tuy chon: `Cognito`

### Uu diem

- Van deploy duoc theo mo hinh static frontend
- Co dong bo du lieu giua nhieu may
- Audio assets duoc luu tap trung
- De mo rong cho multi-user

### Nhuoc diem

- Phuc tap hon dang ke so voi MVP local-only
- Can quan ly auth, permissions, upload signed URL, API security
- Ton chi phi AWS va cong van hanh

### Luu y quan trong

Neu muon dung `DynamoDB` voi web tinh, can mot lop API trung gian hoac SDK co auth phu hop. Khong nen de frontend public truy cap truc tiep vao bang ma khong co co che bao mat.

### Khi nao nen chon

- Muon target san pham su dung that
- Can du lieu ben vung, share nhieu thiet bi
- Muon giu frontend o dang static hosting

## Option C - Web app co backend nhe + MongoDB

### Mo ta

- Frontend static hoac SSR nhe
- Backend cung cap CRUD cho scenario va upload audio
- Luu metadata vao MongoDB
- Audio luu local tren server hoac object storage

### Stack de xuat

- Frontend: `Next.js` hoac `React + Vite`
- Backend: `Node.js` + `Fastify` hoac `NestJS`
- Database: `MongoDB Atlas`
- File storage:
  - Giai doan dau: local disk server
  - San pham that: `S3-compatible storage`

### Uu diem

- De model hoa document cho scenario/event
- De viet API upload/download
- De phat trien them auth, admin, chia se

### Nhuoc diem

- Khong con la web tinh dung nghia
- Can van hanh backend lien tuc
- Chi phi va do phuc tap tang

### Khi nao nen chon

- Ban chac chan se can backend som
- Team quen MongoDB hon AWS serverless

## 6. So sanh nhanh

| Tieu chi | Option A | Option B | Option C |
|---|---|---|---|
| Toc do MVP | Rat nhanh | Trung binh | Trung binh |
| Static frontend | Co | Co | Co, nhung can backend |
| Luu media upload | Local browser | S3 | Server disk hoac S3 |
| Dong bo nhieu thiet bi | Khong | Co | Co |
| Van hanh | Rat thap | Trung binh | Cao hon |
| Phu hop voi DynamoDB | Khong can | Tot nhat | Khong |
| Mo rong ve sau | Trung binh | Tot | Tot |

## 7. Khuyen nghi thuc te

## Khuyen nghi 1 - MVP nhanh va dung huong

Bat dau voi `Option A`:

- `React + TypeScript + Vite`
- `Dexie.js` de luu scenario va audio blobs trong `IndexedDB`
- `Luxon` cho timezone
- `React Hook Form + Zod` cho form tao scenario
- `Howler.js` hoac audio element native de phat notification
- Deploy frontend len `S3 + CloudFront` hoac `Vercel`

Ly do:

- Dat dung muc tieu web tinh
- Khong can backend ngay
- Giai quyet duoc nhu cau upload audio local
- Cho phep validate UX va timing flow som

## Khuyen nghi 2 - Huong nang cap sau MVP

Sau khi flow duoc xac nhan, nang cap len `Option B`:

- Metadata scenario dua len `DynamoDB`
- Audio dua len `S3`
- Them `Cognito` neu can account
- Them `Lambda/API Gateway` hoac `Amplify` de quan ly API va permissions

Huong nay giup giu frontend dang static nhung van co cloud persistence.

## 8. De xuat UI/UX

### Man hinh 1 - Scenario builder

Thanh phan:

- Form thong tin chung cua scenario
- Timezone selector, default `Asia/Ho_Chi_Minh`
- Danh sach event dang duoc sap xep theo thoi gian
- Nut them event
- Moi event card gom:
  - datetime picker
  - title
  - description
  - audio source selector
  - preview audio

### Man hinh 2 - Run scenario

Thanh phan:

- Tieu de scenario
- Thoi gian hien tai
- Danh sach timeline
- Event hien tai duoc highlight ro rang
- Event tiep theo hien thi secondary
- Support text o khu vuc trung tam de user doc nhanh
- Nut `Start`, `Pause`, `Stop`, `Replay audio`

### Trang thai hien thi event

- `upcoming`: chua den gio
- `current`: dang active
- `completed`: da qua

## 9. Cac quyet dinh ky thuat nen chot som

1. MVP co can dong bo du lieu giua nhieu may khong?
2. Co can user account khong?
3. Audio upload co can chia se giua nhieu user khong?
4. Thong bao chi can khi tab dang mo, hay can background notification?
5. Can import/export scenario ra file JSON khong?

## 10. Tech stack toi uu de bat dau

Neu toi phai chon stack ngay bay gio, toi se chon:

- `React`
- `TypeScript`
- `Vite`
- `Tailwind CSS`
- `Zustand`
- `React Hook Form`
- `Zod`
- `Luxon`
- `Dexie.js`
- `Howler.js`

Va roadmap:

1. MVP local-only tren `IndexedDB`
2. Them export/import JSON
3. Sau do moi day scenario metadata len `DynamoDB`
4. Day audio len `S3`

## 11. Kien truc tong the de xuat

### Giai doan 1

```text
Browser UI
  -> React app
  -> IndexedDB (scenario + audio blobs)
  -> Audio playback engine
```

### Giai doan 2

```text
Browser UI
  -> Static hosting (S3 + CloudFront)
  -> API layer (Lambda/API Gateway or Amplify)
  -> DynamoDB for scenario metadata
  -> S3 for audio assets
```

## 12. Ket luan

Voi bo yeu cau hien tai, huong hop ly nhat la:

- Bat dau bang web tinh + luu local bang `IndexedDB`
- Khong dung `localStorage` cho media
- Thiet ke model du lieu san de nang cap len `DynamoDB + S3`

Day la huong can bang tot giua toc do ra MVP, chi phi, va kha nang mo rong.