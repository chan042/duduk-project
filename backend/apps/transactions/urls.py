from django.urls import path
from .views import (
    ParseTransactionView,
    ReceiptOCRView,
    ImageMatchAnalyzeStoreView,
    ImageMatchResolvePriceView,
    CreateTransactionView,
    TransactionListView,
    CategoryStatsView,
    MonthlyAnalysisView,
    TransactionDetailView,
    SpendingConfirmationView,
)

urlpatterns = [
    path('parse/', ParseTransactionView.as_view(), name='parse_transaction'),
    path('ocr/', ReceiptOCRView.as_view(), name='receipt_ocr'),
    path('image-match/analyze-store/', ImageMatchAnalyzeStoreView.as_view(), name='image_match_analyze_store'),
    path('image-match/resolve-price/', ImageMatchResolvePriceView.as_view(), name='image_match_resolve_price'),
    path('create/', CreateTransactionView.as_view(), name='create_transaction'),
    path('category-stats/', CategoryStatsView.as_view(), name='category_stats'),
    path('monthly-analysis/', MonthlyAnalysisView.as_view(), name='monthly_analysis'),
    path('spending-confirmation/', SpendingConfirmationView.as_view(), name='spending_confirmation'),
    path('', TransactionListView.as_view(), name='list_transactions'),
    path('<int:pk>/', TransactionDetailView.as_view(), name='detail_transaction'),
]
