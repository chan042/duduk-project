from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.transactions.models import Transaction
from apps.coaching.models import Coaching
from external.gemini.client import GeminiClient

@receiver(post_save, sender=Transaction)
def generate_coaching_if_needed(sender, instance, created, **kwargs):
    """
    지출 내역이 저장될 때마다 호출되어 코칭 생성 조건을 검사하고 실행함
    """
    if not created:
        return

    user = instance.user
    
    try:
        # 마지막 코칭 생성 시간 조회
        last_coaching = Coaching.objects.filter(user=user).order_by('-created_at').first()
        
        # 마지막 코칭 이후의 지출 내역 조회
        if last_coaching:
            new_transactions = Transaction.objects.filter(user=user, created_at__gt=last_coaching.created_at).order_by('-created_at')
        else:
            new_transactions = Transaction.objects.filter(user=user).order_by('-created_at')

        # !테스트 중에는 1로 수정!
        # 10건 이상이면 코칭 생성
        if new_transactions.count() >= 5:
            # 분석 컨텍스트 (최근 10건)
            context_transactions = Transaction.objects.filter(user=user).order_by('-created_at')[:1]
            transaction_list_str = ""
            for t in context_transactions:
                transaction_list_str += f"- {t.date.strftime('%Y-%m-%d')} {t.category} / {t.item} ({t.store}) / {t.amount}원\n"

            client = GeminiClient()
            advice_data = client.get_advice(transaction_list_str)
            
            if advice_data:
                Coaching.objects.create(
                    user=user,
                    subject=advice_data.get('subject', '소비 분석'),
                    title=advice_data.get('title', '소비 코칭'),
                    analysis=advice_data.get('analysis', ''),
                    coaching_content=advice_data.get('coaching_content', ''),
                    estimated_savings=advice_data.get('estimated_savings', 0)
                )
                
                # 코칭 카드 최대 4개 유지 (오래된 것 삭제)
                coachings = Coaching.objects.filter(user=user).order_by('-created_at')
                if coachings.count() > 4:
                    # 5번째 이후의 코칭 삭제 (최신 4개만 유지)
                    ids_to_keep = list(coachings[:4].values_list('id', flat=True))
                    Coaching.objects.filter(user=user).exclude(id__in=ids_to_keep).delete()
    except Exception as e:
        print(f"Auto Coaching Signal Error: {e}")
