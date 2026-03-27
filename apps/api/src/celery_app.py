"""
Celery Application Configuration
Configures Redis broker, result backend, and task discovery
"""

from celery import Celery
from kombu import Exchange, Queue
import os
from dotenv import load_dotenv

load_dotenv()

# Initialize Celery app
celery_app = Celery('talentflow_bulk_upload')

# ============================================================================
# CELERY CONFIGURATION
# ============================================================================

celery_app.conf.update(
    # Broker & Result Backend (Redis)
    broker_url=os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0'),
    result_backend=os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1'),
    
    # Task serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone=os.getenv('CELERY_TIMEZONE', 'UTC'),
    enable_utc=True,
    
    # Task tracking
    task_track_started=True,
    task_time_limit=30 * 60,   # 30 min hard limit
    task_soft_time_limit=25 * 60,  # 25 min soft limit (raises SoftTimeLimitExceeded)
    
    # Worker configuration
    worker_prefetch_multiplier=1,  # Only fetch one task at a time
    worker_max_tasks_per_child=1000,
    
    # Result backend
    result_expires=3600,  # Results expire in 1 hour
    result_backend_transport_options={'master_name': 'mymaster'},
    
    # Default routing
    task_default_queue='default',
    task_default_exchange='tasks',
    task_default_exchange_type='direct',
    task_default_routing_key='task.default',
)

# ============================================================================
# QUEUE DEFINITIONS
# ============================================================================

default_exchange = Exchange('tasks', type='direct')

celery_app.conf.task_queues = (
    Queue(
        'default',
        exchange=default_exchange,
        routing_key='task.default',
        queue_arguments={'x-max-priority': 10}
    ),
    Queue(
        'priority_high',
        exchange=default_exchange,
        routing_key='task.priority_high',
        queue_arguments={'x-max-priority': 10}
    ),
    Queue(
        'virus_scan',
        exchange=default_exchange,
        routing_key='task.virus_scan',
    ),
    Queue(
        'bulk_processing',
        exchange=default_exchange,
        routing_key='task.bulk_processing',
    ),
)

# ============================================================================
# CELERY BEAT SCHEDULE (Periodic Tasks)
# ============================================================================

from celery.schedules import crontab

celery_app.conf.beat_schedule = {
    'cleanup-old-uploads-daily': {
        'task': 'src.tasks.bulk_upload_tasks.cleanup_old_uploads',
        'schedule': crontab(hour=2, minute=0),  # Every day at 2 AM
        'options': {'queue': 'default'}
    },
    'monitor-queue-every-hour': {
        'task': 'src.tasks.bulk_upload_tasks.monitor_queue_size',
        'schedule': crontab(minute=0),  # Every hour
        'options': {'queue': 'default'}
    },
}

# ============================================================================
# AUTO-DISCOVERY OF TASKS
# ============================================================================

# Automatically discover tasks from src.tasks module
celery_app.autodiscover_tasks(['src.tasks'])

# ============================================================================
# ERROR HANDLERS (Optional but recommended)
# ============================================================================

@celery_app.task(bind=True)
def debug_task(self):
    """Debug task for testing Celery setup"""
    print(f'Request: {self.request!r}')
