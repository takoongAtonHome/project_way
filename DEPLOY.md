# 어디쯤 — 배포 가이드 (HTTPS)

목표: 실제 휴대폰에서 서로 다른 위치를 실시간으로 확인할 수 있도록 **HTTPS 주소**로 배포한다.
(휴대폰 GPS는 HTTPS에서만 동작하므로 배포가 필수)

추천 호스트: **Render** — 무료 플랜, WebSocket 지원, GitHub 연동 배포.

---

## A. Render로 배포 (추천, 약 10분)

### 1) GitHub에 코드 올리기
```bash
cd project_way
git init
git add .
git commit -m "어디쯤 프로토타입"
# GitHub에서 빈 저장소를 만든 뒤:
git remote add origin https://github.com/<본인계정>/<저장소>.git
git branch -M main
git push -u origin main
```
> `.gitignore`로 `node_modules`, `data.json`은 제외됩니다.

### 2) Render에서 서비스 생성
1. https://render.com 가입 → **New → Web Service**
2. 방금 올린 GitHub 저장소 선택
3. 설정(자동 인식되면 그대로):
   - Runtime: **Node**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Plan: **Free**
4. **Create Web Service** → 배포 완료되면 `https://eodijjeum-xxxx.onrender.com` 형태의 주소가 나옵니다.

> 저장소에 `render.yaml`이 있으므로 **New → Blueprint**로 만들면 설정이 자동 적용됩니다.

### 3) 카카오 도메인 등록 (필수)
- [Kakao Developers](https://developers.kakao.com) → 앱 → **플랫폼 → Web 사이트 도메인**에
  배포된 주소(`https://eodijjeum-xxxx.onrender.com`)를 **추가**하세요.
- 안 하면 배포 사이트에서 지도가 "SDK 로드 실패(403)"로 뜹니다.

### 4) 실기기 테스트
- 휴대폰 2대(또는 노트북+휴대폰)에서 배포 주소 접속
- 한쪽에서 모임 생성 → 초대 링크를 다른 기기로 전송 → 각자 닉네임 참여
- 양쪽 "출발하기" → **서로의 실제 위치가 실시간으로 표시** ✅

---

## B. 참고 / 주의

- **무료 플랜 슬립:** Render 무료 웹서비스는 15분간 요청이 없으면 잠들고, 다음 접속 시 수십 초 뜨는 시간이 있습니다. 테스트엔 지장 없음.
- **데이터 영속화:** 무료 플랜은 디스크가 없어 재배포/재시작 시 `data.json`이 초기화됩니다(모임 사라짐). 유료 디스크를 붙이거나(예: `render.yaml`의 disk 주석 해제 + `DATA_FILE=/var/data/data.json`), 이후 단계에서 외부 DB로 교체하세요.
- **실제 경로 ETA:** Render 환경변수에 `KAKAO_REST_KEY`를 추가하면 거리 추정 대신 카카오 길찾기 소요시간을 사용합니다.
- **Docker로 배포하고 싶다면:** 저장소에 `Dockerfile`이 있어 Fly.io/Railway 등 Docker 기반 호스트에도 그대로 배포 가능합니다.

---

## C. 지금 당장 실기기로 테스트만 하고 싶다면 (임시 터널)

정식 배포 없이 localhost를 잠깐 HTTPS로 노출:
```bash
# 서버가 떠 있는 상태(npm start)에서 별도 터미널:
npx localtunnel --port 8000
```
- 출력된 `https://xxxx.loca.lt` 주소를 휴대폰에서 엽니다. (최초 접속 시 안내 페이지에서 비밀번호=노트북 공인 IP 입력이 필요할 수 있음)
- 이 임시 주소도 **카카오 플랫폼 도메인에 등록**해야 지도가 뜹니다. (터널 주소는 매번 바뀜)
- 임시 테스트용이며, 안정적인 공유는 A(정식 배포)를 쓰세요.
