from rest_framework import viewsets, status
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.contrib.auth import get_user_model
from django.utils import timezone
from collections import defaultdict
import calendar

from .models import Transaction, MonthlyLog
from .serializers import TransactionSerializer
from external.gemini.client import GeminiClient

User = get_user_model()

class ParseTransactionView(APIView):
    """
    자연어 텍스트를 입력받아 AI(Gemini)를 통해 구조화된 데이터로 변환하는 뷰
    DB에 저장하지 않고, 분석 결과만 반환합니다.
    """
    permission_classes = [IsAuthenticated]  # 인증된 사용자만 사용 가능

    def post(self, request):
        text = request.data.get('text', '')
        if not text:
            return Response({"error": "No text provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Gemini AI 클라이언트를 사용하여 텍스트 분석
        client = GeminiClient()
        parsed_data = client.analyze_text(text)
        
        if not parsed_data:
            return Response({"error": "Failed to parse text"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        return Response(parsed_data)

class CreateTransactionView(APIView):
    """
    분석된(또는 사용자가 입력한) 데이터를 받아 실제 DB에 지출 내역을 저장하는 뷰
    """
    permission_classes = [IsAuthenticated]  # 인증된 사용자만 사용 가능

    def post(self, request):
        data = request.data
        
        # 로그인한 사용자 사용
        user = request.user

        try:
            from django.utils import timezone
            transaction_date = data.get('date')
            
            # 날짜가 없으면 현재 시간으로 설정
            if not transaction_date:
                transaction_date = timezone.now()

            # DB에 Transaction 객체 생성 및 저장
            transaction = Transaction.objects.create(
                user=user,
                category=data.get('category', '기타'),
                item=data.get('item', ''),
                store=data.get('store', ''),
                amount=data.get('amount', 0),
                memo=data.get('memo', ''),
                date=transaction_date,
                address=data.get('address', ''),
                is_fixed=data.get('is_fixed', False)
            )

            return Response({"message": "Transaction created", "id": transaction.id}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class TransactionListView(APIView):
    """
    사용자의 지출 내역 목록을 조회하는 뷰
    - query param으로 year, month가 주어지면 해당 월의 내역만 필터링
    - 응답에 일별 지출 상태(daily_status)를 포함
    """
    permission_classes = [IsAuthenticated]  # 인증 필요
    def get(self, request):
        user = request.user
        
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        today = timezone.localdate()
        target_year = int(year) if year else today.year
        target_month = int(month) if month else today.month
        queryset = Transaction.objects.filter(user=user)
        queryset = queryset.filter(date__year=target_year, date__month=target_month)
        transactions = queryset.order_by('-date', '-id')
        
        # 일별 금액 집계 및 상태 계산
        from .services import get_daily_status
        daily_status_data, _ = get_daily_status(user, target_year, target_month, transactions)
        
        serializer = TransactionSerializer(transactions, many=True)
        
        return Response({
            "transactions": serializer.data,
            "daily_status": daily_status_data
        })
class CategoryStatsView(APIView):
    """
    사용자의 카테고리별 지출 통계를 조회하는 뷰
    """
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        
        transactions = Transaction.objects.filter(user=user)
        
        from django.db.models import Sum
        category_stats = transactions.values('category').annotate(
            total=Sum('amount')
        ).order_by('-total')
        
        total_spending = sum(item['total'] for item in category_stats)
        
        result = []
        for item in category_stats:
            result.append({
                'category': item['category'],
                'amount': item['total'],
                'percent': round((item['total'] / total_spending * 100), 1) if total_spending > 0 else 0
            })
        
        return Response({
            'categories': result,
            'total': total_spending
        })
class MonthlyAnalysisView(APIView):
    """
    월간 요약 카드에 들어갈 통계 데이터
    """
    permission_classes = [IsAuthenticated]  # 인증 필요로 변경
    def get(self, request):
        user = request.user
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        today = timezone.localdate()
        target_year = int(year) if year else today.year
        target_month = int(month) if month else today.month
        queryset = Transaction.objects.filter(user=user, date__year=target_year, date__month=target_month)
        
        from .services import get_daily_status
        daily_status_data, _ = get_daily_status(user, target_year, target_month, queryset)
        
        total_spent = sum(item['total_spent'] for item in daily_status_data.values())
        
        success_days = 0
        fail_days = 0
        
        for date_str, info in daily_status_data.items():
            status_val = info['status']
            if status_val in ['money', 'happy']:
                success_days += 1
            elif status_val in ['sad', 'angry']:
                fail_days += 1
        
        return Response({
            "total_spent": total_spent,
            "success_days": success_days,
            "fail_days": fail_days
        })
class TransactionDetailView(RetrieveUpdateDestroyAPIView):
    """
    특정 지출 내역(id)에 대한 조회, 수정, 삭제를 처리하는 뷰
    """
    queryset = Transaction.objects.all()
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]  # 인증 필요로 변경
