꼭 알아야 할 Docker 명령어 (치트 시트)

개발 시 유용하게 사용할 명령어들, 모두 VS Code의 컨테이너 터미널에서 사용.

docker-compose up -d : 모든 서버를 켭니다. (개발 시작 시)

docker-compose down : 모든 서버를 끕니다. (개발 종료 시)

docker ps : 현재 실행 중인 서버(컨테이너) 목록을 확인.

docker-compose logs -f backend : 백엔드 서버의 실시간 로그를 확인. (오류 추적 시 유용)

docker-compose exec backend python manage.py makemigrations : 모델 변경 후 DB 스키마를 변경

docker-compose exec backend python manage.py migrate : 모델 변경 후 DB를 업데이트

docker-compose exec backend python manage.py createsuperuser : 관리자 계정을 생성